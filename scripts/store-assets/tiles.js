// 產生 Chrome Web Store 宣傳圖塊到 docs/store-assets/
//
//   node scripts/store-assets/tiles.js
//
// 440×280 是小型宣傳圖塊（選用但建議），640×400 供其他版位使用。

const path = require('path');
const {
  ASSETS_DIR, iconDataUri, screenshot, tileBackground, FONT_STACK,
} = require('./common');

const ICON = iconDataUri('icon128.png');

function tile({ w, h, icon, title, tagline, gap, sub }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Just Ad Blocker</title><style>
html,body{margin:0;padding:0}
body{
  width:${w}px; height:${h}px; overflow:hidden;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:${gap}px;
  font-family:${FONT_STACK}; color:#40382e;
  background:${tileBackground(w, h)};
}
.logo{
  width:${icon}px; height:${icon}px;
  filter:drop-shadow(0 ${Math.round(icon * 0.09)}px ${Math.round(icon * 0.18)}px rgba(90,111,82,.42));
}
h1{margin:0; font-size:${title}px; font-weight:800; letter-spacing:-.8px; line-height:1.05; white-space:nowrap}
h1 .accent{
  background:linear-gradient(120deg,#5a6f52 0%,#7d8f76 45%,#96684c 100%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
}
p{margin:0; font-size:${tagline}px; font-weight:500; color:#5f5648; letter-spacing:.2px; white-space:nowrap}
.sub{
  margin-top:${Math.round(gap * 0.15)}px;
  font-size:${sub}px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase;
  color:#4c6144; padding:${Math.round(sub * 0.42)}px ${Math.round(sub * 1.1)}px;
  border-radius:999px; background:rgba(125,143,118,.16);
  border:1px solid rgba(125,143,118,.45); white-space:nowrap;
}
</style></head><body>
  <img class="logo" src="${ICON}" alt="">
  <h1>JUST <span class="accent">Ad Blocker</span></h1>
  <p>Fast, private, local ad &amp; tracker blocking</p>
  <div class="sub">Manifest V3 &middot; No tracking</div>
</body></html>`;
}

const tiles = [
  { file: 'promo-tile-440x280', w: 440, h: 280, icon: 62, title: 30, tagline: 13, gap: 12, sub: 9 },
  { file: 'promo-tile-640x400', w: 640, h: 400, icon: 92, title: 44, tagline: 18.5, gap: 18, sub: 12 },
];

console.log('--- 產生宣傳圖塊 ---');
for (const t of tiles) {
  screenshot({
    html: tile(t),
    outPng: path.join(ASSETS_DIR, `${t.file}.png`),
    width: t.w, height: t.h,
  });
}
