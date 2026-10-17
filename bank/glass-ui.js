/* «Жидкое стекло» v6 — поведение поверх готовой страницы (16.10.2026). Работает только с DOM, поэтому один и тот же файл подходит и странице-показу, и кандидату переноса.
   1) фон и оттенки меняются вместе с активной главой; 2) преломление (SVG feDisplacementMap в backdrop-filter, только Chromium) с запасным вариантом;
   3) свет следует за пальцем/курсором, тон стекла зависит от того, что под ним; 4) ползунок-линза выбора: пружина, перетаскивание, «сжатие» от скорости;
   5) оглавление-стекло с прогрессом; 6) поиск и фильтры; 7) уведомление об отметке с отменой; 8) мелочи: «к оглавлению», «дальше», мета-чипы, скелетон картинок, кольцо счётчика. */
(function () {
  "use strict";
  if (window.__glassUI) return; window.__glassUI = 1;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const root = document.documentElement, NS = "http://www.w3.org/2000/svg";
  const mReduce = matchMedia("(prefers-reduced-motion: reduce)"), mTrans = matchMedia("(prefers-reduced-transparency: reduce)");
  const reduced = () => mReduce.matches;
  const stages = $$(".stage"); if (!stages.length) return; // замок / пустая страница
  root.classList.add("gl-js");
  const raf = fn => requestAnimationFrame(fn);
  const plural = (n, a, b, c5) => { const m = n % 100, k = n % 10; return m > 10 && m < 15 ? c5 : k === 1 ? a : k > 1 && k < 5 ? b : c5; };
  const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (v == null || v === false) return; k === "class" ? e.className = v : k === "html" ? e.innerHTML = v : k.startsWith("on") ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v === true ? "" : v); }); kids.flat().forEach(x => x != null && e.append(x.nodeType ? x : document.createTextNode(x))); return e; };
  const norm = s => String(s || "").toLowerCase().replace(/ё/g, "е");

  // ——— данные банка из глобальных файлов страницы (если их нет — просто без метаданных) ———
  const DATA = {}, SUBS = {};
  try { (window.WC_FORM.sections || []).forEach(sec => { (sec.fields || []).forEach(f => { if (f.type === "pick") f.options.forEach(o => { DATA[o.id] = Object.assign({ stage: sec.id }, o); }); }); (sec.subs || []).forEach(s => { SUBS[sec.id + ":" + s.id] = s; }); }); } catch (e) {}
  const MORE = window.WC_MORE || {};

  // =====================================================================================
  // 1. Фон и оттенки следуют за главой (P0)
  // =====================================================================================
  let hue = 28;
  const setHue = h => { const d = (((h - hue) % 360) + 540) % 360 - 180; hue += d; root.style.setProperty("--bgh", hue.toFixed(1)); const lt = $(".light"); if (lt) lt.style.setProperty("--lh", hue.toFixed(1)); const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute("content", "hsl(" + Math.round(((hue % 360) + 360) % 360) + " 42% 93%)"); };
  const stageHue = st => parseFloat(st.style.getPropertyValue("--h")) || 28;
  const tocLi = {}; let activeId = null;
  function activate(id, h) {
    if (id === activeId) return; activeId = id; setHue(h);
    $$(".toc-l > li").forEach(li => li.removeAttribute("aria-current")); const t = tocLi[id]; if (t) t.setAttribute("aria-current", "true");
    try { history.replaceState(null, "", id ? "#s-" + id : location.pathname + location.search); } catch (e) {}
  }
  // активная глава — по положению на экране при прокрутке (не зависит от IntersectionObserver)
  const syncHue = () => { const line = innerHeight * 0.45; let cur = null; stages.forEach(s => { if (s.hidden) return; const r = s.getBoundingClientRect(); if (r.top <= line && r.bottom > line) cur = s; }); cur ? activate(cur.dataset.id, stageHue(cur)) : activate(null, 28); };
  addEventListener("scroll", () => raf(syncHue), { passive: true }); addEventListener("resize", syncHue); syncHue();
  // =====================================================================================
  // 2. Свет под пальцем и тон под стеклом
  // =====================================================================================
  let lightTarget = null, lightRaf = 0, lightPt = null;
  const lightSel = ".lg, .toc-l > li, .cr-sheet";
  const lightStep = () => { lightRaf = 0; if (!lightTarget || !lightPt) return; const r = lightTarget.getBoundingClientRect(); lightTarget.style.setProperty("--mx", ((lightPt[0] - r.left) / r.width * 100).toFixed(1) + "%"); lightTarget.style.setProperty("--my", ((lightPt[1] - r.top) / r.height * 100).toFixed(1) + "%"); lightTarget.style.setProperty("--hot", "1"); lightTarget.classList.add("hot"); };
  const lightOff = t => { if (!t) return; t.style.removeProperty("--mx"); t.style.removeProperty("--my"); t.style.removeProperty("--hot"); t.classList.remove("hot"); };
  document.addEventListener("pointermove", e => { if (e.pointerType === "touch" && !e.buttons && e.pressure === 0) return; const g = e.target.closest && e.target.closest(lightSel); if (g !== lightTarget) { lightOff(lightTarget); lightTarget = g; } if (!g) return; lightPt = [e.clientX, e.clientY]; if (!lightRaf) lightRaf = raf(lightStep); }, { passive: true });
  document.addEventListener("pointerdown", e => { const g = e.target.closest && e.target.closest(lightSel); if (!g) return; lightOff(lightTarget); lightTarget = g; lightPt = [e.clientX, e.clientY]; lightStep(); }, { passive: true });
  const lightEnd = () => { const t = lightTarget; setTimeout(() => { if (t === lightTarget) { lightOff(t); lightTarget = null; } }, 500); };
  document.addEventListener("pointerup", lightEnd, { passive: true }); document.addEventListener("pointercancel", lightEnd, { passive: true }); document.addEventListener("pointerleave", () => { lightOff(lightTarget); lightTarget = null; }, { passive: true });
  // тон: что лежит под неподвижной панелью — рисунок или бумага (0…1) → плотность заливки стекла
  const fixedGlass = [$(".top"), $(".dock")].filter(Boolean);
  let underT = 0;
  const underStep = () => { underT = 0; fixedGlass.forEach(g => { const r = g.getBoundingClientRect(); let art = 0; [.12, .5, .88].forEach(f => { const x = r.left + r.width * f, y = r.top + r.height / 2; const hit = document.elementsFromPoint(x, y).find(n => !n.closest(".lg, .toast, .to-toc, .cr-sheet, .cr-scrim, .finder-in")); if (hit && hit.closest(".pic, .hero-art")) art++; }); g.style.setProperty("--under", (art / 3).toFixed(2)); }); };
  addEventListener("scroll", () => { if (!underT) underT = setTimeout(underStep, 260); }, { passive: true }); addEventListener("resize", underStep); setTimeout(underStep, 600);

  // =====================================================================================
  // 3. Преломление (Chromium): карта смещения по выпуклой кромке + блик + лёгкая дисперсия
  // =====================================================================================
  const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some(b => /Chromium/.test(b.brand))) && CSS.supports("backdrop-filter", "url(#a) blur(1px)");
  if (chromium && !mTrans.matches) {
    root.classList.add("lens");
    let defs = $("#lensdefs"); if (!defs) { const sv = document.createElementNS(NS, "svg"); sv.setAttribute("width", 0); sv.setAttribute("height", 0); sv.style.position = "absolute"; sv.setAttribute("aria-hidden", "true"); defs = document.createElementNS(NS, "defs"); sv.append(defs); document.body.prepend(sv); }
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
      const W = Math.round(node.offsetWidth / (o.q || 1)) * (o.q || 1) || 0, H = Math.round(node.offsetHeight); if (!W || !H) return;
      const rr = Math.min(parseFloat(getComputedStyle(node).borderTopLeftRadius) || o.r || 0, H / 2, W / 2);
      node.style.setProperty("--lens", "blur(" + (o.blur == null ? 3 : o.blur) + "px) url(#" + filterFor(W, H, Math.round(rr), o.bezel, o.max, o.disp || 0, o.spec || 0) + ")");
    }
    // [селектор, толщина кромки, сила, параметры]; у плиток и ползунков — только видимые на экране
    const T = [[".top", { big: true, bezel: 22, max: 22, blur: 6 }], [".dock", { big: true, bezel: 24, max: 26, blur: 6 }], [".hero-glass", { big: true, bezel: 26, max: 28, blur: 5 }], [".orb", { bezel: 20, max: 20, disp: .07, spec: .6, blur: 3 }],
      [".toc-l > li", { big: true, bezel: 24, max: 24, blur: 2 }], [".tabs .thumb", { bezel: 15, max: 15, disp: .06, spec: .55, blur: 2 }], [".cr-sheet .cr-pp", { bezel: 16, max: 16, disp: .06, spec: .5, blur: 3 }], [".cr-sheet .cr-nav", { bezel: 15, max: 15, disp: .06, spec: .5, blur: 3 }],
      [".finder-in", { big: true, bezel: 22, max: 22, blur: 6 }], [".cr-seg i", { bezel: 16, max: 16, disp: .06, spec: .55, blur: 2, q: 8 }]];
    const ro = new ResizeObserver(es => es.forEach(e => { const o = e.target._lens; o && lensOn(e.target, o); }));
    T.forEach(([sel, o]) => $$(sel).forEach(n => { n._lens = o; ro.observe(n); lensOn(n, o); }));
    // шторка создаёт свои кнопки заново при каждом открытии — подключаем их тоже
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; T.forEach(([sel, o]) => { (n.matches(sel) ? [n] : []).concat($$(sel, n)).forEach(x => { if (!x._lens) { x._lens = o; ro.observe(x); } lensOn(x, o); }); }); }))).observe($("#sheetBody") || document.body, { childList: true, subtree: true });
    setTimeout(() => T.forEach(([sel, o]) => $$(sel).forEach(n => lensOn(n, o))), 700);
    // измеряем реальную прокрутку: медиана кадра > 70 мс (меньше ~14 к/с) → отключаем преломление у крупных панелей
    let samples = [], scrolling = false, lastT = 0, stopT = 0;
    const tick = tm => { if (!scrolling || lite) return; const d = tm - lastT; lastT = tm; if (d > 0 && d < 400) samples.push(d);
      if (samples.length >= 14) { samples.sort((a, b) => a - b); const med = samples[samples.length >> 1]; samples = []; if (med > 70) { lite = true; root.classList.add("lens-lite"); T.forEach(([sel, o]) => o.big && $$(sel).forEach(n => lensOn(n, o))); return; } }
      raf(tick); };
    addEventListener("scroll", () => { if (lite) return; if (!scrolling) { scrolling = true; lastT = performance.now(); raf(tick); } clearTimeout(stopT); stopT = setTimeout(() => { scrolling = false; }, 160); }, { passive: true });
  }

  // =====================================================================================
  // 4. Ползунок-линза: пружина, перетаскивание, «сжатие» от скорости
  // =====================================================================================
  root.classList.add("sp-on");
  const spr = (from, to, v0, upd, done, o) => { o = o || {}; const w = 2 * Math.PI / (o.response || .42), k = w * w, c = 2 * (o.damping == null ? .66 : o.damping) * w; let x = from, v = v0 || 0, last = performance.now(), stop = false;
    (function step(t) { if (stop) return; const dt = Math.min((t - last) / 1000, 1 / 30); last = t; v += (-k * (x - to) - c * v) * dt; x += v * dt; upd(x, v); if (Math.abs(x - to) < .3 && Math.abs(v) < 6) { upd(to, 0); done && done(); return; } raf(step); })(last); return { cancel() { stop = true; } }; };
  const ST = new WeakMap(); const W3 = sg => (sg.clientWidth - 8) / 3;
  const idxOf = sg => { const v = parseFloat(sg.style.getPropertyValue("--i")); return isNaN(v) ? null : v; };
  const baseX = sg => (sg.dataset.set === "1" && idxOf(sg) != null) ? idxOf(sg) * W3(sg) : null;
  const dxOf = sg => parseFloat(sg.style.getPropertyValue("--dx")) || 0;
  const clearFx = sg => { ["--dx", "--sx", "--sy"].forEach(p => sg.style.removeProperty(p)); };
  function glide(sg, fromDx, v0) {
    const s = ST.get(sg) || {}; ST.set(sg, s); s.a && s.a.cancel(); if (reduced()) { clearFx(sg); return; }
    s.a = spr(fromDx, 0, v0 || 0, (x, v) => { sg.style.setProperty("--dx", x.toFixed(2) + "px"); const q = Math.min(.2, Math.abs(v) / 2400); sg.style.setProperty("--sx", (1 + q).toFixed(3)); sg.style.setProperty("--sy", (1 - q * .55).toFixed(3)); }, () => clearFx(sg), { response: .4, damping: .64 });
  }
  function pop(sg) { if (reduced()) return; const s = ST.get(sg) || {}; ST.set(sg, s); s.a && s.a.cancel(); s.a = spr(.62, 1, 0, x => { sg.style.setProperty("--sx", x.toFixed(3)); sg.style.setProperty("--sy", x.toFixed(3)); }, () => clearFx(sg), { response: .38, damping: .55 }); }
  let pend = null, quiet = false;
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".cr-seg button"); if (!b) return; const sg = b.parentElement; const prevBase = baseX(sg); pend = { sg, prevX: prevBase == null ? null : prevBase + dxOf(sg), prevV: sg.dataset.v || "", title: (sg.getAttribute("aria-label") || "").replace(/^Ваш выбор:\s*/, ""), btn: b }; }, true);
  document.addEventListener("click", e => {
    if (!pend) return; const p = pend; pend = null; const sg = p.sg, now = baseX(sg);
    if (now == null) { const s = ST.get(sg); s && s.a && s.a.cancel(); clearFx(sg); } else if (p.prevX == null) pop(sg); else if (Math.abs(p.prevX - now) > 1) glide(sg, p.prevX - now, 0);
    if (!quiet) notify(sg, p);
  });
  let drag = null;
  document.addEventListener("pointerdown", e => { const sg = e.target.closest && e.target.closest(".cr-seg"); if (!sg) return; sg.classList.add("pressing"); if (sg.dataset.set !== "1" || e.button > 0) return;
    const s = ST.get(sg); s && s.a && s.a.cancel(); drag = { sg, id: e.pointerId, x0: e.clientX, base: baseX(sg) + dxOf(sg), moved: false, hist: [[e.timeStamp, e.clientX]], w: W3(sg) }; });
  document.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return; const dxp = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dxp) > 8) { drag.moved = true; try { drag.sg.setPointerCapture(e.pointerId); } catch (x) {} }
    if (!drag.moved) return; let x = drag.base + dxp, max = 2 * drag.w; if (x < 0) x = -rub(-x, drag.w); if (x > max) x = max + rub(x - max, drag.w);
    drag.x = x; drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
    drag.sg.style.setProperty("--dx", (x - baseX(drag.sg)).toFixed(2) + "px"); drag.sg.style.setProperty("--sx", "1.12"); drag.sg.style.setProperty("--sy", ".96"); e.preventDefault();
  }, { passive: false });
  const rub = (o, dim) => (o * dim * .35) / (dim + .35 * Math.abs(o));
  const dragEnd = e => {
    const sg = e.target.closest && e.target.closest(".cr-seg"); $$(".cr-seg.pressing").forEach(x => x.classList.remove("pressing"));
    if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; if (!d.moved) return;
    const h = d.hist, v = h.length > 1 ? (h[h.length - 1][1] - h[0][1]) / Math.max(1, h[h.length - 1][0] - h[0][0]) * 1000 : 0, proj = d.x + (v / 1000) * .99 / (1 - .99) * .12;
    const idx = Math.max(0, Math.min(2, Math.round(proj / d.w))), cur = idxOf(d.sg), btns = $$("button", d.sg);
    if (idx === cur) glide(d.sg, dxOf(d.sg), v); else btns[idx] && btns[idx].click();
  };
  document.addEventListener("pointerup", dragEnd); document.addEventListener("pointercancel", dragEnd);
  document.addEventListener("keydown", e => { // стрелки на переключателе: влево/вправо меняют значение
    const b = e.target.closest && e.target.closest(".cr-seg button"); if (!b || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return; const bs = $$("button", b.parentElement), i = bs.indexOf(b), n = bs[Math.max(0, Math.min(2, i + (e.key === "ArrowRight" ? 1 : -1)))]; if (n && n !== b) { e.preventDefault(); n.focus(); n.click(); } });

  // =====================================================================================
  // 5. Уведомление об отметке с отменой + голос для скринридера
  // =====================================================================================
  const live = el("div", { class: "sr-live", role: "status", "aria-live": "polite", id: "glive" });
  const undoBtn = el("button", { type: "button" }, "Отменить"), toastMsg = el("span", null), toast = el("div", { class: "toast", role: "presentation" }, toastMsg, undoBtn);
  document.body.append(live, toast); let toastT = 0, undoFn = null;
  undoBtn.addEventListener("click", () => { toast.classList.remove("on"); undoFn && undoFn(); undoFn = null; });
  function notify(sg, p) {
    const now = sg.dataset.v || "", label = k => ({ yes: "Хотим", maybe: "Можно", no: "Не наше" })[k];
    const msg = now ? "«" + p.title + "» — " + label(now) : "Отметка снята: «" + p.title + "»"; live.textContent = ""; setTimeout(() => { live.textContent = msg; }, 30);
    if (sg.closest(".cr-sheet") || now === p.prevV) return; // в шторке тост закрыт шторкой; голос выше
    toastMsg.textContent = msg; toast.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("on"), 5200);
    undoFn = () => { quiet = true; const bs = $$("button", sg); (p.prevV ? bs.find(b => b.dataset.k === p.prevV) : bs.find(b => b.dataset.k === now)).click(); quiet = false; live.textContent = "Отметка возвращена"; };
  }

  // =====================================================================================
  // 6. Оглавление-стекло: рисунок главы, прогресс, активная глава
  // =====================================================================================
  const items = $$(".item"), toc = $(".toc"); if (toc) toc.id = "toc";
  const idOfHref = a => (a.getAttribute("href") || "").replace(/^#s-/, "");
  $$(".toc-l > li").forEach(li => {
    const a = $("a", li), id = idOfHref(a), st = $("#s-" + id); tocLi[id] = li; li.dataset.stage = id;
    const img = st && $(".item .pic img", st), src = img && img.getAttribute("src");
    if (src) li.prepend(el("span", { class: "tile-art", "aria-hidden": "true", style: "--img:url('" + src + "')" }));
    li.append(el("span", { class: "toc-p", "aria-hidden": "true", style: "--p:0" }, el("i")));
    $$("a", li).forEach(x => { const sm = $("small", x); if (sm) { sm.dataset.total = sm.textContent; sm.prepend(el("span", { class: "mk" })); } });
  });
  function refresh() {
    const part = (nodes) => { let m = 0; nodes.forEach(n => { if (n.dataset.v) m++; }); return m; };
    $$(".toc-l > li").forEach(li => {
      const id = li.dataset.stage, st = $("#s-" + id), its = $$(".item", st), m = part(its);
      $(".toc-p", li).style.setProperty("--p", its.length ? (m / its.length).toFixed(3) : 0);
      $$("a", li).forEach((a, k) => { const sub = k ? $("#" + (a.getAttribute("href") || "").slice(1)) : st; const n = sub ? $$(".item", sub) : [], mk = part(n), sm = $("small", a); if (sm) $(".mk", sm).textContent = mk ? mk + " из " : ""; });
    });
    // минуты главы по отметкам «Хотим»
    stages.forEach(st => { const s = $(".stm", st); if (!s) return; let min = 0; $$(".item", st).forEach(it => { if (it.dataset.v === "yes") min += (DATA[it.dataset.id] || {}).dur || 0; }); s.textContent = min ? "≈ " + min + " мин по вашим «Хотим»" : ""; });
    chipCounts();
  }
  stages.forEach(st => { const w = $(".stage-head .when", st); w && w.append(el("span", { class: "stm" })); });

  // =====================================================================================
  // 7. Карточки: мета-чипы, скелетон картинок, «дальше», «к оглавлению»
  // =====================================================================================
  items.forEach(it => {
    const d = DATA[it.dataset.id], txt = $(".txt", it); if (!d || !txt || $(".meta", txt)) return; const tg = $(".tg", txt), li = [];
    if (d.who) li.push(el("li", null, el("span", null, d.who === "все" ? "для всех" : d.who)));
    if (d.screen === "да") li.push(el("li", null, el("span", null, "нужен экран"))); else if (d.screen === "желательно") li.push(el("li", null, el("span", null, "экран желателен")));
    if (tg) li.push(el("li", null, tg)); if (li.length) txt.append(el("ul", { class: "meta", "aria-label": "Участники и что нужно" }, li));
  });
  const imgOk = i => { i.classList.add("ld"); const f = i.closest(".cr-slide"); f && f.classList.add("ldf"); }, imgBad = i => { i.classList.add("err"); const f = i.closest(".cr-slide"); f && f.classList.add("ldf", "errf"); };
  $$(".cr-slide img, .hero-art img").forEach((i, n) => { i.decoding = "async"; if (i.closest(".cr-slide") && i.closest(".cr-slide").previousElementSibling) i.setAttribute("fetchpriority", "low"); if (i.complete && i.naturalWidth) imgOk(i); else if (i.complete && i.getAttribute("src")) imgBad(i); });
  document.addEventListener("load", e => { if (e.target.tagName === "IMG") imgOk(e.target); }, true); document.addEventListener("error", e => { if (e.target.tagName === "IMG") imgBad(e.target); }, true);
  stages.forEach((st, i) => { const nx = stages[i + 1]; if (!nx) return; const t = $("h2", nx); $(".stage-in", st).append(el("a", { class: "next-ch", href: "#s-" + nx.dataset.id }, "Дальше: " + (t ? t.textContent : "следующая глава") + " →")); });
  const upBtn = el("button", { class: "to-toc", type: "button", "aria-label": "К оглавлению" }, el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15l7-7 7 7"/></svg>' }));
  upBtn.addEventListener("click", () => { const t = $("#toc") || $(".hero"); t && t.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); });
  document.body.append(upBtn); const upT = () => upBtn.classList.toggle("on", scrollY > 1100); addEventListener("scroll", upT, { passive: true }); upT();
  // кольцо и «тик» у счётчика в шапке
  const cnt = $("#cnt");
  if (cnt) { const upd = () => { const m = /(\d+)\D+(\d+)/.exec(cnt.textContent); if (m) { cnt.style.setProperty("--p", (+m[1] / +m[2]).toFixed(3)); cnt.classList.remove("tick"); void cnt.offsetWidth; if (+m[1]) cnt.classList.add("tick"); } }; new MutationObserver(upd).observe(cnt, { childList: true, characterData: true, subtree: true }); upd(); }

  // =====================================================================================
  // 8. Поиск и фильтры
  // =====================================================================================
  const HAY = {}; items.forEach(it => { const d = DATA[it.dataset.id] || {}, t = $(".txt h3", it); HAY[it.dataset.id] = norm([d.title || (t && t.textContent), d.text, d.who, d.prep, d.tag, d.screen === "да" ? "экран" : "", (MORE[it.dataset.id] || []).join(" ")].join(" ")); });
  const F = { q: "", mark: "all", sub: "all" }; let fTimer = 0;
  const magn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
  const input = el("input", { type: "search", id: "fq", placeholder: "Найти идею: квиз, торт, видео…", autocomplete: "off", enterkeyhint: "search", "aria-describedby": "fstat" });
  const clearB = el("button", { class: "fclear", type: "button", "aria-label": "Очистить поиск", hidden: true }, "×");
  const stat = el("p", { class: "fstat", id: "fstat", role: "status", "aria-live": "polite" });
  const MARKS = [["all", "Все"], ["none", "Без отметки"], ["yes", "Хотим"], ["maybe", "Можно"], ["no", "Не наше"]];
  const markChips = MARKS.map(([k, t]) => el("button", { class: "fchip", type: "button", "data-mark": k, "aria-pressed": String(k === "all"), onclick: () => { F.mark = k; apply(true); } }, t, el("small")));
  const empty = el("div", { class: "fempty lg", hidden: true }, el("b", null, "Ничего не нашлось"), el("p", null, "Попробуйте другое слово или снимите фильтры."), el("button", { class: "fchip", type: "button", onclick: () => reset() }, "Сбросить поиск и фильтры"));
  // «Дети» и «Родители / взрослые» скрыты по умолчанию; галочки возвращают их
  const KIDS = ["kidsphoto", "kidsdraw", "kidsanswer"], ADULTS = ["parents", "daddance"], F2 = { kids: false, adults: false };
  const toggle = (k, t) => el("label", { class: "fchip fbox" }, el("input", { type: "checkbox", onchange: e => { F2[k] = e.target.checked; apply(true); } }), t);
  const boxes = el("div", { class: "fchips", role: "group", "aria-label": "Скрытые по умолчанию группы" }, el("span", null, "Показать:"), toggle("kids", "Дети"), toggle("adults", "Родители / взрослые"));
  const finder = el("section", { class: "finder", id: "finder", "aria-label": "Поиск и фильтры" }, el("div", { class: "finder-in lg" },
    el("label", { class: "fsearch" }, el("span", { class: "sr-live" }, "Найти идею"), el("span", { html: magn }), input, clearB),
    el("div", { class: "fchips", role: "group", "aria-label": "Фильтр по вашей отметке" }, el("span", null, "Отметка:"), markChips), boxes, stat));
  const anchor = toc || $(".hero"); anchor.after(finder); finder.after(empty);
  // подразделы главы «Игры»: фильтр-чипы
  let subChips = [];
  const gamesSt = $("#s-games"), subSecs = gamesSt ? $$(".sub", gamesSt) : [];
  if (subSecs.length) {
    const mk = (k, t, n) => el("button", { class: "fchip", type: "button", "data-sub": k, "aria-pressed": String(k === "all"), onclick: () => { F.sub = k; apply(true); } }, t, el("small", null, String(n)));
    subChips = [mk("all", "Все", $$(".item", gamesSt).length)].concat(subSecs.map(s => { const k = s.id.replace("s-games-", ""), meta = SUBS["games:" + k] || {}; return mk(k, meta.short || ($(".sub-h span", s) || {}).textContent, $$(".item", s).length); }));
    const bar = el("div", { class: "subchips", role: "group", "aria-label": "Показать подраздел игр" }, subChips); gamesSt.querySelector(".sub").before(bar);
  }
  function chipCounts() {
    const c = { all: items.length, none: 0, yes: 0, maybe: 0, no: 0 }; items.forEach(i => { const v = i.dataset.v || ""; if (v) c[v]++; else c.none++; });
    markChips.forEach(b => { $("small", b).textContent = String(c[b.dataset.mark]); });
  }
  function apply(announce) {
    const toks = norm(F.q).split(/\s+/).filter(Boolean); let shown = 0;
    items.forEach(it => { const id = it.dataset.id, v = it.dataset.v || ""; let ok = toks.every(t => HAY[id].includes(t));
      if (ok && F.mark !== "all") ok = F.mark === "none" ? v === "" : v === F.mark;
      if (ok && ((!F2.kids && KIDS.includes(id)) || (!F2.adults && ADULTS.includes(id)))) ok = false;
      if (ok && F.sub !== "all" && gamesSt && gamesSt.contains(it)) ok = it.closest(".sub").id === "s-games-" + F.sub;
      it.hidden = !ok; if (ok) shown++; });
    $$(".sub").forEach(s => { s.hidden = !$$(".item", s).some(i => !i.hidden); });
    stages.forEach(s => { s.hidden = !$$(".item", s).some(i => !i.hidden); });
    const active = toks.length || F.mark !== "all" || F.sub !== "all";
    markChips.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mark === F.mark))); subChips.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sub === F.sub)));
    clearB.hidden = !F.q; empty.hidden = shown > 0;
    stat.textContent = active ? "Показано " + shown + " из " + items.length + " " + plural(items.length, "идеи", "идей", "идей") : "";
  }
  function reset() { F.q = ""; F.mark = "all"; F.sub = "all"; input.value = ""; apply(true); }
  input.addEventListener("input", () => { F.q = input.value; clearTimeout(fTimer); fTimer = setTimeout(() => apply(true), 140); });
  clearB.addEventListener("click", () => { input.value = ""; F.q = ""; apply(true); input.focus(); });
  input.addEventListener("keydown", e => { if (e.key === "Escape" && input.value) { e.preventDefault(); clearB.click(); } });
  document.addEventListener("keydown", e => { if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); finder.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" }); setTimeout(() => input.focus({ preventScroll: true }), 250); } });
  // отметки меняются — обновляем оглавление, счётчики и (при фильтре по отметке) список с небольшой задержкой
  let mTimer = 0, fTimer2 = 0;
  const mo = new MutationObserver(() => { clearTimeout(mTimer); mTimer = setTimeout(refresh, 80); if (F.mark !== "all") { clearTimeout(fTimer2); fTimer2 = setTimeout(() => apply(false), 1100); } });
  items.forEach(i => mo.observe(i, { attributes: true, attributeFilter: ["data-v"] }));
  refresh(); apply(false);
  // переход по ссылке-якорю к скрытому/свёрнутому не требуется; при #s-… в адресе вернуть прокрутку после сборки
  if (location.hash && /^#s-/.test(location.hash)) { const t = document.getElementById(location.hash.slice(1)); t && setTimeout(() => t.scrollIntoView(), 120); }
})();
