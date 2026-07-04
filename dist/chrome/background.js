// Last-seen badge count per tab, keyed by tabId. Kept in chrome.storage.session
// so a service-worker restart doesn't reset it: with an in-memory cache, every
// restart re-counted each tab's full badge value into totalBlocked, inflating
// the total. Falls back to module state where storage.session is unavailable.
const TAB_COUNTS_KEY = "tabBadgeCounts";
const sessionStore =
  chrome.storage && chrome.storage.session ? chrome.storage.session : null;
let memTabCounts = {};

function getTabCounts() {
  if (!sessionStore) return Promise.resolve(memTabCounts);
  return sessionStore.get({ [TAB_COUNTS_KEY]: {} }).then((r) => r[TAB_COUNTS_KEY]);
}

function setTabCounts(counts) {
  if (!sessionStore) { memTabCounts = counts; return Promise.resolve(); }
  return sessionStore.set({ [TAB_COUNTS_KEY]: counts });
}

// The badge poll and the pre-navigation harvest both read-modify-write the
// counts map and the running total; chain them so overlapping events can't
// count the same blocks twice.
let statsChain = Promise.resolve();
function withStatsLock(fn) {
  statsChain = statsChain.then(fn, fn);
  return statsChain;
}

// Badge text for a tab as a number; null if the tab is gone.
function getBadgeCount(tabId) {
  return new Promise((resolve) => {
    chrome.action.getBadgeText({ tabId }, (text) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      const n = parseInt(text, 10);
      resolve(isNaN(n) ? 0 : n);
    });
  });
}

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
// entry is a domain (e.g. "ads.example.com"); we block it and all its subdomains
// with a `||domain^` urlFilter across every resource type. Same wipe-and-recreate
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
    customBlocklist: [],
    customHideSelectors: []
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
  // Poll the per-tab badge counts. Chrome clamps alarm periods below 30s (and
  // logs a warning for them), so ask for exactly the minimum.
  chrome.alarms.create("pollBadgeCounts", { periodInMinutes: 0.5 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "pollBadgeCounts") return;
  withStatsLock(async () => {
    const [tabs, counts] = await Promise.all([
      new Promise((resolve) => chrome.tabs.query({}, resolve)),
      getTabCounts()
    ]);
    const next = {};
    let increment = 0;
    await Promise.all(tabs.map(async (tab) => {
      if (!tab.id || tab.id === chrome.tabs.TAB_ID_NONE) return;
      const count = await getBadgeCount(tab.id);
      if (count === null) return; // tab closed mid-poll
      const prev = counts[tab.id] || 0;
      if (count > prev) increment += count - prev;
      next[tab.id] = count;
    }));
    // Rebuilding the map from live tabs also prunes entries for closed tabs,
    // so no tabs.onRemoved bookkeeping is needed.
    await setTabCounts(next);
    accumulateToGlobalTotal(increment);
  });
});

// Harvest a page's final count right before navigation resets its badge.
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!SUPPORTS_ACTION_COUNT) return;
  if (details.frameId !== 0) return; // main frame only
  withStatsLock(async () => {
    const count = await getBadgeCount(details.tabId);
    const counts = await getTabCounts();
    const prev = counts[details.tabId] || 0;
    if (count !== null && count > prev) {
      accumulateToGlobalTotal(count - prev);
    }
    // The new page load starts counting from zero.
    counts[details.tabId] = 0;
    await setTabCounts(counts);
  });
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
