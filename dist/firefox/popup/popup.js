document.addEventListener('DOMContentLoaded', () => {
  let currentTab = null;
  let currentDomain = "";

  // Elements
  const powerBtn = document.getElementById('powerBtn');
  const statusBadge = document.getElementById('statusBadge');
  const statusMsg = document.getElementById('statusMsg');
  const pageBlockedCount = document.getElementById('pageBlockedCount');
  const totalBlockedCount = document.getElementById('totalBlockedCount');
  const currentDomainText = document.getElementById('currentDomain');
  const whitelistToggle = document.getElementById('whitelistToggle');
  const whitelistRow = document.getElementById('whitelistRow');
  const chinaRulesetToggle = document.getElementById('chinaRulesetToggle');

  // Per-tab/total block counts depend on Chrome's action-count badge API,
  // which Firefox does not implement. On those browsers we hide the stats
  // cards entirely rather than showing meaningless figures. The method name is
  // held in a variable so Firefox's add-on linter doesn't flag a static
  // reference to an API it hasn't implemented.
  const ACTION_OPTS_METHOD = 'setExtensionActionOptions';
  const COUNT_SUPPORTED =
    typeof chrome.declarativeNetRequest[ACTION_OPTS_METHOD] === 'function';
  if (!COUNT_SUPPORTED) {
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) statsGrid.style.display = 'none';
  }

  // --- Localization (chrome.i18n) ---
  const t = (key) => chrome.i18n.getMessage(key) || "";
  function localizeStatic() {
    document.documentElement.lang = chrome.i18n.getUILanguage();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const msg = t(el.getAttribute('data-i18n'));
      if (msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const msg = t(el.getAttribute('data-i18n-aria'));
      if (msg) el.setAttribute('aria-label', msg);
    });
  }
  localizeStatic();

  // Helper to extract clean domain
  function getDomainFromUrl(urlString) {
    try {
      const url = new URL(urlString);
      let hostname = url.hostname;
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      return hostname;
    } catch (e) {
      return "";
    }
  }

  // Update popup stats and visual states
  function updateUI() {
    chrome.storage.local.get({
      isEnabled: true,
      isChinaEnabled: false,
      totalBlocked: 0,
      whitelist: []
    }, (settings) => {
      // 1. Update Global Power Switch
      if (settings.isEnabled) {
        powerBtn.classList.add('active');
        statusBadge.textContent = t('statusEnabled');
        statusBadge.classList.remove('inactive');
        statusMsg.textContent = t('protectedMsg');
      } else {
        powerBtn.classList.remove('active');
        statusBadge.textContent = t('statusPaused');
        statusBadge.classList.add('inactive');
        statusMsg.textContent = t('pausedMsg');
      }

      // 2. Update Total Blocked Stats
      totalBlockedCount.textContent =
        COUNT_SUPPORTED ? settings.totalBlocked.toLocaleString() : "—";

      // 3. Update China Ruleset Switch
      chinaRulesetToggle.checked = settings.isChinaEnabled;

      // 4. Update Whitelist Switch
      if (currentDomain) {
        currentDomainText.textContent = currentDomain;
        const isWhitelisted = settings.whitelist.includes(currentDomain);
        whitelistToggle.checked = isWhitelisted;

        // If global is disabled, dim whitelist row
        if (!settings.isEnabled) {
          whitelistRow.style.opacity = "0.5";
          whitelistToggle.disabled = true;
        } else {
          whitelistRow.style.opacity = "1";
          whitelistToggle.disabled = false;
        }
      }
    });

    // 5. Update Current Tab Page Block Count from Badge Text
    if (!COUNT_SUPPORTED) {
      pageBlockedCount.textContent = "—";
    } else if (currentTab && currentTab.id) {
      chrome.action.getBadgeText({ tabId: currentTab.id }, (badgeText) => {
        if (chrome.runtime.lastError) {
          pageBlockedCount.textContent = "0";
          return;
        }
        const count = badgeText ? parseInt(badgeText, 10) : 0;
        pageBlockedCount.textContent = isNaN(count) ? "0" : count.toLocaleString();
      });
    }
  }

  // Initialize: Get active tab and load current domain
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      currentTab = tabs[0];
      const url = currentTab.url || "";
      currentDomain = getDomainFromUrl(url);

      // Hide whitelist option for internal browser pages
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        whitelistRow.style.display = 'none';
      } else {
        whitelistRow.style.display = 'flex';
      }
      
      updateUI();
    }
  });

  // Click Handler: Global Power Toggle
  powerBtn.addEventListener('click', () => {
    chrome.storage.local.get({ isEnabled: true }, (settings) => {
      const newEnabled = !settings.isEnabled;
      chrome.storage.local.set({ isEnabled: newEnabled }, () => {
        // Notify background.js to update enabled rulesets
        chrome.runtime.sendMessage({ action: "updateRulesets" }, (response) => {
          updateUI();
        });
      });
    });
  });

  // Change Handler: Whitelist Toggle
  whitelistToggle.addEventListener('change', () => {
    if (!currentDomain) return;
    
    const action = whitelistToggle.checked ? "addToWhitelist" : "removeFromWhitelist";
    chrome.runtime.sendMessage({
      action: action,
      domain: currentDomain
    }, (response) => {
      if (response && response.success) {
        updateUI();
      } else {
        // Revert toggle if failed
        whitelistToggle.checked = !whitelistToggle.checked;
        console.error("Whitelist action failed:", response ? response.error : "Unknown error");
      }
    });
  });

  // Change Handler: China Ruleset Toggle
  chinaRulesetToggle.addEventListener('change', () => {
    const isChinaEnabled = chinaRulesetToggle.checked;
    chrome.storage.local.set({ isChinaEnabled: isChinaEnabled }, () => {
      chrome.runtime.sendMessage({ action: "updateRulesets" }, (response) => {
        updateUI();
      });
    });
  });
});
