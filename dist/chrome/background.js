// Memory cache for last seen badge counts per tab
// Maps tabId -> { count: number, url: string }
const tabStatsCache = new Map();

// Dynamic rule ID offset for whitelisted domains
const WHITELIST_RULE_ID_START = 1000000;

// Chrome can auto-display the per-tab blocked count as badge text via the
// declarativeNetRequest feedback APIs. Firefox implements none of them, so we
// feature-detect and degrade gracefully instead of throwing at runtime.
// The method is reached via a variable so Firefox's add-on linter does not flag
// a static reference to an API it hasn't implemented.
const ACTION_OPTS_METHOD = "setExtensionActionOptions";
const SUPPORTS_ACTION_COUNT =
  typeof chrome.declarativeNetRequest[ACTION_OPTS_METHOD] === "function";

// Ask Chrome to mirror the matched-rule count into the toolbar badge. No-op
// (and never throws) on browsers that don't support it.
function enableBadgeCount() {
  if (!SUPPORTS_ACTION_COUNT) return;
  try {
    chrome.declarativeNetRequest[ACTION_OPTS_METHOD]({
      displayActionCountAsBadgeText: true
    });
  } catch (e) {
    console.warn("Action-count badge not supported here:", e);
  }
}

// Ruleset ids are split across one or more files per logical ruleset
// (core_1, core_2, china_1, ...). Read them from the manifest so this stays
// correct no matter how many files the build produced.
function getRulesetIds() {
  const dnr = chrome.runtime.getManifest().declarative_net_request || {};
  const resources = dnr.rule_resources || [];
  const core = [];
  const china = [];
  for (const res of resources) {
    if (res.id.startsWith("core")) core.push(res.id);
    else if (res.id.startsWith("china")) china.push(res.id);
  }
  return { core, china };
}

// Deterministic hash to map domain string to a unique rule ID
function getWhitelistRuleId(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    const char = domain.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return WHITELIST_RULE_ID_START + (Math.abs(hash) % 8999999);
}

// Update enabled rulesets based on user settings
async function applyRulesetStates() {
  return new Promise((resolve) => {
    chrome.storage.local.get({
      isEnabled: true,
      isChinaEnabled: false
    }, (settings) => {
      const { core, china } = getRulesetIds();
      const enableRulesetIds = [];
      const disableRulesetIds = [];

      if (settings.isEnabled) {
        enableRulesetIds.push(...core);
        if (settings.isChinaEnabled) {
          enableRulesetIds.push(...china);
        } else {
          disableRulesetIds.push(...china);
        }
      } else {
        disableRulesetIds.push(...core, ...china);
      }

      chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: enableRulesetIds,
        disableRulesetIds: disableRulesetIds
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error updating rulesets:", chrome.runtime.lastError);
        } else {
          console.log("Rulesets updated successfully. Enabled:", enableRulesetIds, "Disabled:", disableRulesetIds);
        }
        resolve();
      });
    });
  });
}

// Accumulate block counts to the global total
function accumulateToGlobalTotal(increment) {
  if (increment <= 0) return;
  chrome.storage.local.get({ totalBlocked: 0 }, (result) => {
    const newTotal = result.totalBlocked + increment;
    chrome.storage.local.set({ totalBlocked: newTotal });
  });
}

// Initialize on install or update
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Just Ad Blocker installed.");
  
  // Set up storage defaults
  chrome.storage.local.get({
    isEnabled: true,
    isChinaEnabled: false,
    totalBlocked: 0,
    whitelist: []
  }, (result) => {
    chrome.storage.local.set(result);
  });

  // Apply ruleset states first so blocking works regardless of badge support.
  await applyRulesetStates();

  // Then (best effort) enable the action-count badge.
  enableBadgeCount();
});

// Sync rulesets when extension starts
chrome.runtime.onStartup.addListener(async () => {
  await applyRulesetStates();
  enableBadgeCount();
});

// --- Block-count statistics (Chrome only) --------------------------------
// These rely on the action-count badge, which Firefox does not implement, so
// the guards below keep Firefox free of errors and wasted polling.
if (SUPPORTS_ACTION_COUNT) {
  // Poll the per-tab badge count every ~10 seconds.
  chrome.alarms.create("pollBadgeCounts", { periodInMinutes: 0.15 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pollBadgeCounts") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (!tab.id || tab.id === chrome.tabs.TAB_ID_NONE) return;
        
        chrome.action.getBadgeText({ tabId: tab.id }, (badgeText) => {
          if (chrome.runtime.lastError) {
            // Tab might have closed or not loaded yet
            return;
          }
          
          const count = badgeText ? parseInt(badgeText, 10) : 0;
          if (isNaN(count)) return;
          
          const cached = tabStatsCache.get(tab.id) || { count: 0, url: tab.url };
          if (count > cached.count) {
            const diff = count - cached.count;
            accumulateToGlobalTotal(diff);
            tabStatsCache.set(tab.id, { count: count, url: tab.url });
          }
        });
      });
    });
  }
});

// Intercept page navigation to grab final count before resets
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!SUPPORTS_ACTION_COUNT) return;
  if (details.frameId === 0) { // Only main frame navigation
    chrome.action.getBadgeText({ tabId: details.tabId }, (badgeText) => {
      if (!chrome.runtime.lastError && badgeText) {
        const count = parseInt(badgeText, 10);
        if (!isNaN(count) && count > 0) {
          const cached = tabStatsCache.get(details.tabId) || { count: 0 };
          const diff = count - cached.count;
          if (diff > 0) {
            accumulateToGlobalTotal(diff);
          }
        }
      }
      // Reset tab stats cache for the new page load
      tabStatsCache.set(details.tabId, { count: 0, url: details.url });
    });
  }
});

// Clean up tab stats cache when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStatsCache.delete(tabId);
});

// Handle incoming messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateRulesets") {
    applyRulesetStates().then(() => sendResponse({ success: true }));
    return true; // Keep message channel open for async response
  }
  
  if (message.action === "addToWhitelist") {
    const domain = message.domain;
    const ruleId = getWhitelistRuleId(domain);
    
    const newRule = {
      id: ruleId,
      priority: 100,
      action: { type: "allowAllRequests" },
      condition: {
        initiatorDomains: [domain],
        resourceTypes: ["main_frame", "sub_frame"]
      }
    };
    
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [newRule],
      removeRuleIds: [ruleId] // Remove old one if exists to prevent duplication
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error adding whitelist rule:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        // Update whitelist in storage
        chrome.storage.local.get({ whitelist: [] }, (result) => {
          const whitelist = result.whitelist;
          if (!whitelist.includes(domain)) {
            whitelist.push(domain);
            chrome.storage.local.set({ whitelist: whitelist });
          }
          sendResponse({ success: true });
        });
      }
    });
    return true;
  }
  
  if (message.action === "removeFromWhitelist") {
    const domain = message.domain;
    const ruleId = getWhitelistRuleId(domain);
    
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error removing whitelist rule:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        chrome.storage.local.get({ whitelist: [] }, (result) => {
          const whitelist = result.whitelist.filter(d => d !== domain);
          chrome.storage.local.set({ whitelist: whitelist });
          sendResponse({ success: true });
        });
      }
    });
    return true;
  }
});
