// 產生 5 張 1280×800 商店截圖到 docs/store-assets/screenshot-{1..5}.png
//
//   node scripts/store-assets/screenshots.js
//
// 左側是行銷文案，右側是用真實 popup 標記 + popup.css 渲染的彈出視窗。
// 每張可指定捲動錨點，讓畫面停在對應的功能區塊。

const path = require('path');
const {
  ASSETS_DIR, readPopupCss, iconDataUri, screenshot, pageBackground, FONT_STACK,
} = require('./common');

const W = 1280, H = 800;
const FRAME_W = 320;   // popup 原始寬度
const FRAME_H = 566;   // 取景高度（未縮放）
const SCALE = 1.28;    // 放大到約 410×724，在 1280×800 裡看得清楚

const ICON = iconDataUri('icon32.png');

const sw = (on, disabled) =>
  `<label class="switch${disabled ? ' disabled-switch' : ''}">` +
  `<input type="checkbox"${on ? ' checked' : ''}${disabled ? ' disabled' : ''}>` +
  `<span class="slider"></span></label>`;

const item = (d) =>
  `<li class="managed-item"><span class="managed-domain">${d}</span>` +
  `<button class="managed-remove">&times;</button></li>`;

// popup 標記與 src/popup/popup.html 對齊，只把由 popup.js 動態填入的部分
// （計數、開關狀態、清單）改成靜態值。
function popup(s) {
  return `
<div class="app-container">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>

  <header class="app-header">
    <div class="logo-area">
      <img src="${ICON}" alt="" class="logo-img">
      <span class="logo-text">JUST <span class="logo-accent">AdBlock</span></span>
    </div>
    <div class="status-badge">Enabled</div>
  </header>

  <main class="main-panel">
    <div class="shield-button-container">
      <button class="shield-button active" aria-label="Toggle protection">
        <svg class="shield-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="shield-check" d="M9 11L11 13L15 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="pulse-ring"></div>
      </button>
    </div>
    <p class="status-msg">Your browsing is protected</p>
  </main>

  <section class="stats-grid" id="a-stats">
    <div class="stat-card">
      <div class="stat-value">${s.page}</div>
      <div class="stat-label">Blocked on this tab</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${s.total}</div>
      <div class="stat-label">Total blocked</div>
    </div>
  </section>

  <section class="controls-section">
    <div class="control-row whitelist-row" id="a-whitelist">
      <div class="control-info">
        <div class="control-title">Pause blocking on this site</div>
        <div class="control-subtitle">${s.domain || 'example.com'}</div>
      </div>
      ${sw(s.whitelist)}
    </div>

    <div class="ruleset-container" id="a-filters">
      <div class="section-title">Advanced filters</div>
      <div class="control-row">
        <div class="control-info">
          <div class="control-title">Core protection rules</div>
          <div class="control-subtitle">Blocks core global ad &amp; tracker domains</div>
        </div>
        ${sw(true, true)}
      </div>
      <div class="control-row">
        <div class="control-info">
          <div class="control-title">Chinese ad optimization rules (AdRules)</div>
          <div class="control-subtitle">Enhanced blocking for Asian / Chinese sites</div>
        </div>
        ${sw(s.china)}
      </div>
      <div class="control-row">
        <div class="control-info">
          <div class="control-title">Collapse leftover ad gaps</div>
          <div class="control-subtitle">Remove the empty space left by blocked ads</div>
        </div>
        ${sw(s.collapse !== false)}
      </div>
    </div>

    <div class="ruleset-container" id="a-custom">
      <div class="section-title">Custom blocked domains</div>
      <div class="custom-input-row">
        <input type="text" class="custom-input" placeholder="e.g. ads.example.com">
        <button class="custom-add-btn">Add</button>
      </div>
      <ul class="managed-list">${(s.customDomains || []).map(item).join('')}</ul>
    </div>

    <div class="ruleset-container" id="a-hide">
      <div class="section-title">Custom hidden elements (CSS selectors)</div>
      <div class="custom-input-row">
        <input type="text" class="custom-input" placeholder="e.g. .ad-banner, #ad-slot">
        <button class="custom-add-btn">Add</button>
      </div>
      <ul class="managed-list">${(s.customHides || []).map(item).join('')}</ul>
    </div>

    <div class="ruleset-container" id="a-paused"${(s.pausedSites || []).length ? '' : ' style="display:none;"'}>
      <div class="section-title">Paused sites</div>
      <ul class="managed-list">${(s.pausedSites || []).map(item).join('')}</ul>
    </div>
  </section>

  <footer class="app-footer">
    <div class="footer-info"><span>Status: Active</span></div>
  </footer>
</div>`;
}

function page(slide) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${slide.file}</title>
<style>
${readPopupCss()}

html, body { margin:0; padding:0; }
body {
  width:${W}px; height:${H}px; overflow:hidden;
  background:${pageBackground()};
  color:#40382e; font-family:${FONT_STACK};
}
.stage { display:flex; align-items:center; height:${H}px; }
.copy { width:700px; padding-left:84px; padding-right:28px; }
.eyebrow {
  display:inline-block; font-size:13px; font-weight:700; letter-spacing:1.6px;
  text-transform:uppercase; color:#4c6144; padding:7px 16px; border-radius:999px;
  background:rgba(125,143,118,.16); border:1px solid rgba(125,143,118,.45);
  margin-bottom:26px;
}
h1 {
  font-size:52px; line-height:1.12; font-weight:800; letter-spacing:-1.1px;
  margin:0 0 22px; white-space:nowrap;
}
h1 .accent {
  background:linear-gradient(120deg,#5a6f52 0%,#7d8f76 42%,#96684c 100%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
}
.lede { font-size:19px; line-height:1.6; color:#5f5648; margin:0 0 30px; max-width:540px; }
ul.points { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:15px; }
ul.points li { display:flex; align-items:center; gap:13px; font-size:17.5px; font-weight:600; color:#453d32; }
.tick {
  flex:0 0 26px; width:26px; height:26px; border-radius:50%;
  background:linear-gradient(135deg,#7d8f76,#5a6f52); color:#f9f6ee;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 3px 8px -2px rgba(90,111,82,.6);
}
.tick svg { width:14px; height:14px; }

.device-wrap { flex:1; display:flex; justify-content:center; align-items:center; }
.device {
  width:${FRAME_W}px; height:${FRAME_H}px; overflow:hidden;
  transform:scale(${SCALE}); transform-origin:center center;
  border-radius:18px; border:1px solid rgba(93,80,64,.16);
  box-shadow:0 30px 60px -20px rgba(74,63,50,.45), 0 10px 24px -12px rgba(74,63,50,.35);
  background:#eae4d9;
}
.device .app-container { border:0; min-height:${FRAME_H}px; }
/* 底部留白，讓捲動後的取景可以停在乾淨的區塊邊界而不是被夾在半行 */
.viewport { will-change:transform; padding-bottom:44px; background:#e7e0d3; }
.pulse-ring { animation:none !important; opacity:.55 !important; }
</style></head>
<body>
  <div class="stage">
    <div class="copy">
      <div class="eyebrow">Just Ad Blocker</div>
      <h1>${slide.h1}<br><span class="accent">${slide.h2}</span></h1>
      <p class="lede">${slide.lede}</p>
      <ul class="points">
        ${slide.points.map((p) => `<li><span class="tick"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${p}</li>`).join('\n        ')}
      </ul>
    </div>
    <div class="device-wrap">
      <div class="device"><div class="viewport">${popup(slide.state)}</div></div>
    </div>
  </div>
<script>
(function () {
  var anchor = ${JSON.stringify(slide.anchor || null)};
  if (!anchor) return;
  var vp = document.querySelector('.viewport');
  // .device 有 scale()，getBoundingClientRect 回傳的是縮放後的像素，
  // 但 translateY 走的是版面像素，所以差值要除回去。
  var S = ${SCALE};
  var pad = anchor.pad == null ? 16 : anchor.pad;
  var vpTop = vp.getBoundingClientRect().top;
  var top = (document.querySelector(anchor.sel).getBoundingClientRect().top - vpTop) / S;
  var y = Math.min(Math.max(0, top - pad), Math.max(0, vp.offsetHeight - ${FRAME_H}));

  if (anchor.snap !== false) {
    // 對齊到最近的區塊邊界，捲動後的畫面上緣才不會切在某一列中間。
    var bounds = [0];
    vp.querySelectorAll('.control-row, .section-title').forEach(function (n) {
      bounds.push((n.getBoundingClientRect().top - vpTop) / S - pad);
    });
    var snapped = 0;
    bounds.forEach(function (b) { if (b <= y + 2 && b > snapped) snapped = b; });
    y = snapped;
  }
  vp.style.transform = 'translateY(' + (-Math.max(0, y)) + 'px)';
})();
</script>
</body></html>`;
}

const slides = [
  {
    file: 'screenshot-1',
    h1: 'Block ads &amp; trackers.',
    h2: 'Fast. Private. Local.',
    lede: 'Built on Manifest V3 declarativeNetRequest — all blocking runs inside your browser. No analytics, no accounts, no remote servers.',
    points: ['AdGuard DNS filter + EasyList built in', 'Live blocked-request counters', 'Zero data leaves your device'],
    state: { page: '36', total: '12,483', collapse: true },
  },
  {
    file: 'screenshot-2',
    h1: 'Two industry lists,',
    h2: 'zero configuration.',
    lede: 'Roughly 150,000 ad, tracker and malware domains ship with the extension. Blocked ad slots are collapsed automatically, so pages never show blank gaps.',
    points: ['AdGuard DNS filter + EasyList', 'Automatic ad-gap collapsing', 'Runs at the network layer — barely any memory'],
    state: {
      page: '36', total: '12,483', collapse: true,
      customDomains: ['ads.example.com', 'track.example.net'],
      customHides: ['.ad-banner', '#ad-slot'],
    },
    anchor: { sel: '#a-stats', pad: 14, snap: false },
  },
  {
    file: 'screenshot-3',
    h1: 'Extra coverage,',
    h2: 'when you want it.',
    lede: 'Flip on the AdRules ruleset for stronger filtering on Asian and Chinese sites. One switch, no reload, no extra downloads.',
    points: ['Optional AdRules (Chinese) ruleset', 'Toggle any filter on or off', 'Everything bundled — nothing fetched online'],
    state: { page: '58', total: '12,541', china: true, collapse: true },
    anchor: { sel: '#a-filters', pad: 12 },
  },
  {
    file: 'screenshot-4',
    h1: 'Block anything',
    h2: 'the lists miss.',
    lede: 'Add your own domains to block, or hide a stubborn leftover ad slot with a CSS selector. Your rules stay on your device.',
    points: ['Custom blocked domains (all subdomains)', 'Custom element hiding via CSS selectors', 'Add and remove in one click'],
    state: {
      page: '41', total: '12,610', collapse: true,
      customDomains: ['ads.example.com', 'track.example.net'],
      customHides: ['.ad-banner'],
    },
    anchor: { sel: '#a-custom', pad: 12 },
  },
  {
    file: 'screenshot-5',
    h1: 'Trust a site?',
    h2: 'Pause it in one click.',
    lede: 'Whitelist the current site straight from the popup, then review or remove paused sites any time.',
    points: ['Per-site whitelist toggle', 'Paused-sites list in the popup', 'Global on/off switch'],
    state: {
      page: '0', total: '12,610', whitelist: true, collapse: true, domain: 'example.com',
      pausedSites: ['example.com', 'news.example.org'],
    },
    anchor: { sel: '#a-hide', pad: 12 },
  },
];

console.log('--- 產生商店截圖 (1280x800) ---');
for (const slide of slides) {
  screenshot({
    html: page(slide),
    outPng: path.join(ASSETS_DIR, `${slide.file}.png`),
    width: W, height: H,
  });
}
