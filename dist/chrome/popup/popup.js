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
  const collapseToggle = document.getElementById('collapseToggle');
  const managedSitesContainer = document.getElementById('managedSitesContainer');
  const managedList = document.getElementById('managedList');
  const customRuleInput = document.getElementById('customRuleInput');
  const customRuleAdd = document.getElementById('customRuleAdd');
  const customList = document.getElementById('customList');
  const hideSelectorInput = document.getElementById('hideSelectorInput');
  const hideSelectorAdd = document.getElementById('hideSelectorAdd');
  const hideList = document.getElementById('hideList');

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
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const msg = t(el.getAttribute('data-i18n-ph'));
      if (msg) el.setAttribute('placeholder', msg);
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

  // Normalize free-text input into a bare domain: strip scheme, path, port and a
  // leading "www.". Returns "" if it doesn't look like a domain.
  function normalizeDomain(raw) {
    let s = (raw || "").trim().toLowerCase();
    if (!s) return "";
    s = s.replace(/^[a-z]+:\/\//, ""); // scheme
    s = s.split("/")[0].split("?")[0].split("#")[0]; // path/query/hash
    s = s.split("@").pop();            // strip any userinfo
    s = s.split(":")[0];               // strip port
    if (s.startsWith("www.")) s = s.slice(4);
    // Must look like a domain: labels of letters/digits/hyphen, at least one dot.
    if (!/^([a-z0-9-]+\.)+[a-z0-9-]+$/.test(s)) return "";
    return s;
  }

  // Render a string list into `listEl`, each row with a remove button. `onRemove`
  // is called with the item; it performs the removal and re-renders.
  function renderItemList(listEl, items, onRemove) {
    if (!listEl) return;
    listEl.textContent = "";
    (items || []).forEach((item) => {
      const li = document.createElement("li");
      li.className = "managed-item";

      const span = document.createElement("span");
      span.className = "managed-domain";
      span.textContent = item; // textContent avoids any HTML injection

      const btn = document.createElement("button");
      btn.className = "managed-remove";
      btn.textContent = "×";
      btn.setAttribute("aria-label", `${t('managedRemoveAria')} ${item}`.trim());
      btn.addEventListener("click", () => onRemove(item));

      li.appendChild(span);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function removeViaMessage(action, value) {
    chrome.runtime.sendMessage({ action, domain: value }, (response) => {
      if (response && response.success) updateUI();
      else console.error("Remove failed:", response ? response.error : "Unknown error");
    });
  }

  function renderManagedList(whitelist) {
    renderItemList(managedList, whitelist, (d) => removeViaMessage("removeFromWhitelist", d));
    if (managedSitesContainer) {
      managedSitesContainer.style.display = (whitelist && whitelist.length) ? "flex" : "none";
    }
  }

  function renderCustomList(customBlocklist) {
    renderItemList(customList, customBlocklist, (d) => removeViaMessage("removeCustomRule", d));
  }

  // Hide selectors are cosmetic-only (no DNR rules), so the popup writes storage
  // directly; the content script reacts via storage.onChanged.
  function renderHideList(selectors) {
    renderItemList(hideList, selectors, (sel) => {
      chrome.storage.local.get({ customHideSelectors: [] }, (r) => {
        const next = r.customHideSelectors.filter((s) => s !== sel);
        chrome.storage.local.set({ customHideSelectors: next }, updateUI);
      });
    });
  }

  // Update popup stats and visual states
  function updateUI() {
    chrome.storage.local.get({
      isEnabled: true,
      isChinaEnabled: false,
      collapseEnabled: true,
      totalBlocked: 0,
      whitelist: [],
      customBlocklist: [],
      customHideSelectors: []
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

      // 3b. Update Collapse Switch
      collapseToggle.checked = settings.collapseEnabled;

      // 3c. Render the list of whitelisted ("paused") sites
      renderManagedList(settings.whitelist);

      // 3d. Render custom block rules + hide selectors
      renderCustomList(settings.customBlocklist);
      renderHideList(settings.customHideSelectors);

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

  // Change Handler: Collapse Toggle. The content script reacts via
  // storage.onChanged, so no message round-trip is needed.
  collapseToggle.addEventListener('change', () => {
    chrome.storage.local.set({ collapseEnabled: collapseToggle.checked });
  });

  // Add a custom block-rule domain.
  function submitCustomRule() {
    const domain = normalizeDomain(customRuleInput.value);
    if (!domain) {
      customRuleInput.focus();
      customRuleInput.select();
      return;
    }
    chrome.runtime.sendMessage({ action: "addCustomRule", domain }, (response) => {
      if (response && response.success) {
        customRuleInput.value = "";
        updateUI();
      } else {
        console.error("Add custom rule failed:", response ? response.error : "Unknown error");
      }
    });
  }
  customRuleAdd.addEventListener('click', submitCustomRule);
  customRuleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitCustomRule(); }
  });

  // Validate a CSS selector by attempting to use it; invalid syntax throws.
  function isValidSelector(sel) {
    try { document.createDocumentFragment().querySelector(sel); return true; }
    catch (_) { return false; }
  }

  // Add a custom element-hiding CSS selector (cosmetic, stored directly).
  function submitHideSelector() {
    const sel = (hideSelectorInput.value || "").trim();
    if (!sel || !isValidSelector(sel)) {
      hideSelectorInput.focus();
      hideSelectorInput.select();
      return;
    }
    chrome.storage.local.get({ customHideSelectors: [] }, (r) => {
      const list = r.customHideSelectors;
      if (!list.includes(sel)) list.push(sel);
      chrome.storage.local.set({ customHideSelectors: list }, () => {
        hideSelectorInput.value = "";
        updateUI();
      });
    });
  }
  hideSelectorAdd.addEventListener('click', submitHideSelector);
  hideSelectorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitHideSelector(); }
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
