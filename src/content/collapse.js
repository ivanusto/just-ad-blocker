// Just Ad Blocker — cosmetic "collapse" pass.
//
// The extension blocks ads at the network layer (declarativeNetRequest), but DNR
// never touches the DOM. So an ad slot whose image/iframe was blocked can leave a
// broken element or — worse — an empty box that the site reserved a fixed height
// for (e.g. TechCrunch's grey "ADVERTISEMENT" gap). This script removes that
// leftover whitespace by collapsing elements that failed to load *because we
// blocked them*, plus any now-empty wrapper that existed only to hold the ad.
//
// Why this stays consistent with the toggle/whitelist without much code: when the
// site is whitelisted or the extension is paused, the background adds an
// allowAllRequests rule (or disables rulesets), so ads load normally, nothing
// errors, and there is nothing to collapse. We still read the settings as a
// safety gate so we don't collapse genuinely-broken site images while paused.

(() => {
  "use strict";

  const COLLAPSE_ATTR = "data-jab-collapsed";
  const MAX_ANCESTOR_DEPTH = 4; // how far up we walk to remove reserved-space wrappers

  // Elements whose failed load is a reliable "this resource was blocked" signal.
  const BLOCKABLE = new Set([
    "IMG", "IFRAME", "EMBED", "OBJECT", "VIDEO", "AUDIO", "SOURCE", "FRAME"
  ]);

  // Don't climb past page structure — collapsing these would break layout.
  const STOP_TAGS = new Set([
    "BODY", "HTML", "MAIN", "ARTICLE", "SECTION", "NAV", "HEADER",
    "FOOTER", "ASIDE", "UL", "OL", "TABLE", "FORM"
  ]);

  // A container whose only text is one of these labels is still "empty" for our
  // purposes (these are the ad-slot captions we want gone with the slot).
  const AD_LABEL_RE =
    /^(advertisement|advertisements|adverts?|sponsored(\s+content)?|sponsor|ad|ads|廣告|赞助|贊助|広告|スポンサー|광고)$/i;

  // active === null until settings load; we buffer events until we know.
  let active = null;
  const queue = [];

  function topHost() {
    try {
      if (window.top === window) return location.hostname;
      return window.top.location.hostname; // same-origin parent chain
    } catch (_) {
      const ao = location.ancestorOrigins;
      if (ao && ao.length) {
        try { return new URL(ao[ao.length - 1]).hostname; } catch (_) { /* ignore */ }
      }
      return location.hostname;
    }
  }

  const stripWww = (h) => (h && h.startsWith("www.") ? h.slice(4) : h);

  function directText(el) {
    let s = "";
    for (const n of el.childNodes) {
      if (n.nodeType === 3) s += n.nodeValue;
    }
    return s.trim();
  }

  // True if `el` still has something worth showing once its collapsed children
  // are ignored. Used to decide whether to keep climbing.
  function hasMeaningfulContent(el) {
    for (const child of el.children) {
      if (child.hasAttribute(COLLAPSE_ATTR)) continue;
      const tag = child.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "NOSCRIPT") continue;
      const r = child.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) return true;
    }
    const txt = directText(el);
    if (txt && !AD_LABEL_RE.test(txt)) return true;
    return false;
  }

  function markCollapsed(el) {
    if (el.hasAttribute(COLLAPSE_ATTR)) return;
    el.setAttribute(COLLAPSE_ATTR, "");
    el.style.setProperty("display", "none", "important");
  }

  // Collapse the blocked element, then walk up collapsing wrappers that exist
  // only to reserve the ad's space.
  function collapseChain(el) {
    let node = el;
    let depth = 0;
    while (node && depth <= MAX_ANCESTOR_DEPTH) {
      const parent = node.parentElement;
      markCollapsed(node);
      if (!parent || STOP_TAGS.has(parent.tagName)) break;
      // `node` is now collapsed; if the parent has nothing else meaningful, it
      // was just the ad's reserved box — collapse it too on the next loop.
      if (hasMeaningfulContent(parent)) break;
      node = parent;
      depth++;
    }
  }

  function onBlocked(el) {
    if (active === false) return;
    if (el.hasAttribute(COLLAPSE_ATTR)) return;
    if (active === null) { queue.push(el); return; }
    collapseChain(el);
  }

  // Resource load errors don't bubble, but a capturing listener on window still
  // receives them — including for elements added after this script ran.
  window.addEventListener("error", (e) => {
    const el = e.target;
    if (el && el.nodeType === 1 && BLOCKABLE.has(el.tagName)) onBlocked(el);
  }, true);

  // Catch images that already finished failing before this listener attached.
  function sweep() {
    document.querySelectorAll("img").forEach((img) => {
      if (img.hasAttribute(COLLAPSE_ATTR)) return;
      if (img.complete && img.naturalWidth === 0 && (img.currentSrc || img.getAttribute("src"))) {
        onBlocked(img);
      }
    });
  }

  // --- User-defined element hiding (CSS cosmetic filtering) ----------------
  // We inject a single <style> with `selector { display:none !important }` for
  // each user selector. CSS handles current and future matches automatically, so
  // no per-element JS or MutationObserver is needed. Hiding is gated on
  // isEnabled + whitelist (independent of the collapse toggle, since the user
  // explicitly chose these selectors).
  let hideStyleEl = null;
  function applyHideSelectors(selectors, hideActive) {
    const list = (hideActive && Array.isArray(selectors)) ? selectors.filter(Boolean) : [];
    if (list.length === 0) {
      if (hideStyleEl) { hideStyleEl.remove(); hideStyleEl = null; }
      return;
    }
    // One rule per selector: an invalid selector only drops its own rule.
    const css = list.map((s) => `${s}{display:none !important;}`).join("\n");
    if (!hideStyleEl) {
      hideStyleEl = document.createElement("style");
      hideStyleEl.setAttribute("data-jab-hide", "");
      (document.head || document.documentElement).appendChild(hideStyleEl);
    }
    hideStyleEl.textContent = css;
  }

  const SETTINGS_DEFAULTS = {
    isEnabled: true, collapseEnabled: true, whitelist: [], customHideSelectors: []
  };

  // Resolve the active/whitelist gate, apply hide selectors, flush buffered events.
  try {
    chrome.storage.local.get(SETTINGS_DEFAULTS, (s) => {
      if (chrome.runtime.lastError) { active = false; queue.length = 0; return; }
      const host = stripWww(topHost() || "");
      const notWhitelisted = !s.whitelist.includes(host);
      active = !!s.isEnabled && !!s.collapseEnabled && notWhitelisted;
      applyHideSelectors(s.customHideSelectors, !!s.isEnabled && notWhitelisted);
      if (active) queue.forEach(collapseChain);
      queue.length = 0;
    });
  } catch (_) {
    active = false; // no storage access -> fail safe (collapse nothing)
  }

  // React to settings changing while the page is open. Collapse changes only
  // affect future events; hide-selector changes re-apply live via the stylesheet.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!("isEnabled" in changes) && !("collapseEnabled" in changes) &&
          !("whitelist" in changes) && !("customHideSelectors" in changes)) return;
      chrome.storage.local.get(SETTINGS_DEFAULTS, (s) => {
        if (chrome.runtime.lastError) return;
        const host = stripWww(topHost() || "");
        const notWhitelisted = !s.whitelist.includes(host);
        active = !!s.isEnabled && !!s.collapseEnabled && notWhitelisted;
        applyHideSelectors(s.customHideSelectors, !!s.isEnabled && notWhitelisted);
      });
    });
  } catch (_) { /* ignore */ }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sweep, { once: true });
  } else {
    sweep();
  }
})();
