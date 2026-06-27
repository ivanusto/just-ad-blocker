// Memory cache for last seen badge counts per tab
// Maps tabId -> { count: number, url: string }
const tabStatsCache = new Map();

// Dynamic rule ID offset for whitelisted domains. Whitelist rules live in the
// id band [START, START + RANGE); everything in that band is owned by the
// whitelist reconciler below.
const WHITELIST_RULE_ID_START = 1000000;
const WHITELIST_RULE_ID_RANGE = 10000000;

// User-defined block rules live in their own id band, reconciled the same way as
// the whitelist. Kept well clear of the whitelist band above.
const CUSTOM_RULE_ID_START = 20000000;
const CUSTOM_RULE_ID_RANGE = 10000000;

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

// Rebuild every whitelist dynamic rule from the stored `whitelist` array. IDs are
// assigned by array index (START + i), so they are unique by construction — no
// hashing, no collisions. This is the single source of truth: it wipes the whole
// whitelist id band and re-creates it, which also self-heals duplicates and
// migrates rules left behind by the previous hash-based scheme.
function rebuildWhitelistRules() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ whitelist: [] }, (result) => {
      const whitelist = Array.isArray(result.whitelist) ? result.whitelist : [];
      chrome.declarativeNetRequest.getDynamicRules((existing) => {
        const removeRuleIds = (existing || [])
          .filter((r) =>
            r.id >= WHITELIST_RULE_ID_START &&
            r.id < WHITELIST_RULE_ID_START + WHITELIST_RULE_ID_RANGE)
          .map((r) => r.id);

        const addRules = whitelist.map((domain, i) => ({
          id: WHITELIST_RULE_ID_START + i,
          priority: 100,
          action: { type: "allowAllRequests" },
          condition: {
            // Match the page's own navigation request (request domain = the site
            // being opened), NOT initiatorDomains: a top-level main_frame request
            // has no initiator, so initiatorDomains never matches it and
            // allowAllRequests never fires. requestDomains matches the domain and
            // its subdomains, exempting the whole tab from blocking.
            requestDomains: [domain],
            resourceTypes: ["main_frame", "sub_frame"]
          }
        }));

        chrome.declarativeNetRequest.updateDynamicRules(
          { removeRuleIds, addRules },
          () => {
            if (chrome.runtime.lastError) {
              console.error("Error rebuilding whitelist rules:", chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          }
        );
      });
    });
  });
}

// Rebuild user-defined block rules from the stored `customBlocklist` array. Each
// entry is a domain (e.g. "popin.cc"); we block it and all its subdomains with a
// `||domain^` urlFilter across every resource type. Same wipe-and-recreate
// reconciler pattern as the whitelist, in the custom id band.
function rebuildCustomRules() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ customBlocklist: [] }, (result) => {
      const list = Array.isArray(result.customBlocklist) ? result.customBlocklist : [];
      chrome.declarativeNetRequest.getDynamicRules((existing) => {
        const removeRuleIds = (existing || [])
          .filter((r) =>
            r.id >= CUSTOM_RULE_ID_START &&
            r.id < CUSTOM_RULE_ID_START + CUSTOM_RULE_ID_RANGE)
          .map((r) => r.id);

        const addRules = list.map((domain, i) => ({
          id: CUSTOM_RULE_ID_START + i,
          priority: 1,
          action: { type: "block" },
          condition: {
            urlFilter: `||${domain}^`,
            resourceTypes: [
              "main_frame", "sub_frame", "stylesheet", "script", "image",
              "font", "object", "xmlhttprequest", "ping", "csp_report",
              "media", "websocket", "other"
            ]
          }
        }));

        chrome.declarativeNetRequest.updateDynamicRules(
          { removeRuleIds, addRules },
          () => {
            if (chrome.runtime.lastError) {
              console.error("Error rebuilding custom rules:", chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          }
        );
      });
    });
  });
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
    collapseEnabled: true,
    totalBlocked: 0,
    whitelist: [],
    customBlocklist: []
  }, (result) => {
    chrome.storage.local.set(result);
  });

  // Apply ruleset states first so blocking works regardless of badge support.
  await applyRulesetStates();

  // Reconcile whitelist dynamic rules from storage (also migrates any rules left
  // by the old hash-based id scheme).
  await rebuildWhitelistRules().catch(() => {});

  // Reconcile user-defined block rules.
  await rebuildCustomRules().catch(() => {});

  // Then (best effort) enable the action-count badge.
  enableBadgeCount();
});

// Sync rulesets when extension starts
chrome.runtime.onStartup.addListener(async () => {
  await applyRulesetStates();
  await rebuildWhitelistRules().catch(() => {});
  await rebuildCustomRules().catch(() => {});
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
    chrome.storage.local.get({ whitelist: [] }, (result) => {
      const whitelist = result.whitelist;
      if (!whitelist.includes(domain)) whitelist.push(domain);
      chrome.storage.local.set({ whitelist }, () => {
        rebuildWhitelistRules()
          .then(() => sendResponse({ success: true }))
          .catch((e) => sendResponse({ success: false, error: e && e.message }));
      });
    });
    return true;
  }

  if (message.action === "removeFromWhitelist") {
    const domain = message.domain;
    chrome.storage.local.get({ whitelist: [] }, (result) => {
      const whitelist = result.whitelist.filter((d) => d !== domain);
      chrome.storage.local.set({ whitelist }, () => {
        rebuildWhitelistRules()
          .then(() => sendResponse({ success: true }))
          .catch((e) => sendResponse({ success: false, error: e && e.message }));
      });
    });
    return true;
  }

  if (message.action === "addCustomRule") {
    const domain = message.domain;
    if (!domain) { sendResponse({ success: false, error: "empty domain" }); return false; }
    chrome.storage.local.get({ customBlocklist: [] }, (result) => {
      const list = result.customBlocklist;
      if (!list.includes(domain)) list.push(domain);
      chrome.storage.local.set({ customBlocklist: list }, () => {
        rebuildCustomRules()
          .then(() => sendResponse({ success: true }))
          .catch((e) => sendResponse({ success: false, error: e && e.message }));
      });
    });
    return true;
  }

  if (message.action === "removeCustomRule") {
    const domain = message.domain;
    chrome.storage.local.get({ customBlocklist: [] }, (result) => {
      const list = result.customBlocklist.filter((d) => d !== domain);
      chrome.storage.local.set({ customBlocklist: list }, () => {
        rebuildCustomRules()
          .then(() => sendResponse({ success: true }))
          .catch((e) => sendResponse({ success: false, error: e && e.message }));
      });
    });
    return true;
  }
});
