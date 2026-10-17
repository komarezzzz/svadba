// Общее ядро четырёх концепций (раунд 15.10.2026). Читает НАСТОЯЩИЕ данные сайта (../../site/assets/*), ничего в них не меняет.
// Логика портирована из site/assets/program.js: пружина шторки, карусель с автоходом и паузой, этапы, «Хотим/Можно/Не наше», итог.
// Отметки хранятся в браузере под своим ключом wcr:<концепция>:<пара>, на сайт и в приёмник ничего не уходит.
// Параметры адреса: ?c=<пара> (по умолчанию виктория-и-никита, 23 карточки) · ?all=1 (весь каталог, 101) · ?demo=1 (примерные отметки) · ?reset=1 (очистить).
(function () {
  "use strict";
  const FORM = window.WC_FORM, MORE = window.WC_MORE || {};
  const qs = new URLSearchParams(location.search);
  const couple = (qs.get("c") || "виктория-и-никита").toLowerCase().replace(/[^a-z0-9а-яё_-]/gi, "").slice(0, 40);
  const greet = (qs.get("n") || (couple.includes("-и-") ? couple.split("-").filter(Boolean).map(w => w === "и" ? w : w[0].toUpperCase() + w.slice(1)).join(" ") : "")).slice(0, 60);
  // Режим показа: по умолчанию ВЕСЬ банк идей; ?bank=pair — подборка пары из sets.js (если она есть).
  const HAS_SET = !!(window.WC_SETS && window.WC_SETS[couple]);
  const BANK = qs.get("bank") === "pair" && HAS_SET ? "pair" : "all";
  const BANK_TOTAL = FORM.sections.reduce((n, sec) => n + sec.fields.filter(f => f.type === "pick").reduce((m, f) => m + f.options.length, 0), 0);
  const SET = BANK === "pair" ? window.WC_SETS[couple] : null;
  if (SET) FORM.sections.forEach(sec => sec.fields.forEach(f => { if (f.type === "pick") f.options = f.options.filter(o => SET.includes(o.id)); }));

  const IMG = "assets/img/program/";
  const REACT = [["yes", "Хотим"], ["maybe", "Можно"], ["no", "Не наше"]];
  const LABEL = { yes: "Хотим", maybe: "Можно", no: "Не наше" };
  const HUE = { before: 262, welcome: 160, first: 48, games: 340, move: 205, last: 22, bg: 90 };
  const UNTIMED = { before: 1, bg: 1 };
  const START = 17 * 60;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function h(tag, attrs) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k in e && k !== "list") e[k] = v;
      else e.setAttribute(k, v);
    }
    for (const c of Array.prototype.slice.call(arguments, 2).flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  }
  const hhmm = m => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  function fmtMin(m) {
    if (!m) return "0 мин";
    const hh = Math.floor(m / 60), r = m % 60;
    return ((hh ? hh + " ч " : "") + (r || !hh ? r + " мин" : "")).trim();
  }
  const durText = c => c.dur ? c.dur + " мин" : "фоном";
  const grow = t => { t.style.height = "auto"; t.style.height = Math.max(t.scrollHeight + 2, 84) + "px"; };
  const filled = v => v != null && (typeof v === "string" ? v.trim() !== "" : typeof v === "object" ? Object.values(v).some(filled) : !!v);

  // ---------- данные ----------
  const stages = FORM.sections.map(sec => {
    const f = sec.fields.find(x => x.type === "pick");
    const note = sec.fields.find(x => x.type === "long" && x.id !== "wish");
    return f && f.options.length ? { sec, f, note, id: sec.id, title: sec.title, time: sec.time, lead: sec.lead, hue: HUE[sec.id] || 255, cards: f.options } : null;
  }).filter(Boolean);
  // подразделы этапа (sec.subs + card.sub): подзаголовки в ленте; карточки идут в порядке подразделов
  stages.forEach(st => {
    const subs = st.sec.subs;
    if (!subs) { st.groups = [{ id: null, title: null, lead: null, cards: st.cards }]; return; }
    const groups = subs.map(s => ({ id: s.id, title: s.title, lead: s.lead, cards: st.cards.filter(c => c.sub === s.id) }));
    const rest = st.cards.filter(c => !subs.some(s => s.id === c.sub)); if (rest.length) groups.push({ id: "other", title: "Остальное", lead: null, cards: rest });
    st.groups = groups.filter(g => g.cards.length); st.cards = st.groups.flatMap(g => g.cards);
  });
  stages.forEach(st => st.cards.forEach(c => { c.st = st; }));
  const sumSec = FORM.sections.find(s => s.fields.some(f => f.type === "summary"));
  const namesF = sumSec && sumSec.fields.find(f => f.id === "names");
  const wishF = sumSec && sumSec.fields.find(f => f.id === "wish");
  const cards = stages.flatMap(s => s.cards);

  // ---------- память ----------
  let KEY = "wcr:x:" + couple, S = { a: {}, sent: false };
  const subs = [];
  function read(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* без памяти работаем в сессии */ } }
  function emit() { subs.forEach(fn => fn()); }
  function init(id) {
    KEY = "wcr:" + id + ":" + couple;
    if (qs.has("reset")) { try { localStorage.removeItem(KEY); } catch (e) { /* */ } }
    S = Object.assign({ a: {}, sent: false }, read(KEY));
    if (qs.has("demo") && !Object.keys(S.a).length) {
      cards.forEach((c, i) => {
        const r = i % 5 === 3 ? "maybe" : i % 7 === 5 ? "no" : i % 3 === 0 || i % 3 === 1 ? "yes" : "";
        if (r) { const fid = c.st.f.id; S.a[fid] = S.a[fid] || {}; S.a[fid][c.id] = { r, c: "" }; }
      });
      const p = greet.split(" и "); S.a.names = { b: p[0] || "", g: p[1] || "" };
    }
    const mainEl = document.getElementById("main") || document.getElementById("deck");
    if (mainEl) { const sk = h("a", { class: "cr-skip", href: "#" + mainEl.id }, "К программе вечера"); sk.addEventListener("click", e => { e.preventDefault(); mainEl.tabIndex = -1; mainEl.focus(); }); document.body.prepend(sk); }
    if (!filled(S.a.names) && greet.includes(" и ")) { const p = greet.split(" и "); S.a.names = { b: p[0], g: p[1] }; }
  }
  const rOf = c => ((S.a[c.st.f.id] || {})[c.id] || {}).r || "";
  const cOf = c => ((S.a[c.st.f.id] || {})[c.id] || {}).c || "";
  function set(id, val) { S.a[id] = val; S.sent = false; save(); emit(); }
  function mutate(c, patch) {
    const fid = c.st.f.id, val = Object.assign({}, S.a[fid]);
    val[c.id] = Object.assign({}, val[c.id], patch);
    set(fid, val);
  }
  function setR(c, v) { mutate(c, { r: rOf(c) === v ? "" : v }); }
  function picks() {
    const g = { yes: [], maybe: [], no: [] };
    cards.forEach(c => { const r = rOf(c); if (g[r]) g[r].push({ o: c, st: c.st, c: cOf(c) }); });
    return g;
  }
  function totals() {
    const g = picks();
    return { yes: g.yes.length, maybe: g.maybe.length, no: g.no.length, all: cards.length, minutes: g.yes.reduce((s, x) => s + (x.o.dur || 0), 0) };
  }
  function stageMinutes(st) { return st.cards.reduce((s, c) => s + (rOf(c) === "yes" ? c.dur || 0 : 0), 0); }
  function stageCounts(st) {
    const n = { yes: 0, maybe: 0, no: 0, all: st.cards.length };
    st.cards.forEach(c => { const r = rOf(c); if (n[r] != null) n[r]++; });
    return n;
  }
  function timeline() {
    const g = picks(); let clock = START; const blocks = [];
    stages.forEach(st => {
      const p = g.yes.filter(x => x.st === st);
      if (!p.length) return;
      const timed = !UNTIMED[st.id], at = clock;
      const items = p.map(x => { const d = x.o.dur || 0, t0 = clock; if (timed) clock += d; return { o: x.o, c: x.c, d, t0: timed && d ? t0 : null }; });
      blocks.push({ st, timed, at: timed ? at : null, items });
      if (timed) clock += 10;
    });
    return { blocks, end: clock };
  }
  function pairNames() {
    const n = S.a.names || {}, first = s => (s || "").trim().split(/\s+/)[0];
    return [first(n.b) || "Невеста", first(n.g) || "Жених"];
  }

  // ---------- иконки (нарисованные, один штрих) ----------
  const ICON = {
    yes: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
    maybe: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 8h8"/></svg>',
    no: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>',
    prev: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 3.5L5.5 9l5.5 5.5"/></svg>',
    next: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5L12.5 9 7 14.5"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>',
    play: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.8v10.4a.8.8 0 0 0 1.2.7l8-5.2a.8.8 0 0 0 0-1.4l-8-5.2a.8.8 0 0 0-1.2.7z"/></svg>',
    down: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7L9 12.5 14.5 7"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>'
  };
  const icon = (name, cls) => { const s = h("span", { class: cls || "cr-ico", "aria-hidden": "true" }); s.innerHTML = ICON[name]; return s; };

  // ---------- пружина и шторка (как в program.js: response + damping, передача скорости, проекция, резинка) ----------
  function spring(from, to, v0, onUpdate, done, opt) {
    opt = opt || {};
    const response = opt.response || 0.38, damping = opt.damping == null ? 1 : opt.damping;
    const w = 2 * Math.PI / response, k = w * w, c = 2 * damping * w;
    let x = from, v = v0 || 0, last = performance.now(), stop = false;
    if (reduced()) { onUpdate(to); done && done(); return { cancel() {} }; }
    (function step(t) {
      if (stop) return;
      const dt = Math.min((t - last) / 1000, 1 / 30); last = t;
      v += (-k * (x - to) - c * v) * dt; x += v * dt; onUpdate(x);
      if (Math.abs(x - to) < 0.4 && Math.abs(v) < 8) { onUpdate(to); done && done(); return; }
      requestAnimationFrame(step);
    })(last);
    return { cancel() { stop = true; } };
  }
  const project = (v, d) => { d = d || 0.998; return (v / 1000) * d / (1 - d); };
  const rubber = (o, dim) => { const c = 0.55; return (o * dim * c) / (dim + c * Math.abs(o)); };

  // sheet: {sheet, body, scrim, behind:[узлы, которые гасим]} → {open(build, from), close(v), rebuild(build), isOpen()}
  function makeSheet(o) {
    const { sheet, body, scrim, behind } = o;
    let y = 0, anim = null, H = 600, state = false, opener = null, lastBuild = null;
    const setY = v => { y = v; sheet.style.transform = "translate3d(0," + v + "px,0)"; scrim.style.opacity = Math.max(0, Math.min(1, 1 - v / H)); document.documentElement.style.setProperty("--sheet-p", String(Math.max(0, Math.min(1, 1 - v / H)))); };
    sheet.setAttribute("aria-hidden", "true"); sheet.inert = true;
    function open(build, from) {
      opener = from || document.activeElement; lastBuild = build;
      body.replaceChildren(); build(body); body.scrollTop = 0;
      sheet.inert = false; sheet.setAttribute("aria-hidden", "false"); scrim.classList.add("on");
      behind.forEach(n => { if (n) n.inert = true; });
      H = sheet.getBoundingClientRect().height || 600;
      if (!state) setY(H + 20);
      state = true; document.documentElement.classList.add("sheet-open"); if (anim) anim.cancel();
      anim = spring(y, 0, 0, setY, null, { response: 0.42, damping: 0.86 });
      sheet.focus({ preventScroll: true });
    }
    function close(v) {
      if (!state) return;
      state = false; if (anim) anim.cancel(); scrim.classList.remove("on");
      document.dispatchEvent(new Event("wcr:sheetclose")); document.documentElement.classList.remove("sheet-open");
      behind.forEach(n => { if (n) n.inert = false; });
      anim = spring(y, H + 20, v || 0, setY, () => {
        sheet.inert = true; sheet.setAttribute("aria-hidden", "true");
        if (opener && opener.focus) opener.focus({ preventScroll: true });
      }, { response: 0.34, damping: 1 });
    }
    function rebuild(build) { body.replaceChildren(); (build || lastBuild)(body); body.scrollTop = 0; H = sheet.getBoundingClientRect().height || H; sheet.focus({ preventScroll: true }); }
    scrim.addEventListener("click", () => close(0));
    document.addEventListener("keydown", e => { if (e.key === "Escape" && state) close(0); });
    // перетаскивание: 1:1 за пальцем, резинка вверху, проекция по скорости при отпускании
    let sy, y0, hist = [], on = false;
    sheet.addEventListener("pointerdown", e => {
      if (e.target.closest("button, .cr-seg, input, textarea, a, label, .cr-track")) return;
      if (body.scrollTop > 0 && !e.target.closest(".cr-grab")) return;
      on = true; sy = e.clientY; y0 = y; hist = [[e.clientY, performance.now()]];
      if (anim) anim.cancel();
      sheet.setPointerCapture(e.pointerId);
    });
    sheet.addEventListener("pointermove", e => {
      if (!on) return;
      const dy = e.clientY - sy; hist.push([e.clientY, performance.now()]); if (hist.length > 6) hist.shift();
      const tg = y0 + dy; setY(tg < 0 ? -rubber(-tg, 300) : tg);
    });
    function end() {
      if (!on) return; on = false;
      const a = hist[0], b = hist[hist.length - 1], v = b[1] > a[1] ? (b[0] - a[0]) / ((b[1] - a[1]) / 1000) : 0;
      if (y + project(v) > H * 0.45) close(v);
      else anim = spring(y, 0, v, setY, null, { response: 0.36, damping: 0.8 });
    }
    sheet.addEventListener("pointerup", end); sheet.addEventListener("pointercancel", end);
    return { open, close, rebuild, isOpen: () => state };
  }

  // ---------- карусель картинок: <id>.jpg, -2 … -6; автоход 4,5 с, пауза, стрелки, точки ----------
  // Не стартует при «уменьшении движения»; жест/точка/стрелка выключают автоход; наведение и фокус удерживают; счётчик слайда читается, пока автоход выключен.
  // плавный переход ленты: ~1,2 с, мягкая кривая; при «уменьшении движения» — сразу
  function glide(el, x, ms) {
    const x0 = el.scrollLeft, t0 = performance.now(), d = ms || 1100;
    if (reduced() || Math.abs(x - x0) < 2) { el.scrollLeft = x; return; }
    const step = t => { const k = Math.min(1, (t - t0) / d), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; el.scrollLeft = x0 + (x - x0) * e; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function carousel(c, o) {
    o = o || {};
    const track = h("div", { class: "cr-track", role: "group", "aria-roledescription": "карусель", "aria-label": "Рисунки: " + c.title, tabindex: "0" });
    const dots = h("div", { class: "cr-dots" });
    const pos = h("span", { class: "sr", "aria-live": "off" });
    const box = h("div", { class: "cr-pic" }, track, dots, pos);
    const goto = i => glide(track, track.clientWidth * i);
    // o.feed — карусель в ленте: первый рисунок виден сразу, остальные подгружаются, когда карточка подошла к экрану (box.loadAll)
    const pending = [];
    ["", "-2", "-3", "-4", "-5", "-6"].forEach((suf, i) => {
      const url = IMG + c.id + suf + ".webp", later = o.feed && i > 0;
      const img = h("img", { alt: i ? "" : "Рисунок: " + c.title, width: 900, height: 600, draggable: "false", loading: o.eager && i === 0 ? null : "lazy" });
      if (later) pending.push(() => { img.src = url; }); else img.src = url;
      const slide = h("figure", { class: "cr-slide" }, img);
      const dot = h("button", { type: "button", class: "cr-dot", "aria-label": "Рисунок " + (i + 1) });
      slide.querySelector("img").onerror = () => { slide.remove(); dot.remove(); if (dots.children.length < 2) { dots.hidden = true; box.classList.add("single"); } };
      dot.onclick = () => goto([...track.children].indexOf(slide));
      track.append(slide); dots.append(dot);
    });
    const cur = () => Math.round(track.scrollLeft / (track.clientWidth || 1));
    const total = () => track.children.length;
    track.onscroll = () => {
      const i = cur();
      [...dots.children].forEach((d, k) => d.classList.toggle("on", k === i));
      pos.textContent = "Рисунок " + (i + 1) + " из " + total();
    };
    dots.children[0] && dots.children[0].classList.add("on");
    track.addEventListener("keydown", e => { if (e.key === "ArrowRight") { goto(Math.min(cur() + 1, total() - 1)); e.preventDefault(); } if (e.key === "ArrowLeft") { goto(Math.max(cur() - 1, 0)); e.preventDefault(); } });
    let userStopped = false;
    const manual = () => { move++; userStopped = true; if (playing) setPlaying(false); };
    const prev = h("button", { type: "button", class: "cr-nav cr-prev", "aria-label": "Предыдущий рисунок", onclick: () => { manual(); box.loadAll(); goto((cur() - 1 + total()) % total()); } });
    const next = h("button", { type: "button", class: "cr-nav cr-next", "aria-label": "Следующий рисунок", onclick: () => { manual(); box.loadAll(); goto((cur() + 1) % total()); } });
    prev.innerHTML = ICON.prev; next.innerHTML = ICON.next;
    const still = reduced();
    let playing = !still && o.auto !== false && !o.feed, timer = 0, hold = false, miss = 0, move = 0;
    const pp = h("button", { type: "button", class: "cr-pp" });
    const paint = () => {
      pp.innerHTML = playing ? ICON.pause : ICON.play;
      pp.setAttribute("aria-label", playing ? "Поставить автопролистывание на паузу" : "Запустить автопролистывание");
      pp.setAttribute("aria-pressed", String(!playing));
      pos.setAttribute("aria-live", playing ? "off" : "polite");
    };
    let pendingT = 0; const stop = () => { clearInterval(timer); clearTimeout(pendingT); timer = 0; };
    if (!o.feed) document.addEventListener("wcr:sheetclose", stop, { once: true });
    const tick = () => {
      if (!box.isConnected) { if (++miss > 3) stop(); return; }
      miss = 0;
      if (hold || document.hidden || total() < 2) return;
      if (document.documentElement.classList.contains("sheet-open") && !box.closest(".cr-sheet")) return; // пока открыта шторка, ленту не листаем
      const n = (cur() + 1) % total(), x = track.clientWidth * n, my = ++move;
      glide(track, x, 1200);
      // плавная прокрутка не идёт в свёрнутой вкладке: если не дошла — переходим сразу
      setTimeout(() => { if (my === move && track.isConnected && Math.abs(track.scrollLeft - x) > 2) track.scrollTo({ left: x, behavior: "auto" }); }, 1500);
    };
    const setPlaying = v => { playing = v; paint(); stop(); if (playing) pendingT = setTimeout(() => { timer = setInterval(tick, o.ms || 7000); }, o.delay || 0); };
    pp.onclick = () => { if (playing) { userStopped = true; setPlaying(false); } else { userStopped = false; box.loadAll(); setPlaying(true); } };
    track.addEventListener("pointerdown", () => { box.loadAll(); manual(); });
    dots.addEventListener("click", () => { box.loadAll(); manual(); });
    box.addEventListener("mouseenter", () => { hold = true; });
    box.addEventListener("mouseleave", () => { hold = false; });
    box.addEventListener("focusin", () => { hold = true; });
    box.addEventListener("focusout", () => { hold = false; });
    box.append(prev, next, pp);
    setPlaying(playing);
    box.stopAuto = stop; box.setPlaying = setPlaying; box.isPlaying = () => playing; box.userStopped = () => userStopped;
    box.loadAll = () => { while (pending.length) pending.shift()(); };
    // автоход в ленте включает и выключает наблюдатель: сам не стартует при «уменьшить движение» и после остановки пользователем
    box.visible = on => { if (on) { box.loadAll(); if (!userStopped && !reduced()) setPlaying(true); } else if (playing) setPlaying(false); };
    return box;
  }

  // ---------- детали карточки ----------
  function seg(c, onset) {
    const idx = { yes: 0, maybe: 1, no: 2 };
    const el = h("div", { class: "cr-seg", role: "group", "aria-label": "Ваш выбор: " + c.title }, h("i", { "aria-hidden": "true" }),
      REACT.map(([k, label]) => h("button", { type: "button", "data-k": k, "aria-pressed": "false",
        onclick() { setR(c, k); sync(); if (navigator.vibrate) navigator.vibrate(8); onset && onset(); } }, h("span", { class: "cr-ico", "aria-hidden": "true", innerHTML: ICON[k] }), label)));
    function sync() {
      const v = rOf(c);
      el.dataset.set = v ? "1" : ""; el.dataset.v = v; if (v) el.style.setProperty("--i", idx[v]);
      el.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === v)));
    }
    sync(); el.sync = sync;
    return el;
  }
  function facts(c) {
    const noScreen = (S.a && false) || (read("wc:brief:" + couple).a || {}).screen === "Нет";
    const pm = /^(пара|я)[^:]*: (.+)$/i.exec(c.prep || "");
    const prep = pm ? [pm[1].toLowerCase() === "я" ? "С меня" : "С вас", pm[2]] : c.prep && c.prep !== "нет" ? ["Нужно", c.prep] : null;
    const row = (k, v) => h("div", null, h("span", null, k), h("b", null, v));
    return h("div", { class: "cr-facts" },
      row("Длительность", durText(c)),
      prep ? row(prep[0], prep[1]) : null,
      row("Участвуют", c.who || "все"),
      c.pair ? row("Работает вместе с", "«" + c.pair + "»") : null,
      c.screen === "да" ? row("Экран", noScreen ? "нужен — на площадке его нет, обсудим проектор" : "нужен") : null,
      c.screen === "желательно" ? row("Экран", "желателен") : null);
  }
  // Развёрнутое описание показывается сразу, без кнопки-переключателя (правка владельца 16.10.2026).
  function more(c) {
    const mo = MORE[c.id];
    if (!mo || !mo.length) return null;
    return { btn: null, box: h("div", { class: "cr-more" }, mo.map(t => h("p", null, t))) };
  }
  function note(c) {
    const ta = h("textarea", { class: "cr-fld", rows: 2, hidden: !cOf(c), value: cOf(c), placeholder: "Что нравится, что изменить", "aria-label": "Комментарий: " + c.title,
      oninput: e => { grow(e.target); mutate(c, { c: e.target.value }); } });
    const add = h("button", { type: "button", class: "cr-link", hidden: !!cOf(c), onclick: e => { ta.hidden = false; e.currentTarget.hidden = true; grow(ta); ta.focus(); } }, "+ комментарий");
    if (ta.value) requestAnimationFrame(() => grow(ta));
    return { add, ta };
  }

  // ---------- итог ----------
  function toText() {
    const g = picks(), t = totals(), n = pairNames();
    const line = (r, arr) => arr.length ? LABEL[r] + " (" + arr.length + (r === "yes" ? ", ≈ " + t.minutes + " мин" : "") + "): " + arr.map(x => x.o.title + (x.c ? " (" + x.c + ")" : "")).join("; ") : "";
    return ["ПРОГРАММА ВЕЧЕРА · " + n.join(" и "), "", line("yes", g.yes), line("maybe", g.maybe), line("no", g.no), S.a.wish ? "\nПожелание: " + S.a.wish : ""].filter(x => x !== "").join("\n");
  }
  // Отправка программы: тот же приёмник, что у шага 1 (Apps Script → Google Документ + письмо владельцу).
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbwNkv6WGTWhvZ4d1KlBdtSTpKG4gTEg9cc9Y7oAeLlBt57euDRGjrtFSZsq6Its90qmqA/exec";
  async function submitProgram(opt) {
    const btn = document.querySelector(".cr-done");
    if (btn) { btn.disabled = true; btn.textContent = "Отправляю…"; }
    const g = picks(), n = pairNames();
    const items = [["Хотим", g.yes], ["Можно", g.maybe], ["Не наше", g.no]]
      .map(([q, arr]) => ({ q, a: arr.map(x => x.o.title + (x.c ? " (" + x.c + ")" : "")).join("; ") }))
      .filter(x => x.a);
    if (S.a.wish) items.push({ q: "Пожелание", a: S.a.wish });
    const payload = { app: "wedding-constructor", version: "0.1", kind: "program", couple: couple, names: S.a.names || null,
      sentAt: new Date().toISOString(), picks: g.yes.map(x => ({ phase: x.st.title, id: x.o.id, title: x.o.title, r: "yes", c: x.c || "" })),
      doc: [{ section: "Программа вечера · " + n.join(" и "), items }], text: toText() };
    S.delivered = false;
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), redirect: "follow" });
      S.delivered = r.ok && (await r.json()).ok === true;
    } catch (e) { S.delivered = false; }
    S.sent = true; save(); opt.rebuild && opt.rebuild();
  }
  // buildSummary(body, opt): общая разметка итога; оформляет каждая концепция своим CSS. opt.close — закрыть шторку/экран.
  function buildSummary(body, opt) {
    opt = opt || {};
    if (S.sent) { buildDone(body, opt); return; }
    const g = picks(), t = totals(), tl = timeline();
    const list = h("div", { class: "cr-tl" });
    tl.blocks.forEach(b => {
      list.append(h("div", { class: "cr-tlh", style: "--c:" + b.st.hue }, b.st.title + (b.timed ? " · " + hhmm(b.at) : "")));
      b.items.forEach(it => list.append(h("time", { class: "cr-tlt" }, it.t0 != null ? hhmm(it.t0) : "—"),
        h("div", { class: "cr-tlb", style: "--c:" + b.st.hue }, it.o.title, h("small", null, it.d ? it.d + " мин" : "фоном"))));
    });
    if (!g.yes.length) list.append(h("p", { class: "cr-empty" }, "Пока пусто. Откройте любую активность и нажмите «Хотим» — она встанет в порядок вечера."));
    const sub = (title, arr, cls) => arr.length ? [h("h3", null, title + " · " + arr.length),
      h("ul", { class: "cr-ul" }, arr.map(x => h("li", null, h("i", { class: "cr-tag " + cls }, LABEL[cls]), x.o.title, h("small", null, x.st.title))))] : [];
    const nv = Object.assign({ b: "", g: "" }, S.a.names || {});
    const nameIn = (k, who) => h("label", null, h("span", null, who),
      h("input", { type: "text", class: "cr-fld", value: nv[k] || "", placeholder: (namesF && namesF.ph && namesF.ph[k === "b" ? 0 : 1]) || "Имя", autocomplete: "off", "aria-label": (namesF ? namesF.label : "Как вас зовут") + " — " + who, oninput: e => { nv[k] = e.target.value; set("names", Object.assign({}, nv)); } }));
    const wish = h("textarea", { class: "cr-fld", rows: 3, value: S.a.wish || "", "aria-label": wishF ? wishF.label : "Что ещё добавить", oninput: e => { grow(e.target); set("wish", e.target.value); } });
    const msg = h("p", { class: "cr-msg", id: "cr-msg", "aria-live": "polite" });
    body.append(h("div", { class: "cr-sum" },
      h("h2", { id: "cr-title" }, "Порядок вечера"),
      h("p", { class: "cr-sumlead" }, t.yes + " хотим · " + t.maybe + " можно · ≈ " + fmtMin(t.minutes) + " программы. Для примера гости собираются в " + hhmm(START) + ", время подстроим."),
      list, sub("Можно", g.maybe, "maybe"), sub("Не наше", g.no, "no"),
      h("div", { class: "cr-lbl" }, namesF ? namesF.label : "Напомните, как вас зовут"),
      h("div", { class: "cr-pair" }, nameIn("b", "Невеста"), nameIn("g", "Жених")),
      h("div", { class: "cr-lbl" }, wishF ? wishF.label : "Что ещё добавить в программу?"),
      wishF && wishF.hint ? h("p", { class: "cr-hint" }, wishF.hint) : null, wish, msg,
      h("button", { class: "cr-done", type: "button", onclick: () => submitProgram(opt) }, "Отправить Григорию"),
      h("div", { class: "cr-acts" }, h("button", { class: "cr-ghost", type: "button", onclick: copy }, "Скопировать текстом"), h("button", { class: "cr-ghost", type: "button", "data-act": "marks", onclick: copyMarks }, "Скопировать мои отметки"), h("button", { class: "cr-ghost", type: "button", "data-act": "share-marks", onclick: shareMarks }, "Поделиться отметками"))));
    requestAnimationFrame(() => grow(wish));
  }
  function buildDone(body, opt) {
    const d = FORM.done;
    body.append(h("div", { class: "cr-sum cr-sent" },
      h("h2", { id: "cr-title" }, d.title), h("p", null, d.text), h("p", { class: "cr-kick" }, S.delivered ? "Отправлено Григорию: документ и письмо на почту" : "Не дошло до приёмника — скопируйте текст и отправьте в чат"),
      h("p", { class: "cr-msg", id: "cr-msg", "aria-live": "polite" }),
      h("div", { class: "cr-acts" },
        h("button", { class: "cr-ghost", type: "button", onclick: copy }, "Скопировать текстом"),
        h("button", { class: "cr-link", type: "button", onclick: () => { S.sent = false; save(); opt.rebuild && opt.rebuild(); } }, "Вернуться и поправить ответы"))));
  }
  // Список отметок по этапам для буфера обмена (только локально, ничего не отправляется)
  function marksText() {
    const n = pairNames(), t = totals();
    const out = ["МОИ ОТМЕТКИ · " + n.join(" и "), "Хотим " + t.yes + " · можно " + t.maybe + " · не наше " + t.no + " · из " + t.all, ""];
    stages.forEach(st => {
      const g = { yes: [], maybe: [], no: [] };
      st.cards.forEach(c => { const r = rOf(c); if (g[r]) g[r].push(c.title); });
      if (!g.yes.length && !g.maybe.length && !g.no.length) return;
      out.push(st.title.toUpperCase());
      [["yes", "Хотим"], ["maybe", "Можно"], ["no", "Не наше"]].forEach(([k, l]) => { if (g[k].length) { out.push(l + ":"); g[k].forEach(x => out.push("— " + x)); } });
      out.push("");
    });
    return out.join("\n").trim();
  }
  const say = t => { const m = document.getElementById("cr-msg"); if (m) m.textContent = t; };
  async function copyMarks() {
    say((await clipCopy(marksText())) ? "Отметки скопированы. Вставьте их в сообщение или заметку." : "Не получилось скопировать — выделите текст на экране вручную.");
  }
  // Копирование: современный буфер → запасной путь через скрытое поле (работает и без https)
  async function clipCopy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    try { const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0"; document.body.append(t); t.select(); t.setSelectionRange(0, text.length); const ok = document.execCommand("copy"); t.remove(); return !!ok; } catch (e) { return false; }
  }
  // Системное «Поделиться» (на iPhone — лист с Telegram и Сообщениями): только текст отметок, без ключей, ботов и запросов наружу; запасной вариант — копирование
  async function shareMarks() {
    const text = marksText();
    if (navigator.share) {
      try { await navigator.share({ title: "Мои отметки · " + pairNames().join(" и "), text }); say("Готово: отметки отправлены через «Поделиться»."); return; }
      catch (e) { if (e && e.name === "AbortError") { say("Отправка отменена. Отметки можно скопировать."); return; } }
    }
    say((await clipCopy(text)) ? "«Поделиться» здесь недоступно — отметки скопированы. Вставьте их в Telegram или сообщение." : "Не получилось ни поделиться, ни скопировать — выделите текст на экране вручную.");
  }
  async function copy() {
    const m = document.getElementById("cr-msg");
    try { await navigator.clipboard.writeText(toText()); if (m) m.textContent = "Ответы скопированы."; }
    catch (e) { if (m) m.textContent = "Не получилось скопировать — выделите текст вручную."; }
  }

  window.WCR = { shareMarks, clipCopy, BANK, HAS_SET, BANK_TOTAL, marksText, copyMarks, FORM, MORE, qs, couple, greet, stages, cards, HUE, UNTIMED, START, REACT, LABEL, IMG, ICON, icon, h, hhmm, fmtMin, durText, grow, filled, reduced, init, on: fn => subs.push(fn), emit,
    rOf, cOf, setR, mutate, set, picks, totals, stageMinutes, stageCounts, timeline, pairNames, spring, project, rubber, makeSheet, carousel, seg, facts, more, note, buildSummary, toText, copy,
    get S() { return S; }, namesF, wishF };
})();
