// 產生商店宣傳影片（26.5 秒 / 1280×800 / H.264）。
//
//   cd scripts/store-assets && npm install     # 只有影片需要 puppeteer-core
//   node scripts/store-assets/video.js
//
// 輸出：scripts/store-assets/.work/just-ad-blocker-promo-1280x800.mp4
// 影片刻意不進版控（repo 不放二進位檔），產生後自行上傳 YouTube；
// Chrome Web Store 只接受 YouTube 網址，Firefox AMO 則沒有影片欄位。
//
// 需求：Google Chrome（或用 CHROME_PATH 指定）、ffmpeg 需在 PATH 上。

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { WORK_DIR, resolveChrome } = require('./common');
const { buildVideoHtml, DURATION, WIDTH, HEIGHT } = require('./video-page');

const FPS = 30;
const FRAMES_DIR = path.join(WORK_DIR, 'frames');
const HTML_PATH = path.join(WORK_DIR, 'video.html');
const OUT_MP4 = path.join(WORK_DIR, 'just-ad-blocker-promo-1280x800.mp4');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  console.error(
    '缺少 puppeteer-core。請先安裝：\n' +
    '  cd scripts/store-assets && npm install\n' +
    '（截圖與宣傳圖塊不需要它，只有影片需要。）'
  );
  process.exit(1);
}

function requireFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.error('找不到 ffmpeg，請先安裝並確認它在 PATH 上（winget install Gyan.FFmpeg）。');
    process.exit(1);
  }
}

(async () => {
  requireFfmpeg();

  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.writeFileSync(HTML_PATH, buildVideoHtml(), 'utf8');

  const browser = await puppeteer.launch({
    executablePath: resolveChrome(),
    headless: 'new',
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.goto('file:///' + HTML_PATH.replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true');

    const total = Math.round(DURATION * FPS);
    console.log(`--- 擷取 ${total} 影格 (${DURATION}s @ ${FPS}fps) ---`);
    for (let i = 0; i < total; i++) {
      // 逐格把畫面設定到指定時間點再截圖，所以擷取速度不影響成品。
      await page.evaluate((t) => window.render(t), i / FPS);
      await page.screenshot({
        path: path.join(FRAMES_DIR, `f${String(i).padStart(5, '0')}.jpg`),
        type: 'jpeg',
        quality: 95,
      });
      if (i % 90 === 0) console.log(`  ${i}/${total}`);
    }
  } finally {
    await browser.close();
  }

  console.log('--- 編碼 H.264 ---');
  execFileSync('ffmpeg', [
    '-y', '-framerate', String(FPS),
    '-i', path.join(FRAMES_DIR, 'f%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-r', String(FPS),
    OUT_MP4,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });

  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  console.log(`${OUT_MP4}  ${(fs.statSync(OUT_MP4).size / 1024 / 1024).toFixed(1)} MB`);
})();
