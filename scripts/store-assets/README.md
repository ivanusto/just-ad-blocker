# 商店素材產生器 / Store asset generators

用**真實的 popup 標記與 `src/popup/popup.css`** 渲染上架素材，所以截圖與影片永遠跟實際 UI 一致。
popup 改版後重跑一次即可，不需要手動重截或修圖。

## 需求

| | 需要什麼 |
|---|---|
| 截圖、宣傳圖塊 | Google Chrome（零 npm 相依） |
| 影片 | 另外需要 `puppeteer-core` 與 PATH 上的 `ffmpeg` |

Chrome 會自動偵測常見安裝位置；找不到時用 `CHROME_PATH` 指定執行檔。

## 用法

```bash
# 截圖 5 張 + 宣傳圖塊 2 張 → docs/store-assets/
node scripts/store-assets/screenshots.js
node scripts/store-assets/tiles.js

# 影片（先安裝相依）
cd scripts/store-assets && npm install
node video.js
```

## 產出

| 檔案 | 尺寸 | 用途 |
|---|---|---|
| `docs/store-assets/screenshot-{1..5}.png` | 1280×800 | CWS 截圖（最多 5 張）、AMO Images |
| `docs/store-assets/promo-tile-440x280.png` | 440×280 | CWS 小型宣傳圖塊 |
| `docs/store-assets/promo-tile-640x400.png` | 640×400 | 其他版位 |
| `scripts/store-assets/.work/*.mp4` | 1280×800 / 26.5s | 宣傳影片，**不進版控** |

影片需自行上傳 YouTube 再把網址填進 CWS —— CWS 不接受直接上傳影片檔，AMO 則沒有影片欄位。

## 檔案

- `common.js` — 路徑解析、Chrome 偵測、popup 原始碼讀取、共用色票
- `screenshots.js` — 5 張截圖，各自指定捲動錨點停在對應功能區塊
- `tiles.js` — 兩張宣傳圖塊
- `video-page.js` — 動畫頁面；畫面是時間的純函數（`window.render(t)`），
  不用 CSS transition，因此逐格擷取不會掉格或漂移，重跑結果一致
- `video.js` — 逐格擷取 + ffmpeg 編碼

## 維護注意

素材裡的 UI 狀態必須忠實反映 `src/popup/popup.js` 的行為。例如徽章與狀態文字
只跟**全域**開關連動，把單一網站加入白名單並不會讓它變成 Paused；影片裡刻意
維持 Enabled，白名單的回饋是「Paused sites」區塊出現。改動這些腳本時請對照
`updateUI()` 確認。
