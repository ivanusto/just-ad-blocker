# 上架逐步指南 — Just Ad Blocker v1.1.3

> 產生日期：2026-07-23。所有文案可直接複製貼上。
> 需要的檔案都在本機專案資料夾裡，路徑以 `D:\Desktop\Code\just-ad-blocker\` 為準。

---

## 一、Chrome Web Store（約 5–8 分鐘）

### 1. 上傳套件

1. 開啟 https://chrome.google.com/webstore/devconsole 並登入
2. 點右上角「**新增項目 / New Item**」
3. 上傳檔案：`just-ad-blocker-chrome-v1.1.3.zip`（專案根目錄）

### 2. 「商店資訊 / Store listing」分頁

| 欄位 | 填入內容 |
|------|----------|
| 說明（Description） | 貼下方【CWS 詳細說明】 |
| 類別（Category） | Productivity |
| 語言 | English |
| 商店圖示 | 已含在 ZIP 內，通常自動帶入（icon128.png） |
| 螢幕截圖 | 上傳 `docs\store-assets\screenshot-1.png`、`screenshot-2.png`、`screenshot-3.png` |
| 小型宣傳圖塊 | 上傳 `docs\store-assets\promo-tile-440x280.png` |
| 官方網址（Homepage） | `https://github.com/ivanusto/just-ad-blocker` |
| 支援網址（Support） | `https://github.com/ivanusto/just-ad-blocker/issues` |

**【CWS 詳細說明】**（英文，貼到 Description）：

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
Open source and auditable: https://github.com/ivanusto/just-ad-blocker
All filter rules are compiled from publicly available upstream lists (AdGuard DNS filter, EasyList, AdRules).
```

### 3. 「隱私權 / Privacy」分頁

**單一用途（Single purpose）**：

```
Block advertisements and trackers to provide a faster, more private browsing experience.
```

**權限用途說明（每個權限一格，逐一貼上）**：

- `declarativeNetRequest`：

```
Core function: blocks ad/tracker network requests at the browser level using bundled static declarative rules (AdGuard DNS filter + EasyList). Without this permission, no blocking is possible.
```

- `storage`：

```
User settings persistence: stores the global on/off state, per-site whitelist, AdRules toggle, collapse toggle, and the lifetime blocked-request counter. All data stays on-device and is never transmitted.
```

- `activeTab`：

```
Per-site whitelist UI: reads the current tab's hostname so the popup can show whitelist status and offer a one-click toggle. Only accessed on explicit user gesture (opening the popup).
```

- `webNavigation`：

```
Block counter accuracy: listens for main-frame navigation events to capture per-tab blocked counts before they reset on navigation, ensuring the lifetime total counter is accurate.
```

- `alarms`：

```
Periodic counter aggregation: runs a ~9-second repeating alarm to poll the tab badge count and accumulate it into chrome.storage, replacing setInterval which is unreliable in MV3 service workers.
```

- **主機權限（Host permission，內容腳本 http/https）**：

```
Cosmetic ad-gap collapse: injects content/collapse.js to detect filter-blocked elements and remove the empty space they leave, so blocked ad slots don't appear as blank gaps. It reads only page layout/DOM locally; it never reads, collects, or transmits page content, form data, or browsing history, and makes no network requests. Applies to all sites because ads can appear anywhere; respects the global toggle and per-site whitelist.
```

**遠端程式碼（Remote code）**：選「**No, I am not using remote code**」

**資料使用（Data usage）**：

- 所有資料類型全部**不勾選**（本擴充功能不蒐集任何資料）
- 三個認證聲明全部**勾選**（不販售資料／不用於無關用途／不用於信用評估）

**隱私權政策 URL**：

```
https://github.com/ivanusto/just-ad-blocker/blob/main/PRIVACY.md
```

### 4. 「發布 / Distribution」分頁

- 付費方式：Free
- 地區：All regions
- 能見度：Public

### 5. 帳號設定（第一次發布前）

- 開發者後台「帳戶 / Account」分頁：聯絡信箱填 `ivanusto@gmail.com` 並完成信箱驗證（會寄驗證信）
- 發布者名稱（Publisher name）：填你想公開顯示的名稱

### 6. 送審

右上角「**提交審查 / Submit for review**」。審查通常 1–3 個工作天（含 host permission 的擴充功能可能稍久）。

---

## 二、Firefox AMO（約 5 分鐘）

### 1. 上傳套件

1. 開啟 https://addons.mozilla.org/developers/ 並登入
2. 點「**Submit a New Add-on**」
3. 發布方式選「**On this site**」（listed，由 AMO 簽署與發布）
4. 上傳檔案：`dist\firefox.xpi`
5. 等驗證通過後點 Continue

### 2. 原始碼問題（Do You Need to Submit Source Code?）

選「**Yes**」並上傳原始碼 ZIP（把整個 repo 打包，或從 GitHub 下載
https://github.com/ivanusto/just-ad-blocker/archive/refs/heads/main.zip 後直接上傳），
或依表單指示提供。同時在「Notes for Reviewers」貼：

```
Source code: https://github.com/ivanusto/just-ad-blocker
Build: python scripts/build.py  (Python 3.9+, no other dependencies)
The JSON rulesets under src/rulesets/ are auto-generated from public upstream
filter lists (AdGuard DNS filter, EasyList, AdRules) by scripts/compile_rules.py.
All JavaScript is unminified.

Note: the blocked-request counter is hidden on Firefox because Firefox has not
implemented declarativeNetRequest.setExtensionActionOptions / getMatchedRules.
Blocking itself works fully.
```

### 3. 商店資訊

| 欄位 | 填入內容 |
|------|----------|
| Name | Just Ad Blocker |
| Summary（≤250 字元） | 貼下方【AMO Summary】 |
| Description | 貼上方【CWS 詳細說明】，結尾加上下方【Firefox 差異備注】 |
| Categories | Privacy & Security |
| Support email | ivanusto@gmail.com |
| Support website | `https://github.com/ivanusto/just-ad-blocker/issues` |
| License | MIT |
| Privacy policy | 貼下方【AMO 隱私政策】 |

**【AMO Summary】**：

```
A lightweight, fast, privacy-friendly ad and tracker blocker built on Manifest V3. Blocks ads and trackers at the network layer using AdGuard DNS filter and EasyList. No tracking, no remote servers — everything runs locally on your device.
```

**【Firefox 差異備注】**（加在 Description 最後）：

```
Note: The blocked-request counter (tab and lifetime total) is not available in the Firefox version. Firefox has not yet implemented the declarativeNetRequest statistics APIs (setExtensionActionOptions / getMatchedRules) that Chrome uses for this feature. Ad and tracker blocking works fully and correctly on Firefox.
```

**【AMO 隱私政策】**：

```
Just Ad Blocker does not collect, store, or transmit any personal data. It contains no analytics and no remote servers, and makes no network requests of its own. User preferences (such as the enabled state and per-site whitelist) are stored only in the browser's local storage on the user's device and never leave the device.

Full policy: https://github.com/ivanusto/just-ad-blocker/blob/main/PRIVACY.md
```

**圖片**：AMO 的截圖沒有固定尺寸限制，可直接上傳 `docs\store-assets\` 的三張截圖。

### 4. 送審

按「Submit Version」完成。AMO 自動審查通常幾分鐘到數小時內就會簽署上架；人工複審可能之後才進行。

---

## 送審後

- 兩邊審查結果都會寄信到 ivanusto@gmail.com
- 若被退件，把退件原因貼給 Claude，我來改
- 之後每次發新版：CWS 上傳新 ZIP → Submit；AMO 上傳新 xpi 即可（文案不用重填）
