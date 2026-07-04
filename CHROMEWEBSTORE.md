# Chrome Web Store Listing — Just Ad Blocker

> Last Updated: 2026-06-27

---

## Store Listing

**Extension Name** [REQUIRED]
```
Just Ad Blocker
```
<!-- Matches manifest.json "name" via __MSG_extName__. 15 characters — well within 75-character limit. -->

---

**Short Description** [REQUIRED]
<!-- Max 132 characters. -->

**English (≤ 132 chars)**
```
Fast, private ad & tracker blocker using Manifest V3 declarativeNetRequest. No analytics. All blocking runs locally.
```

**Alternative (full feature)**
```
Lightweight, fast, privacy-friendly ad & tracker blocker built on Manifest V3. No tracking, no remote servers — all blocking runs locally.
```

---

**Detailed Description** [REQUIRED]
<!-- Max 16,000 characters. CWS strips markdown — use plain text with line breaks. -->

**English**
```
Just Ad Blocker keeps your browsing clean and fast without compromising your privacy.

Built on Manifest V3's declarativeNetRequest engine, it blocks ad and tracker requests at the browser's network layer — so it never collects or transmits your page content, never phones home, and uses almost no memory. A small on-page script tidies the blank space that blocked ads leave behind; it runs entirely on your device and sends nothing anywhere.

FEATURES
* Dual-list protection — AdGuard DNS filter (~150,000 ad/tracker/malware domains) plus EasyList, the industry-standard list for on-page ad blocking.
* Tidy layout — automatically collapses the empty gaps that blocked ads leave behind, so pages don't show blank ad slots. Can be turned off in the popup.
* Optional Chinese ruleset (AdRules) — extra coverage for Asian and Chinese sites, toggled from the popup with a single switch.
* One-click per-site whitelist — pause blocking on any site you trust, plus a list to review and remove paused sites.
* Live block counter — see how many requests were blocked on the current tab and your lifetime total.
* Privacy by design — no analytics, no accounts, no remote code. Everything runs on your device.

HOW TO USE
1. Click the Just Ad Blocker icon in your toolbar to open the popup.
2. Use the main toggle to enable or pause ad blocking globally.
3. To whitelist the current site, click "Pause blocking on this site" in the popup.
4. To enable enhanced filtering for Chinese/Asian websites, expand "Advanced filters" and turn on the AdRules toggle.
5. To block a domain the lists missed, add it under "Custom blocked domains" (covers all subdomains; reload the page after adding). To remove a leftover empty ad slot, add a CSS selector under "Custom hidden elements".

PERMISSIONS
This extension uses only the permissions required to block ads and tidy the resulting layout. It does not collect your browsing history, passwords, or personal data. Network blocking runs as static filter lists inside the browser, and the on-page tidy-up script inspects page layout locally only — nothing is sent externally.

PRIVACY
No data collection. No remote servers. No analytics. Your preferences (on/off state, whitelisted sites) are stored only in your browser's local storage.

SOURCE CODE
Open source and auditable. All filter rules are compiled from publicly available upstream lists (AdGuard DNS filter, EasyList, AdRules).
```

---

**Category** [REQUIRED]
```
Productivity
```

---

**Single Purpose** [REQUIRED]
```
Block advertisements and trackers to provide a faster, more private browsing experience.
```

---

**Primary Language** [REQUIRED]
```
English
```
<!-- Extension also ships zh_TW locale strings -->

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `src/icons/icon128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 4 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 5 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

<!-- Status options: ⬜ Not created | 🟡 Needs update | ✅ Ready -->

### Screenshot Notes
- **Screenshot 1**: Popup showing "Your browsing is protected" with live blocked counter.
- **Screenshot 2**: Popup with "Advanced filters" expanded, showing AdRules toggle.
- **Screenshot 3**: Popup with per-site whitelist activated ("Ad blocking is paused" state).
- **Screenshot 4**: Before/after comparison of a webpage with and without ads.
- **Screenshot 5** (optional): Extension icon badge showing blocked count in toolbar.

---

## Permissions Justification

<!-- Required: every permission in manifest.json must have a specific justification.
     "Required for functionality" will be rejected. -->

| Permission | Type | Justification |
|------------|------|---------------|
| `declarativeNetRequest` | permissions | **Core function.** Enables the extension to block ad and tracker network requests at the browser level using bundled static declarative rules (AdGuard DNS filter + EasyList). Without this permission, no blocking is possible. |
| `storage` | permissions | **User settings persistence.** Stores the global on/off state, per-site whitelist entries, optional AdRules toggle state, and the lifetime blocked-request counter. All data stays on-device and is never transmitted externally. |
| `activeTab` | permissions | **Per-site whitelist UI.** Reads the hostname of the currently active tab so the popup can display whether the current site is whitelisted and offer a one-click toggle. Only accessed when the user explicitly opens the popup. |
| `webNavigation` | permissions | **Block counter accuracy.** Listens to `onBeforeNavigate` events on the main frame to capture and persist the per-tab blocked count before it resets on page navigation. Without this, the lifetime total counter would under-count. |
| `alarms` | permissions | **Periodic counter aggregation (Chrome only).** Schedules a lightweight ~9-second repeating alarm to poll the per-tab badge count and accumulate it into the lifetime total in `chrome.storage`. Replaces `setInterval`, which is unreliable in Manifest V3 service workers. |
| Content script on `http://*/*`, `https://*/*` (host access) | content_scripts | **Cosmetic ad-gap collapse.** Injects a small script (`content/collapse.js`) into web pages to detect elements the filter blocked and remove the empty space they would otherwise leave (so blocked ad slots don't show as blank gaps). It reads only page layout/DOM structure locally to do this; it never reads, collects, or transmits page content, form data, credentials, or browsing history, and makes no network requests. Runs on all sites because ads can appear on any site, and respects the global toggle and per-site whitelist. |

> **Host access via content script.** The extension declares a content script matching `http://*/*` and `https://*/*` (shown to users as "read and change data on the websites you visit"). It is used **only** to collapse the blank space left by blocked ads. No `host_permissions` are declared for network access — all blocking is done by the `declarativeNetRequest` engine using bundled static rules. The content script processes page layout locally and transmits nothing.

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** **No**

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | No | No | — | No |
| Financial info | No | No | — | No |
| Authentication info | No | No | — | No |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | No | No | — | No |
| Website content | No | No | — | No |

### What IS stored locally (on-device only, never transmitted)

| Storage Key | Value Type | Purpose |
|-------------|-----------|---------|
| `isEnabled` | boolean | Global on/off toggle state |
| `isChinaEnabled` | boolean | AdRules (Chinese filter) toggle state |
| `collapseEnabled` | boolean | Whether to collapse the blank space left by blocked ads |
| `totalBlocked` | number | Lifetime blocked request count |
| `whitelist` | string[] | Array of per-site whitelisted domains |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL** [RECOMMENDED — must be live before submitting]

> Host at a stable public URL (e.g., GitHub Pages, Notion, project README).

**Privacy Policy Text (ready to publish):**

```
Privacy Policy for Just Ad Blocker

Last Updated: 2026-06-27

Just Ad Blocker does not collect, store, or transmit any personal data. The extension
contains no analytics libraries, no telemetry, and no remote servers.

The extension makes no outbound network requests of its own. All ad and tracker blocking
is performed locally on your device using static filter rules bundled inside the extension.
No browsing data, URL history, or page content is ever collected or sent anywhere.

To remove the blank space that blocked ads leave behind, the extension runs a small on-page
script that inspects page layout locally and hides the empty ad slots. This processing happens
entirely in your browser; no page content is collected, stored, or transmitted.

User preferences (such as the global enabled state, optional Chinese ruleset toggle, and
per-site whitelist) are stored exclusively in your browser's local storage (chrome.storage.local).
This data never leaves your device.

The only "data" the extension processes is the numeric count of blocked network requests,
which is stored locally and never transmitted.

If you have questions, please open an issue at [your GitHub repo URL].
```

---

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

---

## Developer Info

**Publisher Name** [REQUIRED]
```
[填入發佈者名稱 / Your publisher name]
```

**Contact Email** [REQUIRED — displayed publicly on store listing]
```
[填入公開聯絡信箱 / Your public contact email]
```

**Support URL** [RECOMMENDED]
```
https://github.com/[your-github]/just-ad-blocker/issues
```

**Homepage URL** [RECOMMENDED]
```
https://github.com/[your-github]/just-ad-blocker
```

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.5 | 2026-06 | Collapse blank space left by blocked ads (new on-page content script + host access); collapse on/off toggle; whitelist management list in popup; fixed whitelist rule-ID collisions. | Draft |
| 1.0.4 | 2026-06 | [填入本版本變更摘要] | Draft |
| 1.0.2 | — | Previous release | — |

<!-- Status options: Draft | Submitted | In Review | Published | Rejected -->

---

## Review Notes

### Known Issues / Limitations

- **Firefox badge counter not available**: Firefox does not implement `declarativeNetRequest.setExtensionActionOptions` or `getMatchedRules`, so the per-tab and lifetime blocked-request counter is absent in the Firefox build. Ad blocking works correctly. This is a Firefox platform limitation, not a bug in the extension.
- **`activeTab` usage**: Only triggered on explicit user gesture (opening the popup). Not used for background tab reading.

### Rejection History

| Date | Reason | Fix Applied | Resubmitted |
|------|--------|-------------|-------------|
| — | First submission | — | — |

---

## Pre-Submission Checklist

### Chrome Web Store
- [ ] Chrome Developer Dashboard account verified and $5 registration fee paid
- [ ] Extension ZIP contains only `dist/chrome/` contents (not the full repo)
- [ ] ZIP excludes: `.git/`, `node_modules/`, `.env`, `CHROMEWEBSTORE.md`, `scripts/`, `docs/`, `*.xpi`, root-level `*.zip`
- [ ] All icon sizes present: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
- [ ] Short description ≤ 132 characters ✅
- [ ] Single purpose statement filled in ✅
- [ ] All 5 permissions + the content-script host access have specific justifications ✅
- [ ] Data disclosure: "No data collected" certified ✅
- [ ] Privacy policy URL live and publicly accessible
- [ ] At least 1 screenshot (1280×800 or 640×400)
- [ ] Publisher name and contact email filled in
- [ ] `manifest_version: 3` confirmed ✅
