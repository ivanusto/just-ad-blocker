# 上架文案 / Store Listing Copy

雙平台（Chrome Web Store、Firefox AMO）上架用文字。中英對照，可直接複製貼上。

---

## Chrome Web Store

### Name（名稱，≤ 75 字元）
```
Just Ad Blocker
```

---

### Summary（簡短說明，≤ 132 字元）

**English**
```
Fast, private ad & tracker blocker using Manifest V3 declarativeNetRequest. No analytics. All blocking runs locally.
```

**繁體中文**（Chrome 亦支援多語言 Summary）
```
小巧、高速且具備隱私保護的廣告與追蹤器攔截程式，採用 Manifest V3。不追蹤、不連外，攔截全在本機完成。
```

---

### Detailed description（詳細說明）

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

PERMISSIONS
This extension uses only the permissions required to block ads and tidy the resulting layout. It does not collect your browsing history, passwords, or personal data. Network blocking runs as static filter lists inside the browser, and the on-page tidy-up script inspects page layout locally only — nothing is sent externally.

PRIVACY
No data collection. No remote servers. No analytics. Your preferences are stored only in your browser's local storage.
```

**繁體中文**
```
Just Ad Blocker 讓你的瀏覽乾淨又快速，同時完整保護隱私。

建構於 Manifest V3 的 declarativeNetRequest 引擎，於瀏覽器網路層直接攔截廣告與追蹤請求——不蒐集也不回傳你的網頁內容、不連外，記憶體占用極低。另有一支頁面內小腳本，負責收合被攔截廣告留下的空白區塊；它完全在你的裝置上執行，不會傳送任何資料。

功能特色
* 雙清單防護——AdGuard DNS filter（約 15 萬個廣告／追蹤／惡意網域）搭配業界標準的 EasyList 頁面廣告清單。
* 版面整潔——自動收合被攔截廣告留下的空白區塊，頁面不再出現空蕩的廣告位。可於彈出視窗關閉。
* 中文規則（AdRules，選用）——針對亞洲／中文網站加強攔截，可於彈出視窗開關。
* 單站白名單一鍵切換——在你信任的網站暫停攔截，並可在清單中檢視、移除已暫停的網站。
* 即時攔截計數——查看目前分頁與累計的攔截數量。
* 隱私優先設計——無分析追蹤、無帳號、無遠端程式碼，全部在本機執行。

使用方式
1. 點擊工具列中的 Just Ad Blocker 圖示開啟彈出視窗。
2. 使用主開關全域啟用或暫停廣告攔截。
3. 若要將目前網站加入白名單，點擊「在此網站暫停攔截」。
4. 若要啟用中文／亞洲網站強化過濾，展開「進階過濾器」並開啟 AdRules 開關。

隱私說明
本擴充功能不蒐集任何資料、不連接遠端伺服器、不含任何分析工具。你的設定（啟用狀態、白名單）僅儲存於本機瀏覽器儲存空間。
```

---

### Category（類別）
```
Productivity
```

---

### Single purpose（單一用途說明，Chrome 必填）
```
Block advertisements and trackers to provide a faster, more private browsing experience.
```

---

### Permission justifications（權限用途說明，Chrome 必填）

| 權限 | 說明 |
|------|------|
| `declarativeNetRequest` | **核心功能**。使用捆綁的靜態宣告式規則（AdGuard DNS filter + EasyList）在瀏覽器層攔截廣告與追蹤器網路請求。無此權限則無法進行任何攔截。 |
| `storage` | **使用者設定持久化**。儲存全域開關狀態、單站白名單、AdRules 切換狀態與累計攔截計數。所有資料留在本機，從不對外傳輸。 |
| `activeTab` | **單站白名單 UI**。讀取目前分頁的主機名稱，讓彈出視窗能顯示該網站是否已白名單，並提供一鍵切換。僅在使用者主動開啟彈出視窗時觸發。 |
| `webNavigation` | **攔截計數精確度**。監聽主框架 `onBeforeNavigate` 事件，在頁面導航重置計數前捕獲並累加分頁攔截數。若無此權限，終身計數將有遺漏。 |
| `alarms` | **定期計數匯總（僅 Chrome）**。建立約每 9 秒觸發一次的輕量定時器，輪詢分頁徽章計數並匯總至 `chrome.storage`。替代在 Manifest V3 Service Worker 中不可靠的 `setInterval`。 |
| 內容腳本 `http://*/*`、`https://*/*`（網站存取） | **收合廣告空位**。注入小腳本（`content/collapse.js`）偵測被過濾器攔截的元素，並移除其留下的空白，使被擋的廣告位不會顯示為空洞。僅於本機讀取頁面版面／DOM 結構，從不讀取、蒐集或傳輸網頁內容、表單資料或瀏覽紀錄，也不發出任何網路請求。因廣告可能出現在任何網站，故套用於所有網站，並遵循全域開關與單站白名單。 |

**English (copy-paste for CWS dashboard)**
```
declarativeNetRequest — Core function: block ad/tracker network requests at the browser level using bundled static declarative rules (AdGuard DNS filter + EasyList). Without this, no blocking occurs.
storage              — User settings persistence: stores global on/off state, per-site whitelist, AdRules toggle, collapse toggle, and lifetime blocked count. All data stays on-device and is never transmitted.
activeTab            — Per-site whitelist UI: reads the current tab's hostname so the popup can show whitelist status and offer a one-click toggle. Only accessed on explicit user gesture (opening popup).
webNavigation        — Block counter accuracy: listens for main-frame navigation events to capture per-tab blocked counts before they reset, ensuring the lifetime total counter is accurate.
alarms               — Periodic counter aggregation (Chrome only): runs a ~9-second repeating alarm to poll the tab badge count and accumulate it into chrome.storage, replacing setInterval which is unreliable in MV3 service workers.
content script (host access on http/https) — Cosmetic ad-gap collapse: injects content/collapse.js to detect filter-blocked elements and remove the empty space they leave, so blocked ad slots don't appear as blank gaps. Reads only page layout/DOM locally; never reads, collects, or transmits page content, form data, or browsing history, and makes no network requests. Applies to all sites because ads can appear anywhere; respects the global toggle and per-site whitelist.
```

---

### Data usage disclosure（資料使用聲明）

**English**
```
This extension does not collect, transmit, or sell any user data. It has no remote servers
and makes no network requests of its own. All settings are stored locally on the user's device
using chrome.storage.local and never leave the device.
```

**繁體中文**
```
本擴充功能不蒐集、傳輸或販售任何使用者資料。沒有遠端伺服器，本身不發出任何網路請求。
所有設定透過 chrome.storage.local 儲存於使用者裝置本機，永遠不會離開裝置。
```

---

## Firefox Add-ons (AMO)

### Name
```
Just Ad Blocker
```

---

### Summary（≤ 250 字元）

**English**
```
A lightweight, fast, privacy-friendly ad and tracker blocker built on Manifest V3. Blocks ads and trackers at the network layer using AdGuard DNS filter and EasyList. No tracking, no remote servers — everything runs locally on your device.
```

**繁體中文**
```
小巧、高速且具備隱私保護的廣告與追蹤器攔截程式，採用 Manifest V3。以 AdGuard DNS filter 與 EasyList 在網路層直接攔截廣告與追蹤。不追蹤、不連外，全部在本機執行。
```

---

### Description（說明）

使用與 Chrome 相同的詳細說明（英文或繁體中文皆可）。

**Firefox 版本差異備注**（建議附加於說明末段）：

**English**
```
Note: The blocked-request counter (tab and lifetime total) is not available in the Firefox
version. Firefox has not yet implemented the declarativeNetRequest statistics APIs
(setExtensionActionOptions / getMatchedRules) that Chrome uses for this feature.
Ad and tracker blocking works fully and correctly on Firefox.
```

**繁體中文**
```
注意：Firefox 版本不顯示「本頁攔截數」與「累計攔截數」。這是因為 Firefox 尚未實作
Chrome 用於此功能的 declarativeNetRequest 統計 API（setExtensionActionOptions /
getMatchedRules）。廣告與追蹤攔截功能在 Firefox 上完全正常運作。
```

---

### Categories（類別）
```
Privacy & Security
```

---

### Tags（標籤）
```
ad blocker, adblock, privacy, tracker blocker, manifest v3, declarativeNetRequest, easylist, adguard
```

---

### License（授權）
```
MIT (extension code). Filter lists remain under their respective licenses:
AdGuard DNS filter, EasyList, AdRules — see their respective repositories.
```

---

### Privacy policy（隱私權政策）

**English**
```
Just Ad Blocker does not collect, store, or transmit any personal data. It contains no
analytics and no remote servers, and makes no network requests of its own. User preferences
(such as the enabled state and per-site whitelist) are stored only in the browser's local
storage on the user's device and never leave the device.
```

**繁體中文**
```
Just Ad Blocker 不會蒐集、儲存或傳輸任何個人資料，不含任何分析工具與遠端伺服器，
本身也不會發出任何網路請求。使用者設定（例如啟用狀態與單站白名單）僅儲存於使用者
裝置的瀏覽器本機儲存空間中，永不對外傳輸。
```

---

### AMO 原始碼提交說明

> Firefox AMO 審查流程要求提供原始碼，尤其當擴充功能包含壓縮或混淆的 JS 時。

- 提交審查時，上傳建置前的原始碼（整個 repo ZIP 或 GitHub 連結）。
- 附上建置指令：`python scripts/build.py`（需要 Python 3.9+）。
- 說明規則檔案（`src/rulesets/*.json`）由 `scripts/compile_rules.py` 從上游清單自動生成。

---

## 上架前檢查清單 / Pre-submission Checklist

### Chrome Web Store
- [ ] 準備截圖：彈出視窗 UI（**必須** 1280×800 或 640×400，最少 1 張，最多 5 張）
- [ ] 準備小型宣傳圖塊（Chrome 440×280，選用但建議）
- [ ] 圖示已含 16/32/48/128 ✅
- [ ] ZIP 只包含 `dist/chrome/` 內容，排除 `.git/`、`scripts/`、`docs/`、根目錄 `*.zip`/`*.xpi`
- [ ] 填寫單一用途（Single purpose）✅
- [ ] 填寫各權限用途（Permission justifications）✅
- [ ] 填寫資料使用揭露（不蒐集任何資料）✅
- [ ] 隱私權政策 URL 已上線且可公開存取
- [ ] 開發者聯絡信箱已填寫（公開顯示）
- [ ] 已繳 Chrome Developer 一次性 $5 USD 費用

### Firefox AMO
- [ ] 選擇「Privacy & Security」類別
- [ ] 填寫隱私權政策（可貼上上方英文版）
- [ ] 附上原始碼（repo ZIP 或 GitHub 連結）及建置說明
- [ ] 正式發佈的 `.xpi` 需先透過 AMO 提交並取得 Mozilla 簽署
- [ ] 若 repo 為私有，需提供審查人員存取權限或改為公開
