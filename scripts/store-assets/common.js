// 商店素材產生器的共用工具：路徑解析、Chrome 偵測、popup 原始碼讀取。
//
// 設計原則：所有素材都用「真實的 popup 標記 + 真實的 popup.css」渲染，
// 不另外重畫 UI。這樣 UI 一改版，重跑腳本就能拿到與實際畫面一致的素材。

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const REPO_DIR = path.resolve(SCRIPT_DIR, '..', '..');
const SRC_DIR = path.join(REPO_DIR, 'src');
const ASSETS_DIR = path.join(REPO_DIR, 'docs', 'store-assets');
const WORK_DIR = path.join(SCRIPT_DIR, '.work'); // 中繼 HTML／影格，已列入 .gitignore

// --- Chrome 位置：環境變數優先，其次各平台常見安裝路徑 ---
const CHROME_CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

function resolveChrome() {
  if (process.env.CHROME_PATH) {
    if (!fs.existsSync(process.env.CHROME_PATH)) {
      throw new Error(`CHROME_PATH 指向的檔案不存在：${process.env.CHROME_PATH}`);
    }
    return process.env.CHROME_PATH;
  }
  for (const p of CHROME_CANDIDATES[process.platform] || []) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(
    '找不到 Chrome。請安裝 Google Chrome，或用 CHROME_PATH 環境變數指定執行檔路徑。'
  );
}

function readPopupCss() {
  return fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.css'), 'utf8');
}

// 圖示一律內嵌成 data URI：渲染時就不必處理相對路徑，也不會有載入時序問題。
function iconDataUri(name) {
  const b64 = fs.readFileSync(path.join(SRC_DIR, 'icons', name)).toString('base64');
  return `data:image/png;base64,${b64}`;
}

// 用 headless Chrome 把一份 HTML 截成固定尺寸的 PNG。
function screenshot({ html, outPng, width, height }) {
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const htmlPath = path.join(WORK_DIR, path.basename(outPng, '.png') + '.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  execFileSync(resolveChrome(), [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    '--virtual-time-budget=3000',
    `--screenshot=${outPng}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });

  const kb = (fs.statSync(outPng).size / 1024).toFixed(0);
  console.log(`  ${path.relative(REPO_DIR, outPng)}  ${width}x${height}  ${kb} KB`);
}

// 莫蘭迪大地色底：與 v1.1.5 起的 popup 淺色主題同一組色票。
const MORANDI_BASE = 'linear-gradient(140deg,#f6f2e9 0%,#ece5d8 52%,#e2dacb 100%)';

// 1280×800 版位（截圖／影片）。光暈刻意偏大偏淡，避免搶掉右側的彈出視窗。
function pageBackground() {
  return `
    radial-gradient(760px 620px at 12% 6%, rgba(125,143,118,.30) 0%, rgba(125,143,118,0) 62%),
    radial-gradient(720px 620px at 96% 92%, rgba(185,138,110,.30) 0%, rgba(185,138,110,0) 62%),
    ${MORANDI_BASE}`;
}

// 宣傳圖塊尺寸小，光暈按比例縮放並略微加濃，縮圖時才看得出層次。
function tileBackground(w, h) {
  return `
    radial-gradient(${w * 0.75}px ${h * 0.9}px at 14% 4%,
      rgba(125,143,118,.34) 0%, rgba(125,143,118,0) 64%),
    radial-gradient(${w * 0.75}px ${h * 0.9}px at 92% 96%,
      rgba(185,138,110,.32) 0%, rgba(185,138,110,0) 64%),
    ${MORANDI_BASE}`;
}

const FONT_STACK =
  `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

module.exports = {
  REPO_DIR, SRC_DIR, ASSETS_DIR, WORK_DIR,
  resolveChrome, readPopupCss, iconDataUri, screenshot,
  pageBackground, tileBackground, FONT_STACK,
};
