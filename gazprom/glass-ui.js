/* «Жидкое стекло» v7 — поведение стеклянной навигации (22.10.2026). Работает только с DOM и ничего не знает о данных страницы.
   1) фон и оттенок стекла следуют за активной главой; 2) свет следует за пальцем/курсором по стеклянным панелям;
   3) преломление по кромке (SVG feDisplacementMap в backdrop-filter, только Chromium) для шапки, нижней панели и ползунка вкладок; в Safari/Firefox остаётся размытие.
   При prefers-reduced-transparency преломление не включается. */
(function () {
  "use strict";
  if (window.__glassUI) return; window.__glassUI = 1;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const root = document.documentElement, NS = "http://www.w3.org/2000/svg";
  const mTrans = matchMedia("(prefers-reduced-transparency: reduce)");
  const raf = fn => requestAnimationFrame(fn);
  const stages = $$(".stage"); if (!stages.length) return;
  root.classList.add("gl-js");

  // =====================================================================================
  // 1. Фон и оттенки следуют за главой
  // =====================================================================================
  let hue = 205, activeId = null;
  const setHue = h => {
    const d = (((h - hue) % 360) + 540) % 360 - 180; hue += d;
    root.style.setProperty("--bgh", hue.toFixed(1));
    const lt = $(".light"); if (lt) lt.style.setProperty("--lh", hue.toFixed(1));
    const tc = $('meta[name="theme-color"]'); if (tc) tc.setAttribute("content", "hsl(" + Math.round(((hue % 360) + 360) % 360) + " 42% 93%)");
  };
  const stageHue = st => parseFloat(st.style.getPropertyValue("--h")) || 205;
  function activate(id, h) { if (id === activeId) return; activeId = id; setHue(h); }
  // активная глава — по положению на экране при прокрутке
  const syncHue = () => { const line = innerHeight * 0.45; let cur = null; stages.forEach(s => { const r = s.getBoundingClientRect(); if (r.top <= line && r.bottom > line) cur = s; }); cur ? activate(cur.dataset.id, stageHue(cur)) : activate(null, 205); };
  addEventListener("scroll", () => raf(syncHue), { passive: true }); addEventListener("resize", syncHue); syncHue();

  // =====================================================================================
  // 2. Свет под пальцем
  // =====================================================================================
  let lightTarget = null, lightRaf = 0, lightPt = null;
  const lightSel = ".lg, .cr-sheet";
  const lightStep = () => { lightRaf = 0; if (!lightTarget || !lightPt) return; const r = lightTarget.getBoundingClientRect(); lightTarget.style.setProperty("--mx", ((lightPt[0] - r.left) / r.width * 100).toFixed(1) + "%"); lightTarget.style.setProperty("--my", ((lightPt[1] - r.top) / r.height * 100).toFixed(1) + "%"); lightTarget.style.setProperty("--hot", "1"); lightTarget.classList.add("hot"); };
  const lightOff = t => { if (!t) return; t.style.removeProperty("--mx"); t.style.removeProperty("--my"); t.style.removeProperty("--hot"); t.classList.remove("hot"); };
  document.addEventListener("pointermove", e => { if (e.pointerType === "touch" && !e.buttons && e.pressure === 0) return; const g = e.target.closest && e.target.closest(lightSel); if (g !== lightTarget) { lightOff(lightTarget); lightTarget = g; } if (!g) return; lightPt = [e.clientX, e.clientY]; if (!lightRaf) lightRaf = raf(lightStep); }, { passive: true });
  document.addEventListener("pointerdown", e => { const g = e.target.closest && e.target.closest(lightSel); if (!g) return; lightOff(lightTarget); lightTarget = g; lightPt = [e.clientX, e.clientY]; lightStep(); }, { passive: true });
  const lightEnd = () => { const t = lightTarget; setTimeout(() => { if (t === lightTarget) { lightOff(t); lightTarget = null; } }, 500); };
  document.addEventListener("pointerup", lightEnd, { passive: true }); document.addEventListener("pointercancel", lightEnd, { passive: true }); document.addEventListener("pointerleave", () => { lightOff(lightTarget); lightTarget = null; }, { passive: true });

  // =====================================================================================
  // 3. Преломление (Chromium): карта смещения по выпуклой кромке + блик
  // =====================================================================================
  const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some(b => /Chromium/.test(b.brand))) && CSS.supports("backdrop-filter", "url(#a) blur(1px)");
  if (!chromium || mTrans.matches) return;
  root.classList.add("lens");
  let defs = $("#lensdefs");
  if (!defs) { const sv = document.createElementNS(NS, "svg"); sv.setAttribute("width", 0); sv.setAttribute("height", 0); sv.style.position = "absolute"; sv.setAttribute("aria-hidden", "true"); defs = document.createElementNS(NS, "defs"); sv.append(defs); document.body.prepend(sv); }
  const cv = document.createElement("canvas"), cache = new Map(); let seq = 0;
  // выпуклая кромка: высота h(u) = (1-(1-u)^4)^(1/4), наклон даёт силу преломления; у самого края — максимум, к центру — 0
  const bezelMag = u => { const v = 1 - u, g = v * v * v / Math.pow(Math.max(1 - v * v * v * v, 1e-4), .75); return Math.min(1, g / 3.2); };
  function images(W, H, r, bezel, specK) {
    cv.width = W; cv.height = H; const ctx = cv.getContext("2d"), im = ctx.createImageData(W, H), d = im.data, sp = ctx.createImageData(W, H), s = sp.data;
    const sdf = (x, y) => { const qx = Math.abs(x - W / 2) - (W / 2 - r), qy = Math.abs(y - H / 2) - (H / 2 - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
    const L1 = [-.62, -.78], L2 = [.62, .78];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, dist = -sdf(x + .5, y + .5); let vx = 0, vy = 0, a = 0;
      if (dist > 0 && dist < bezel) {
        const gx = sdf(x + 1.5, y + .5) - sdf(x - .5, y + .5), gy = sdf(x + .5, y + 1.5) - sdf(x + .5, y - .5), l = Math.hypot(gx, gy) || 1, nx = gx / l, ny = gy / l, mag = bezelMag(dist / bezel);
        vx = -nx * mag; vy = -ny * mag;
        if (specK) { const f1 = Math.max(0, nx * L1[0] + ny * L1[1]), f2 = Math.max(0, nx * L2[0] + ny * L2[1]); a = Math.min(1, (Math.pow(f1, 1.6) + .35 * Math.pow(f2, 1.6)) * Math.exp(-dist / (bezel * .3)) * specK); }
      }
      d[i] = 128 + vx * 127; d[i + 1] = 128 + vy * 127; d[i + 2] = 128; d[i + 3] = 255;
      s[i] = s[i + 1] = s[i + 2] = 255; s[i + 3] = Math.round(a * 255);
    }
    ctx.putImageData(im, 0, 0); const map = cv.toDataURL(); ctx.putImageData(sp, 0, 0); return [map, specK ? cv.toDataURL() : null];
  }
  function filterFor(W, H, r, bezel, max, disp, specK) {
    const key = [W, H, r, bezel, max, disp, specK].join("|"); if (cache.has(key)) return cache.get(key);
    const id = "gl" + (++seq), [map, spec] = images(W, H, r, bezel, specK), sc = max * 2, f = document.createElementNS(NS, "filter");
    f.setAttribute("id", id); f.setAttribute("filterUnits", "userSpaceOnUse"); f.setAttribute("x", 0); f.setAttribute("y", 0); f.setAttribute("width", W); f.setAttribute("height", H); f.setAttribute("color-interpolation-filters", "sRGB");
    const disp1 = (res, k) => '<feDisplacementMap in="SourceGraphic" in2="m" scale="' + (sc * k).toFixed(2) + '" xChannelSelector="R" yChannelSelector="G" result="' + res + '"/>';
    const ch = (src, res, row) => '<feColorMatrix in="' + src + '" type="matrix" values="' + row + '" result="' + res + '"/>';
    let h = '<feImage href="' + map + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="none" result="m"/>';
    if (disp) h += disp1("dr", 1 + disp) + ch("dr", "cr", "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1") + disp1("dg", 1) + ch("dg", "cg", "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 1") + disp1("db", 1 - disp) + ch("db", "cb", "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1")
      + '<feComposite in="cr" in2="cg" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg"/><feComposite in="rg" in2="cb" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="d"/>';
    else h += disp1("d", 1);
    h += spec ? '<feImage href="' + spec + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="none" result="s"/><feBlend in="s" in2="d" mode="screen"/>' : '';
    f.innerHTML = h; defs.append(f); cache.set(key, id); return id;
  }
  let lite = false; // «регулятор»: на медленном устройстве крупные панели остаются с размытием, без преломления
  function lensOn(node, o) {
    if (lite && o.big) { node.style.removeProperty("--lens"); return; }
    const W = Math.round(node.offsetWidth / (o.q || 1)) * (o.q || 1) || 0, H = Math.round(node.offsetHeight / (o.qh || 1)) * (o.qh || 1) || 0; if (!W || !H) return;
    const rr = Math.min(parseFloat(getComputedStyle(node).borderTopLeftRadius) || o.r || 0, H / 2, W / 2);
    node.style.setProperty("--lens", "blur(" + (o.blur == null ? 3 : o.blur) + "px) url(#" + filterFor(W, H, Math.round(rr), o.bezel, o.max, o.disp || 0, o.spec || 0) + ")");
  }
  // [селектор, настройки]: шапка и нижняя панель — крупные, ползунок вкладок — малый с дисперсией и бликом; высота шапки округляется, чтобы не плодить фильтры при сворачивании
  const T = [[".top", { big: true, bezel: 22, max: 22, blur: 6, q: 8, qh: 8 }], [".dock", { big: true, bezel: 24, max: 26, blur: 6, q: 8, qh: 4 }], [".tabs .thumb", { bezel: 15, max: 15, disp: .06, spec: .55, blur: 2, q: 4 }]];
  const timers = new WeakMap();
  const ro = new ResizeObserver(es => es.forEach(e => { const n = e.target, o = n._lens; if (!o) return; clearTimeout(timers.get(n)); timers.set(n, setTimeout(() => lensOn(n, o), 140)); }));
  T.forEach(([sel, o]) => $$(sel).forEach(n => { n._lens = o; ro.observe(n); lensOn(n, o); }));
  setTimeout(() => T.forEach(([sel, o]) => $$(sel).forEach(n => lensOn(n, o))), 700);
  // измеряем реальную прокрутку: медиана кадра > 70 мс (меньше ~14 к/с) → отключаем преломление у крупных панелей
  let samples = [], scrolling = false, lastT = 0, stopT = 0;
  const tick = tm => {
    if (!scrolling || lite) return; const d = tm - lastT; lastT = tm; if (d > 0 && d < 400) samples.push(d);
    if (samples.length >= 14) { samples.sort((a, b) => a - b); const med = samples[samples.length >> 1]; samples = []; if (med > 70) { lite = true; root.classList.add("lens-lite"); T.forEach(([sel, o]) => o.big && $$(sel).forEach(n => lensOn(n, o))); return; } }
    raf(tick);
  };
  addEventListener("scroll", () => { if (lite) return; if (!scrolling) { scrolling = true; lastT = performance.now(); raf(tick); } clearTimeout(stopT); stopT = setTimeout(() => { scrolling = false; }, 160); }, { passive: true });
})();
