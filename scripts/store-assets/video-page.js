// 建構宣傳影片用的動畫頁面。
//
// 關鍵設計：畫面完全是時間的純函數 —— window.render(t) 會依 t 設定所有樣式，
// 完全不依賴 CSS transition / animation 或 wall-clock。因此逐格擷取時
// 想跑多快就多快，不會有掉格或時間漂移，重跑也一定得到同樣的影格。

const { readPopupCss, iconDataUri, pageBackground, FONT_STACK } = require('./common');

const WIDTH = 1280;
const HEIGHT = 800;
const FRAME_H = 566;
const SCALE = 1.28;
const DURATION = 26.5; // 秒

// 影片裡的開關要能逐格插值，所以用帶有真實 knob 元素的版本取代
// popup.css 的 checkbox 開關（外觀刻意做到一致）。
const row = (title, sub, id) => `
<div class="control-row">
  <div class="control-info">
    <div class="control-title">${title}</div>
    <div class="control-subtitle">${sub}</div>
  </div>
  <div class="vswitch"${id ? ` id="${id}"` : ''}><div class="vknob"></div></div>
</div>`;

function buildVideoHtml() {
  const ICON32 = iconDataUri('icon32.png');
  const ICON128 = iconDataUri('icon128.png');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Just Ad Blocker — promo</title><style>
${readPopupCss()}

html,body{margin:0;padding:0}
body{
  width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;
  font-family:${FONT_STACK}; color:#40382e;
  background:${pageBackground()};
}
.stage{display:flex;align-items:center;height:${HEIGHT}px}
.copy{width:700px;padding-left:84px;padding-right:28px;position:relative;height:420px}
.copy-block{position:absolute;top:0;left:84px;right:28px;opacity:0}
.eyebrow{display:inline-block;font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;
  color:#4c6144;padding:7px 16px;border-radius:999px;background:rgba(125,143,118,.16);
  border:1px solid rgba(125,143,118,.45);margin-bottom:26px}
h1{font-size:52px;line-height:1.12;font-weight:800;letter-spacing:-1.1px;margin:0 0 22px;white-space:nowrap}
h1 .accent{background:linear-gradient(120deg,#5a6f52 0%,#7d8f76 42%,#96684c 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.lede{font-size:19px;line-height:1.6;color:#5f5648;margin:0;max-width:560px}

.device-wrap{flex:1;display:flex;justify-content:center;align-items:center;position:relative}
.device{width:320px;height:${FRAME_H}px;overflow:hidden;transform:scale(${SCALE});
  transform-origin:center center;border-radius:18px;border:1px solid rgba(93,80,64,.16);
  box-shadow:0 30px 60px -20px rgba(74,63,50,.45),0 10px 24px -12px rgba(74,63,50,.35);
  background:#eae4d9}
.device .app-container{border:0;min-height:${FRAME_H}px}
.viewport{padding-bottom:120px;background:#e7e0d3}
.pulse-ring{animation:none!important}

.vswitch{position:relative;flex:0 0 36px;width:36px;height:20px;border-radius:20px;
  background-color:#d6cec0;border:1px solid rgba(93,80,64,.15)}
.vknob{position:absolute;height:12px;width:12px;left:3px;bottom:3px;border-radius:50%;
  background-color:#f7f3ea;box-shadow:0 1px 2px rgba(93,80,64,.3)}

/* 游標與點擊漣漪必須是 fixed：它們的座標來自 getBoundingClientRect（視窗座標） */
.cursor{position:fixed;width:20px;height:20px;border-radius:50%;
  background:rgba(64,56,46,.55);border:2px solid rgba(255,255,255,.9);
  box-shadow:0 3px 10px rgba(74,63,50,.4);pointer-events:none;opacity:0;
  transform:translate(-50%,-50%);z-index:50}
.ripple{position:fixed;width:16px;height:16px;border-radius:50%;
  border:2px solid rgba(90,111,82,.8);pointer-events:none;opacity:0;
  transform:translate(-50%,-50%);z-index:49}

.card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:22px;z-index:100;pointer-events:none;
  background:${pageBackground()}}
.card img{width:132px;height:132px;filter:drop-shadow(0 12px 26px rgba(90,111,82,.4))}
.card h2{margin:0;font-size:62px;font-weight:800;letter-spacing:-1.4px}
.card h2 .accent{background:linear-gradient(120deg,#5a6f52 0%,#7d8f76 45%,#96684c 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card p{margin:0;font-size:22px;color:#5f5648;font-weight:500}
.card .chip{font-size:13px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#4c6144;
  padding:9px 20px;border-radius:999px;background:rgba(125,143,118,.16);
  border:1px solid rgba(125,143,118,.45)}
</style></head><body>

<div class="stage">
  <div class="copy">
    <div class="copy-block" data-scene="A">
      <div class="eyebrow">Just Ad Blocker</div>
      <h1>Block ads &amp; trackers.<br><span class="accent">Fast. Private. Local.</span></h1>
      <p class="lede">Manifest V3 declarativeNetRequest. AdGuard DNS filter + EasyList, bundled and running entirely inside your browser.</p>
    </div>
    <div class="copy-block" data-scene="B">
      <div class="eyebrow">Advanced filters</div>
      <h1>Extra coverage,<br><span class="accent">when you want it.</span></h1>
      <p class="lede">Turn on the AdRules ruleset for stronger filtering on Asian and Chinese sites. One switch, nothing downloaded.</p>
    </div>
    <div class="copy-block" data-scene="C">
      <div class="eyebrow">Your own rules</div>
      <h1>Block anything<br><span class="accent">the lists miss.</span></h1>
      <p class="lede">Add a domain to block, or hide a leftover ad slot with a CSS selector. Your rules never leave your device.</p>
    </div>
    <div class="copy-block" data-scene="D">
      <div class="eyebrow">Per-site control</div>
      <h1>Trust a site?<br><span class="accent">Pause it in one click.</span></h1>
      <p class="lede">Whitelist the current site from the popup, then review or remove paused sites any time.</p>
    </div>
  </div>

  <div class="device-wrap">
    <div class="device"><div class="viewport" id="vp">
      <div class="app-container">
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>

        <header class="app-header">
          <div class="logo-area">
            <img src="${ICON32}" alt="" class="logo-img">
            <span class="logo-text">JUST <span class="logo-accent">AdBlock</span></span>
          </div>
          <div class="status-badge" id="badge">Enabled</div>
        </header>

        <main class="main-panel">
          <div class="shield-button-container">
            <button class="shield-button active">
              <svg class="shield-icon" viewBox="0 0 24 24" fill="none">
                <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 11L11 13L15 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="pulse-ring" id="pulse"></div>
          </div>
          <p class="status-msg" id="statusMsg">Your browsing is protected</p>
        </main>

        <section class="stats-grid" id="a-stats">
          <div class="stat-card"><div class="stat-value" id="pageCount">0</div>
            <div class="stat-label">Blocked on this tab</div></div>
          <div class="stat-card"><div class="stat-value" id="totalCount">0</div>
            <div class="stat-label">Total blocked</div></div>
        </section>

        <section class="controls-section">
          <div class="control-row whitelist-row" id="a-whitelist">
            <div class="control-info">
              <div class="control-title">Pause blocking on this site</div>
              <div class="control-subtitle">example.com</div>
            </div>
            <div class="vswitch" id="swWhitelist"><div class="vknob"></div></div>
          </div>

          <div class="ruleset-container" id="a-filters">
            <div class="section-title">Advanced filters</div>
            ${row('Core protection rules', 'Blocks core global ad &amp; tracker domains', 'swCore')}
            ${row('Chinese ad optimization rules (AdRules)', 'Enhanced blocking for Asian / Chinese sites', 'swChina')}
            ${row('Collapse leftover ad gaps', 'Remove the empty space left by blocked ads', 'swCollapse')}
          </div>

          <div class="ruleset-container" id="a-custom">
            <div class="section-title">Custom blocked domains</div>
            <div class="custom-input-row">
              <input type="text" class="custom-input" id="customInput" placeholder="e.g. ads.example.com">
              <button class="custom-add-btn" id="addBtn">Add</button>
            </div>
            <ul class="managed-list" id="customList"></ul>
          </div>

          <div class="ruleset-container" id="a-hide">
            <div class="section-title">Custom hidden elements (CSS selectors)</div>
            <div class="custom-input-row">
              <input type="text" class="custom-input" placeholder="e.g. .ad-banner, #ad-slot">
              <button class="custom-add-btn">Add</button>
            </div>
            <ul class="managed-list"></ul>
          </div>

          <div class="ruleset-container" id="a-paused" style="display:none">
            <div class="section-title">Paused sites</div>
            <ul class="managed-list" id="pausedList"></ul>
          </div>
        </section>

        <footer class="app-footer"><div class="footer-info"><span>Status: Active</span></div></footer>
      </div>
    </div></div>
    <div class="cursor" id="cursor"></div>
    <div class="ripple" id="ripple"></div>
  </div>
</div>

<div class="card" id="titleCard">
  <img src="${ICON128}" alt="">
  <h2>JUST <span class="accent">Ad Blocker</span></h2>
  <p>Fast, private, local ad &amp; tracker blocking</p>
  <div class="chip">Manifest V3 &middot; No tracking</div>
</div>

<div class="card" id="endCard" style="opacity:0">
  <img src="${ICON128}" alt="">
  <h2>JUST <span class="accent">Ad Blocker</span></h2>
  <p>No analytics. No accounts. No remote servers.</p>
  <div class="chip">Free &amp; open source &middot; MPL-2.0</div>
</div>

<script>
(function () {
  var SCALE = ${SCALE}, FRAME_H = ${FRAME_H};
  var vp = document.getElementById('vp');
  var $ = function (id) { return document.getElementById(id); };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  // t 在 [a, b] 區間內的正規化 + 緩動進度
  function seg(t, a, b) { return ease(clamp((t - a) / (b - a), 0, 1)); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function mix(c1, c2, p) {
    return 'rgb(' + c1.map(function (v, i) { return Math.round(lerp(v, c2[i], p)); }).join(',') + ')';
  }

  // 捲動錨點只量一次（此時 viewport 還沒被 transform）。
  // .device 有 scale()，rect 是縮放後的像素，要除回版面像素。
  var vpTop = vp.getBoundingClientRect().top;
  var MAXY = Math.max(0, vp.offsetHeight - FRAME_H);
  function anchorOf(sel) {
    var el = document.querySelector(sel);
    return Math.min(Math.max(0, (el.getBoundingClientRect().top - vpTop) / SCALE - 14), MAXY);
  }
  var P = {
    top: 0,
    filters: anchorOf('#a-filters'),
    custom: anchorOf('#a-custom'),
    whitelist: anchorOf('#a-whitelist'),
    paused: anchorOf('#a-hide')
  };

  var OFF = [214, 206, 192], ON = [125, 143, 118];
  function setSwitch(el, p) {
    el.style.backgroundColor = mix(OFF, ON, p);
    el.style.borderColor = p > .5 ? 'rgba(90,111,82,.6)' : 'rgba(93,80,64,.15)';
    el.querySelector('.vknob').style.transform = 'translateX(' + (16 * p) + 'px)';
  }

  var DOMAIN = 'ads.example.com';
  function itemHtml(d) {
    return '<li class="managed-item"><span class="managed-domain">' + d +
           '</span><button class="managed-remove">&times;</button></li>';
  }
  function centreOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  window.render = function (t) {
    // ---- 捲動 ---------------------------------------------------------
    var y = P.top;
    y = lerp(y, P.filters, seg(t, 7.6, 8.7));
    y = lerp(y, P.custom, seg(t, 12.1, 13.1));
    y = lerp(y, P.whitelist, seg(t, 17.6, 18.7));
    y = lerp(y, P.paused, seg(t, 20.6, 21.6));
    vp.style.transform = 'translateY(' + -y + 'px)';

    // ---- 攔截計數 -----------------------------------------------------
    var cp = seg(t, 4.0, 6.2);
    $('pageCount').textContent = Math.round(lerp(0, 36, cp));
    $('totalCount').textContent = Math.round(lerp(0, 12483, cp)).toLocaleString('en-US');

    // ---- 盾牌脈動（每 2.5 秒一輪，由 t 決定所以可重現）----------------
    var ph = (t % 2.5) / 2.5;
    $('pulse').style.transform = 'scale(' + lerp(0.9, 1.35, ph) + ')';
    $('pulse').style.opacity = String(lerp(0.8, 0, ph));

    // ---- 開關 ---------------------------------------------------------
    setSwitch($('swCore'), 1);
    $('swCore').style.opacity = '.6';       // Core 規則在真實 UI 是停用狀態
    setSwitch($('swCollapse'), 1);
    setSwitch($('swChina'), seg(t, 9.9, 10.25));
    setSwitch($('swWhitelist'), seg(t, 19.2, 19.55));

    // 徽章與狀態文字只跟「全域」開關連動；把單一網站加入白名單時它們仍是
    // Enabled（見 src/popup/popup.js 的 updateUI）。白名單的實際回饋是
    // 「Paused sites」區塊出現，所以這裡刻意不動徽章。

    // ---- 輸入自訂網域並新增 --------------------------------------------
    var typed = Math.round(clamp((t - 13.6) / 1.6, 0, 1) * DOMAIN.length);
    var input = $('customInput');
    input.value = t < 16.6 ? DOMAIN.slice(0, typed) : '';
    input.style.borderColor = (t > 13.5 && t < 16.6) ? 'rgba(125,143,118,.7)' : 'rgba(93,80,64,.16)';
    $('customList').innerHTML = t >= 16.6 ? itemHtml(DOMAIN) : '';

    // ---- 已暫停的網站 --------------------------------------------------
    if (t >= 19.9) {
      $('a-paused').style.display = '';
      $('pausedList').innerHTML = itemHtml('example.com');
    } else {
      $('a-paused').style.display = 'none';
      $('pausedList').innerHTML = '';
    }

    // ---- 彈窗入場（必須在游標量測之前套用，否則 centreOf 會讀到上一格的
    //      transform，導致游標偏移）-------------------------------------
    var dev = document.querySelector('.device');
    var devIn = seg(t, 2.9, 3.9);
    dev.style.opacity = String(devIn);
    dev.style.transform = 'scale(' + SCALE + ') translateY(' + lerp(34, 0, devIn) + 'px)';

    // ---- 游標與點擊漣漪 ------------------------------------------------
    var cursor = $('cursor'), ripple = $('ripple');
    var clicks = [
      { at: 10.1, target: '#swChina', from: 9.1 },
      { at: 16.5, target: '#addBtn', from: 15.6 },
      { at: 19.4, target: '#swWhitelist', from: 18.6 }
    ];
    var shown = false;
    for (var i = 0; i < clicks.length; i++) {
      var c = clicks[i];
      if (t < c.from - 0.4 || t > c.at + 1.1) continue;
      var pt = centreOf(document.querySelector(c.target));
      var appear = clamp((t - (c.from - 0.4)) / 0.4, 0, 1);
      var fade = 1 - clamp((t - (c.at + 0.6)) / 0.5, 0, 1);
      var mv = seg(t, c.from - 0.4, c.at);   // 從左下方移入，看起來像刻意的操作
      cursor.style.left = lerp(pt.x - 90, pt.x, mv) + 'px';
      cursor.style.top = lerp(pt.y + 70, pt.y, mv) + 'px';
      cursor.style.opacity = String(Math.min(appear, fade));
      var press = clamp((t - c.at) / 0.12, 0, 1);
      cursor.style.width = cursor.style.height = lerp(20, 15, press < 1 ? press : 0) + 'px';
      if (t >= c.at && t <= c.at + 0.55) {
        var rp = (t - c.at) / 0.55;
        ripple.style.left = pt.x + 'px';
        ripple.style.top = pt.y + 'px';
        ripple.style.width = ripple.style.height = lerp(16, 64, rp) + 'px';
        ripple.style.opacity = String(1 - rp);
      } else {
        ripple.style.opacity = '0';
      }
      shown = true;
    }
    if (!shown) { cursor.style.opacity = '0'; ripple.style.opacity = '0'; }

    // ---- 左側文案分鏡 --------------------------------------------------
    var scenes = { A: [3.2, 7.4], B: [7.9, 11.9], C: [12.4, 17.4], D: [17.9, 22.4] };
    Object.keys(scenes).forEach(function (k) {
      var s = scenes[k], el = document.querySelector('.copy-block[data-scene="' + k + '"]');
      var inP = seg(t, s[0], s[0] + 0.55);
      var outP = seg(t, s[1], s[1] + 0.4);
      el.style.opacity = String(inP * (1 - outP));
      el.style.transform = 'translateY(' + (lerp(26, 0, inP) + lerp(0, -22, outP)) + 'px)';
    });

    // ---- 片頭／片尾卡 --------------------------------------------------
    $('titleCard').style.opacity = String(1 - seg(t, 2.6, 3.2));
    $('endCard').style.opacity = String(seg(t, 22.6, 23.2));
  };

  window.render(0);
  window.__ready = true;
})();
</script>
</body></html>`;
}

module.exports = { buildVideoHtml, DURATION, WIDTH, HEIGHT };
