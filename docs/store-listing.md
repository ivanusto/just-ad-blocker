# 上架文案 / Store Listing Copy

雙平台（Chrome Web Store、Firefox AMO）上架用文字。中英對照，可直接複製貼上。

---

## Chrome Web Store

### Name（名稱，≤ 75 字元）
```
Just Ad Blocker
```

### Summary（簡短說明，≤ 132 字元）

**English**
```
Lightweight, fast, privacy-friendly ad & tracker blocker built on Manifest V3. No tracking, no remote servers — all blocking runs locally.
```

**繁體中文**
```
小巧、高速且具備隱私保護的廣告與追蹤器攔截程式，採用 Manifest V3。不追蹤、不連外，攔截全在本機完成。
```

### Detailed description（詳細說明）

**English**
```
Just Ad Blocker keeps your browsing clean and fast without compromising your privacy.

Built entirely on Manifest V3's declarativeNetRequest engine, it blocks ad and tracker
requests at the browser's network layer — so it never reads your page content, never
phones home, and uses almost no memory.

FEATURES
• Dual-list protection — AdGuard DNS filter (~150,000 ad/tracker/malware domains) plus
  EasyList, the industry-standard list for on-page ad blocking.
• Optional Chinese ruleset (AdRules) — extra coverage for Asian / Chinese sites, toggled
  from the popup.
• One-click per-site whitelist — pause blocking on any site you trust.
• Live block counter — see how many requests were blocked on the current tab and in total.
• Privacy by design — no analytics, no accounts, no remote code. Everything runs on device.

Lightweight, transparent, and open about exactly what it blocks.
```

**繁體中文**
```
Just Ad Blocker 讓你的瀏覽乾淨又快速，同時完整保護隱私。

完全建構於 Manifest V3 的 declarativeNetRequest 引擎，於瀏覽器網路層直接攔截廣告與追蹤
請求——不讀取你的網頁內容、不回傳任何資料，記憶體占用極低。

功能特色
• 雙清單防護——AdGuard DNS filter（約 15 萬個廣告／追蹤／惡意網域）搭配業界標準的
  EasyList 頁面廣告清單。
• 中文規則（AdRules，選用）——針對亞洲／中文網站加強攔截，可於彈出視窗開關。
• 單站白名單一鍵切換——在你信任的網站暫停攔截。
• 即時攔截計數——查看目前分頁與累計的攔截數量。
• 隱私優先設計——無分析追蹤、無帳號、無遠端程式碼，全部在本機執行。

小巧、透明，並對「攔截了什麼」完全公開。
```

### Category（類別）
```
Productivity
```

### Single purpose（單一用途說明，Chrome 必填）
```
Block advertisements and trackers to provide a faster, more private browsing experience.
```

### Permission justifications（權限用途說明，Chrome 必填）
```
declarativeNetRequest — Core function: block ad/tracker network requests using bundled static rules.
storage              — Save user settings (on/off state, per-site whitelist, optional ruleset toggle, blocked total).
activeTab            — Read the current tab's domain to offer the per-site whitelist toggle.
webNavigation        — Detect page navigations to reset and track the per-tab blocked counter.
alarms               — Run a periodic timer to aggregate the per-tab blocked count into the lifetime total.
```

### Data usage disclosure（資料使用聲明）
```
This extension does not collect, transmit, or sell any user data. It has no remote servers
and makes no network requests of its own. All settings are stored locally on the user's device.
```

---

## Firefox Add-ons (AMO)

### Name
```
Just Ad Blocker
```

### Summary（≤ 250 字元）

**English**
```
A lightweight, fast, privacy-friendly ad and tracker blocker built on Manifest V3. Blocks ads and trackers at the network layer using AdGuard DNS filter and EasyList. No tracking, no remote servers — everything runs locally on your device.
```

**繁體中文**
```
小巧、高速且具備隱私保護的廣告與追蹤器攔截程式，採用 Manifest V3。以 AdGuard DNS filter 與 EasyList 在網路層直接攔截廣告與追蹤。不追蹤、不連外，全部在本機執行。
```

### Description（說明）

同 Chrome 的詳細說明（見上，中英文皆可使用）。

> 注意：Firefox 版本不顯示「本頁／累計攔截」數字，因為 Firefox 尚未實作對應的
> declarativeNetRequest 統計 API（setExtensionActionOptions / getMatchedRules）。
> 攔截功能本身完全正常。建議在 AMO 說明末段加註此差異。

### Categories（類別）
```
Privacy & Security
```

### Tags（標籤）
```
ad blocker, adblock, privacy, tracker blocker, manifest v3, declarativeNetRequest
```

### License（授權）
```
MIT (extension code). Filter lists remain under their respective licenses
(AdGuard DNS filter, EasyList, AdRules).
```

### Privacy policy（隱私權政策，可直接使用）

**English**
```
Just Ad Blocker does not collect, store, or transmit any personal data. It contains no
analytics and no remote servers, and makes no network requests of its own. User preferences
(such as the enabled state and per-site whitelist) are stored only in the browser's local
storage on the user's device.
```

**繁體中文**
```
Just Ad Blocker 不會蒐集、儲存或傳輸任何個人資料，不含任何分析工具與遠端伺服器，
本身也不會發出任何網路請求。使用者設定（例如啟用狀態與單站白名單）僅儲存於使用者
裝置的瀏覽器本機儲存空間中。
```

---

## 上架前檢查清單 / Pre-submission checklist

- [ ] 準備截圖：彈出視窗 UI（建議 1280×800，Chrome 需要 1–5 張）。
- [ ] 準備小型宣傳圖塊（Chrome 440×280，選用）。
- [ ] 圖示已含 16/32/48/128（已具備）。
- [ ] Chrome：填寫單一用途、各權限用途、資料使用揭露。
- [ ] Firefox：選擇「Privacy & Security」類別、填寫隱私權政策、附上原始碼連結（私有 repo 需提供審查存取或改為公開）。
- [ ] Firefox 正式發佈的 `.xpi` 需經 AMO 簽署。
```
