# Just Ad Blocker

一個小巧、高速且具備隱私保護的廣告與追蹤器攔截程式，支援 Manifest V3 與高效率規則壓縮。

採用 Chrome / Firefox 的 **declarativeNetRequest (DNR)** 引擎，於瀏覽器核心層直接攔截請求——不需要 `webRequest`、不蒐集也不回傳你的瀏覽內容，效能與隱私兼顧。另含一支頁面內小腳本，僅在本機收合被攔截廣告留下的空位（不傳送任何資料）。

## 功能特色

- **Manifest V3 / DNR**：以宣告式網路規則攔截，無背景常駐攔截器，省電省記憶體。
- **雙清單防護**：
  - [AdGuard DNS filter](https://github.com/AdguardTeam/HostlistsRegistry) — 約 15 萬個廣告／追蹤／惡意網域。
  - [EasyList](https://easylist.to/) — 業界標準的頁面廣告攔截規則（路徑、第一方廣告等）。
- **中文廣告強化規則（選用）**：整合 [AdRules](https://github.com/Cats-Team/AdRules)，針對亞洲／中文網站，可於彈出視窗開關。
- **單站白名單**：在特定網站一鍵暫停攔截，並可在彈出視窗檢視、移除所有已暫停的網站。
- **版面整潔**：自動收合被攔截廣告留下的破圖／空位，可於彈出視窗開關。
- **自訂攔截網域**：在彈出視窗自行加入上游清單漏擋的廣告網域（含所有子網域）。
- **自訂隱藏元素**：以 CSS 選擇器隱藏特定版面元素，收掉腳本式廣告留下的空容器。
- **跨瀏覽器**：同一套原始碼建置出 Chrome 與 Firefox 版本。
- **穩健的規則編譯器**：每條規則在輸出前都會驗證（RE2 相容性、urlFilter／網域合法性、Chrome 2KB regex 上限），避免「整包規則被瀏覽器拒絕」的情況。

## 安裝

### Chrome / Edge（載入未封裝項目）

1. 開啟 `chrome://extensions`
2. 開啟右上角「開發人員模式」
3. 點「載入未封裝項目」，選擇 `dist/chrome` 資料夾

### Firefox

- 臨時載入測試：開啟 `about:debugging#/runtime/this-firefox` → 「載入暫時附加元件」→ 選擇 `dist/firefox.xpi`（或 `dist/firefox/manifest.json`）。
- 永久安裝未簽署的 `.xpi` 需使用 Firefox Developer Edition / Nightly / ESR，並將 `xpinstall.signatures.required` 設為 `false`；正式發佈則需經 [AMO](https://addons.mozilla.org/) 簽署。

> 也可以直接到 [Releases](../../releases) 下載打包好的 `dist/chrome` zip 與 `firefox.xpi`。

## 進階使用：自訂規則與版面整潔

點擊工具列圖示開啟彈出視窗，除了全域開關與單站白名單外，還有以下控制項。

### 自訂攔截網域

上游清單偶爾會漏擋某些廣告／追蹤網域（尤其是地區性的）。在「自訂攔截網域」輸入網域後按「新增」即可攔截：

- 規則為 `||網域^`，**自動涵蓋所有子網域**——例如輸入 `ads.example.com` 會一併擋掉其子網域。
- 輸入會自動正規化（去除 `https://`、路徑、`www.`）。
- 清單中可隨時按 `×` 移除。
- **加入後請重新整理該頁**才會生效（DNR 規則僅對之後的請求生效）。

### 自訂隱藏元素（CSS 選擇器）

有些廣告位是網站預留的固定高度容器，由腳本注入廣告；當攔截掉該腳本後，會留下一塊空容器（沒有破圖可偵測）。此時可用 CSS 選擇器把它隱藏：

- 輸入**標準 CSS 選擇器**（瀏覽器 `querySelector` 支援的語法），例如 `.ad-banner`、`#ad-slot`、`div:has(> .ad-label)`。
- 透過注入樣式表以 `display:none` 隱藏，**即時生效、不需重新整理**；現有與之後動態插入的元素都會套用。
- 全站套用，遵循全域開關與白名單（暫停的網站不隱藏）。
- 新增前會驗證選擇器語法，無效不會儲存。

> ⚠️ 只接受**純 CSS 選擇器**，不要貼上 uBlock／AdGuard 的清單語法：
>
> | 別貼（清單語法） | 改寫成 |
> |---|---|
> | `example.com##.ad-banner` | `.ad-banner` |
> | `##.sponsored` | `.sponsored` |
> | `:has-text(...)`、`:contains(...)`（ExtendedCss） | ❌ 不支援，改用一般選擇器 |

**最快取得選擇器**：對著空位 **右鍵 → 檢查**，在 Elements 面板對該節點 **右鍵 → Copy → Copy selector**，貼進輸入框即可；選擇器太長太脆弱時，挑它的 class／id 簡化。

延伸學習：[AdGuard 自訂過濾規則](https://adguard.com/kb/general/ad-filtering/create-own-filters/)、[uBlock Origin 過濾語法](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax)、[MDN CSS 選擇器](https://developer.mozilla.org/zh-TW/docs/Web/CSS/CSS_selectors)。

## 從原始碼建置

需求：Python 3.9+（產生圖示需要選用套件 `Pillow`，若不重新產生圖示則不需要）。

```bash
python scripts/build.py
```

建置流程：

1. `scripts/compile_rules.py` 下載並編譯上游過濾清單為 DNR 規則（`src/rulesets/*.json`），上游清單快取於 `scripts/.cache/`。
2. 產生圖示（若以環境變數 `LOGO_SRC` 指定來源 PNG；否則沿用 `src/icons/`）。
3. 輸出 `dist/chrome/` 與 `dist/firefox/`，並打包 `dist/firefox.xpi`。

只想重新編譯規則：

```bash
python scripts/compile_rules.py
```

### 切換為「僅使用 EasyList」

編輯 `scripts/compile_rules.py` 中的 `RULESETS`，刪除 `adguard_dns` 來源、保留 `easylist`，再重新建置即可（檔案內有註解說明）。

## 專案結構

```
src/
  manifest.json.template   # 共用 manifest，建置時注入各瀏覽器設定
  background.js            # service worker：規則切換、白名單、統計
  popup/                  # 彈出視窗 UI
  rulesets/               # 編譯後的 DNR 規則（由建置流程產生）
  icons/
scripts/
  compile_rules.py        # ABP → DNR 規則編譯器（含完整驗證）
  build.py                # 建置與打包
dist/                     # 建置輸出（chrome/、firefox/、firefox.xpi）
```

## 已知限制

- **Firefox 不顯示攔截次數**：Chrome 透過 `declarativeNetRequest.setExtensionActionOptions` 將攔截數顯示於圖示徽章，但 Firefox 尚未實作此 API（亦無 `getMatchedRules`／`onRuleMatchedDebug`）。因此 Firefox 版本不顯示「本頁攔截」與「累計攔截」數字，攔截功能本身不受影響。

## 規則來源與授權

過濾清單版權屬於各自維護團隊，依其授權散布：AdGuard DNS filter、EasyList、AdRules。本專案程式碼以 MIT 授權釋出。
