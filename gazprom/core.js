// Страница выбора идей (корпоратив Газпром ПХГ, профсоюз, 29.10.2026, 47 гостей). Данные: data/data-program.js (IDEAS) и data/more.js (SETS).
// Логика и имена перенесены из рабочей страницы site/gazprom: IDEAS, SETS, KEY, st, paint, summary, save, ENDPOINT, id send / sheet / push / copy / save.
// Отметки хранятся в браузере. Наружу уходит только то, что организатор отправил кнопкой «Отправить ведущему».
// Ключи адреса: ?demo=1 (примерные отметки для кадров, в память не пишутся) · ?reset=1 (очистить сохранённый выбор).
(function () {
  "use strict";
  var KEY = "gazprom-evening-2026-10-29";
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbwNkv6WGTWhvZ4d1KlBdtSTpKG4gTEg9cc9Y7oAeLlBt57euDRGjrtFSZsq6Its90qmqA/exec";
  var qs = new URLSearchParams(location.search);
  var SETS = window.SETS || [];
  var LAB = { y: "Хотим", m: "Можно", n: "Не наше" };
  // значок + слово + цвет: состояние понятно не только цветом
  var ICON = {
    y: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
    m: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.6 6.1c0-1.4 1-2.3 2.4-2.3s2.4.9 2.4 2.1c0 1.9-2.4 1.9-2.4 3.7"/><path d="M8 12.4v.1"/></svg>',
    n: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>'
  };
  var SLUG = { "Игры за столами": "tables", "С участием коллег": "people", "Песни": "songs", "Фоном весь вечер": "bg" };
  var TAB = { tables: "Столы", people: "Коллеги", songs: "Песни", bg: "Фоном" };
  var HUE = { tables: 212, people: 200, songs: 192, bg: 222 };

  function $(i) { return document.getElementById(i); }
  function el(tag, attrs) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { var v = attrs[k]; if (v == null || v === false) continue; if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; if (Array.isArray(c)) c.forEach(function (x) { x != null && e.append(x.nodeType ? x : document.createTextNode(x)); }); else e.append(c.nodeType ? c : document.createTextNode(c)); }
    return e;
  }
  function plural(n, a, b, c5) { var m = n % 100, k = n % 10; return m > 10 && m < 15 ? c5 : k === 1 ? a : k > 1 && k < 5 ? b : c5; }
  function reduced() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }

  // ——— память ———
  var st = {};
  try { if (qs.has("reset")) localStorage.removeItem(KEY); var raw = localStorage.getItem(KEY); if (raw) st = JSON.parse(raw) || {}; } catch (e) { st = {}; }
  if (qs.has("demo") && !Object.keys(st).length) IDEAS.forEach(function (i, n) { var r = n % 5 === 3 ? "m" : n % 7 === 5 ? "n" : n % 3 === 0 || n % 3 === 1 ? "y" : ""; if (r) st[i.id] = r; });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* без памяти работаем в рамках сессии */ } }

  // ——— группы ———
  var groups = [];
  IDEAS.forEach(function (i) { var g = groups.filter(function (x) { return x.name === i.group; })[0]; if (!g) { g = { name: i.group, lead: i.glead, slug: SLUG[i.group] || ("g" + (groups.length + 1)), items: [] }; groups.push(g); } g.items.push(i); });

  // ——— разметка: карточки по группам ———
  var main = $("main"), cardEl = {}, segEl = {}, stateEl = {}, groupEl = {}, tabEl = {}, scaleEl = {};
  var tabsBox = $("tabs"), thumb = tabsBox.querySelector(".thumb"), scaleBox = $("scale");

  function segFor(i) {
    var seg = el("div", { class: "seg", role: "group", "aria-label": "Ваш выбор: " + i.title }, el("i", { "aria-hidden": "true" }));
    ["y", "m", "n"].forEach(function (k) {
      var b = el("button", { type: "button", class: "k-" + k, "data-v": k, "aria-pressed": "false" }, el("span", { class: "ico", "aria-hidden": "true", html: ICON[k] }), LAB[k]);
      b.addEventListener("click", function () { mark(i, k); });
      seg.append(b);
    });
    return seg;
  }
  function cardFor(i, g) {
    var seg = segFor(i), pill = el("span", { class: "state", "aria-hidden": "true" });
    var need = String(i.need || "").replace(/^С вас:\s*/, "");
    var how = el("div", { class: "how" }, el("h4", null, "Как это проходит"), el("p", { class: "more" }, i.more));
    var c = el("article", { class: "item", id: "c-" + i.id, "data-id": i.id, "data-v": "" },
      pill,
      el("figure", { class: "pic", "aria-hidden": "true" },
        el("img", { src: "assets/img/corp/" + i.id + ".webp", alt: "", loading: "lazy", decoding: "async", width: 1200, height: 800,
          onerror: function () { this.parentNode.remove(); } })),
      el("div", { class: "ihead" },
        el("span", { class: "tent", role: "img", "aria-label": i.min + " " + plural(i.min, "минута", "минуты", "минут") },el("b", null, String(i.min)), el("i", null, "мин")),
        el("div", { class: "ititle" }, el("h3", null, i.title), i.suggest ? el("span", { class: "tag" }, "предложение") : null)),
      el("p", { class: "why" }, i.why),
      el("dl", { class: "facts" },
        el("div", null, el("dt", null, "Участвуют"), el("dd", null, i.who)),
        el("div", null, el("dt", null, "С вас"), el("dd", null, need))),
      how, seg);
    cardEl[i.id] = c; segEl[i.id] = seg; stateEl[i.id] = pill;
    return c;
  }
  groups.forEach(function (g, gi) {
    var hue = HUE[g.slug] || 205;
    var tab = el("button", { class: "tab", type: "button", "aria-label": g.name, onclick: function () { go("s-" + g.slug); } }, TAB[g.slug] || g.name);
    tabEl[g.slug] = tab; tabsBox.append(tab);
    var sc = el("i", { style: "--w:" + g.items.length + ";--p:0" }); scaleEl[g.slug] = sc; scaleBox.append(sc);
    var cnt = el("p", { class: "stm", id: "stm-" + g.slug });
    groupEl[g.slug] = cnt;
    var sec = el("section", { class: "stage", id: "s-" + g.slug, "data-id": g.slug, style: "--h:" + hue, "aria-labelledby": "h-" + g.slug },
      el("div", { class: "stage-in" },
        el("header", { class: "stage-head" },
          el("p", { class: "when" }, "Группа " + (gi + 1) + " из " + groups.length + " · " + g.items.length + " " + plural(g.items.length, "идея", "идеи", "идей")),
          el("h2", { id: "h-" + g.slug }, g.name),
          el("p", { class: "lead" }, g.lead), cnt),
        el("div", { class: "grid" }, g.items.map(function (i) { return cardFor(i, g); }))));
    main.append(sec);
  });
  main.append(el("p", { class: "foot" }, "Ведущий: Григорий. Время каждой игры примерное, точный порядок согласуем с вами."));

  function go(id) { var t = $(id); if (t) t.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); }
  var cta = $("goFirst"); if (cta) cta.addEventListener("click", function (e) { e.preventDefault(); go("s-" + groups[0].slug); });

  // ——— наборы ———
  var setsEl = $("sets");
  SETS.forEach(function (S) {
    var b = el("button", { type: "button", class: "set", "data-id": S.id, "aria-pressed": "false" }, el("b", null, S.name), el("span", null, S.desc), el("span", { class: "ok", "aria-hidden": "true", html: ICON.y }));
    b.addEventListener("click", function () {
      var before = JSON.stringify(st), ids = S.ids === "all" ? IDEAS.map(function (x) { return x.id; }) : S.ids;
      IDEAS.forEach(function (i) { st[i.id] = ids.indexOf(i.id) >= 0 ? "y" : "n"; });
      st._set = S.id; save(); paint();
      notify("Набор «" + S.name + "»: " + ids.length + " " + plural(ids.length, "игра", "игры", "игр") + " отмечено «Хотим»", function () { st = JSON.parse(before); save(); paint(); });
    });
    setsEl.append(b);
  });

  // ——— отметка ———
  function mark(i, k) {
    var prev = st[i.id] || "", now = prev === k ? "" : k;
    st[i.id] = now; delete st._set; save(); paint(i.id);
    var b = segEl[i.id].querySelector('[data-v="' + k + '"]'); if (b && now && !reduced()) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    notify(now ? "«" + i.title + "» — " + LAB[now] : "Отметка снята: «" + i.title + "»", function () { st[i.id] = prev; delete st._set; save(); paint(i.id); });
  }
  function syncSeg(seg, v) {
    var idx = { y: 0, m: 1, n: 2 }, th = seg.firstElementChild, had = seg.dataset.set === "1";
    if (v) seg.dataset.v = v; // при снятии отметки ползунок гаснет прежним цветом
    if (v) {
      if (!had) { th.style.transition = "none"; seg.style.setProperty("--i", idx[v]); void th.offsetWidth; th.style.transition = ""; } else seg.style.setProperty("--i", idx[v]);
      seg.dataset.set = "1";
    } else seg.dataset.set = "";
    [].forEach.call(seg.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === v)); });
  }

  // ——— итог ———
  function totals() {
    var t = { y: 0, m: 0, n: 0, done: 0, mins: 0 };
    IDEAS.forEach(function (i) { var v = st[i.id] || ""; if (v) { t.done++; t[v]++; } if (v === "y") t.mins += i.min; });
    return t;
  }
  var lastMark = "";
  function paint() {
    IDEAS.forEach(function (i) {
      var v = st[i.id] || "", c = cardEl[i.id];
      c.dataset.v = v; syncSeg(segEl[i.id], v);
      if (v) stateEl[i.id].innerHTML = '<span class="ico">' + ICON[v] + "</span>" + LAB[v]; // при снятии отметки метка плавно гаснет с прежним словом
    });
    [].forEach.call(setsEl.children, function (b) { b.setAttribute("aria-pressed", st._set === b.dataset.id ? "true" : "false"); });
    var t = totals(), all = IDEAS.length;
    var prog = $("prog"); prog.textContent = t.done + " из " + all; prog.setAttribute("aria-label", "Отмечено " + t.done + " из " + all + " идей"); prog.style.setProperty("--p", (all ? t.done / all : 0).toFixed(3));
    if (lastMark !== "" && lastMark !== String(t.done) && !reduced()) { prog.classList.remove("tick"); void prog.offsetWidth; prog.classList.add("tick"); }
    lastMark = String(t.done);
    $("barfill").style.width = (all ? t.done / all * 100 : 0) + "%";
    var num = function (n) { return '<b class="num">' + n + "</b>"; };
    $("sum").innerHTML = t.done
      ? "<span>Хотим " + num(t.y) + " · можно " + num(t.m) + "</span><small>не наше " + num(t.n) + " · ≈ " + num(t.mins) + " мин</small>"
      : "<span>Пока ничего не отмечено</span><small>Выберите набор или игры</small>";
    groups.forEach(function (g) {
      var d = 0, y = 0; g.items.forEach(function (i) { var v = st[i.id] || ""; if (v) d++; if (v === "y") y += i.min; });
      scaleEl[g.slug].style.setProperty("--p", (d / g.items.length).toFixed(3));
      groupEl[g.slug].textContent = d ? "Отмечено " + d + " из " + g.items.length + (y ? " · по «Хотим» ≈ " + y + " мин" : "") : "";
    });
    if (sheetOn) fillSheet();
  }

  // ——— текст выбора (он же уходит ведущему) ———
  function summary() {
    var L = ["Идеи для вечера: Газпром ПХГ, профсоюз, 29.10.2026, 47 человек.", ""];
    var y = [], m = [], n = [], none = [];
    IDEAS.forEach(function (i) { var v = st[i.id] || ""; (v === "y" ? y : v === "m" ? m : v === "n" ? n : none).push(i); });
    var mins = y.reduce(function (s, i) { return s + i.min; }, 0);
    function sec(t, a) { if (a.length) { L.push(t + " (" + a.length + "):"); a.forEach(function (i) { L.push("• " + i.title + " — " + i.min + " мин"); }); L.push(""); } }
    sec("ХОТИМ", y); sec("МОЖНО", m); sec("НЕ НАШЕ", n); sec("НЕ ОТМЕЧЕНО", none);
    L.push("Игр по «Хотим»: около " + mins + " минут.");
    return L.join("\n");
  }

  // ——— уведомление об отметке с отменой ———
  var toast = $("toast"), tmsg = $("tmsg"), tundo = $("tundo"), undoFn = null, tTimer = 0;
  function hideToast() { toast.classList.remove("on"); }
  function notify(text, undo) {
    var live = $("glive"); live.textContent = ""; setTimeout(function () { live.textContent = text; }, 30);
    tmsg.textContent = text; undoFn = undo || null; tundo.hidden = !undo; toast.classList.add("on");
    clearTimeout(tTimer); tTimer = setTimeout(hideToast, 4600);
  }
  tundo.addEventListener("click", function () { hideToast(); var f = undoFn; undoFn = null; if (f) { f(); $("glive").textContent = "Отметка возвращена"; } });

  // ——— шторка отправки ———
  var sheet = $("sheet"), scrim = $("scrim"), msg = $("msg"), sheetOn = false, opener = null, sendS = "idle", sentSig = "";
  var behind = [main, $("top"), $("dock"), $("toast"), $("toTop")];
  function setMsg(state, text) { msg.dataset.s = state; msg.textContent = text; }
  function setSend(state, text) {
    sendS = state; sheet.dataset.s = state; var b = $("push");
    b.setAttribute("aria-disabled", state === "busy" || state === "ok" ? "true" : "false");
    $("pushl").textContent = state === "busy" ? "Отправляю…" : state === "ok" ? "Отправлено ✓" : state === "err" ? "Повторить отправку" : "Отправить ведущему";
    setMsg(state === "idle" ? "" : state === "busy" ? "busy" : state, text || "");
  }
  function fillSheet() {
    var t = totals(), box = $("digest");
    box.innerHTML = "";
    [["y", "Хотим", t.y], ["m", "Можно", t.m], ["n", "Не наше", t.n]].forEach(function (r) {
      box.append(el("div", { class: "dg dg-" + r[0] }, el("span", { class: "dgl" }, el("span", { class: "ico", "aria-hidden": "true", html: ICON[r[0]] }), r[1]), el("b", { class: "num" }, String(r[2]))));
    });
    box.append(el("div", { class: "dg dg-t" }, el("span", { class: "dgl" }, "Минут по «Хотим»"), el("b", { class: "num" }, "≈ " + t.mins)));
    $("pre").textContent = summary();
    $("emptyhint").hidden = t.done > 0;
  }
  function openSheet() {
    opener = document.activeElement; hideToast();
    if (sentSig && sentSig !== JSON.stringify(st) && (sendS === "ok")) setSend("idle");
    if (sendS === "busy") { /* отправка уже идёт: показываем её состояние */ } else if (sendS === "err") { /* оставляем сообщение об ошибке */ } else if (sendS !== "ok") setSend("idle");
    sheetOn = true; fillSheet();
    sheet.setAttribute("aria-hidden", "false"); sheet.inert = false; scrim.classList.add("on"); sheet.classList.add("on");
    behind.forEach(function (n) { if (n) n.inert = true; });
    document.documentElement.classList.add("sheet-open");
    sheet.querySelector(".cr-sheet-body").scrollTop = 0;
    sheet.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheetOn) return; sheetOn = false;
    scrim.classList.remove("on"); sheet.classList.remove("on"); sheet.setAttribute("aria-hidden", "true"); sheet.inert = true;
    behind.forEach(function (n) { if (n) n.inert = false; });
    document.documentElement.classList.remove("sheet-open");
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  sheet.inert = true; sheet.setAttribute("aria-hidden", "true");
  $("send").onclick = openSheet;
  $("shx").onclick = closeSheet;
  scrim.addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheetOn) closeSheet(); });

  $("copy").onclick = function () {
    var t = summary();
    var fallback = function () {
      try { var ta = el("textarea", { readonly: true }); ta.value = t; ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0"; document.body.append(ta); ta.select(); ta.setSelectionRange(0, t.length); var ok = document.execCommand("copy"); ta.remove(); if (ok) { setMsg("info", "Скопировано. Вставьте в Telegram ведущему @komarez."); return; } } catch (e) { /* ниже выделим текст на экране */ }
      var r = document.createRange(); r.selectNodeContents($("pre")); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      setMsg("info", "Не удалось скопировать автоматически: текст выделен, нажмите «Копировать» вручную.");
    };
    try { navigator.clipboard.writeText(t).then(function () { setMsg("info", "Скопировано. Вставьте в Telegram ведущему @komarez."); }, fallback); } catch (e) { fallback(); }
  };
  $("save").onclick = function () {
    var t = summary(), name = "Выбор-игр-Газпром-29-10.txt";
    (window.claude && claude.use ? claude.use("downloads") : Promise.resolve(null)).then(function (d) {
      if (d) return d.save({ filename: name, data: t }).then(function () { setMsg("info", "Файл сохранён."); });
      var f = new Blob(["﻿" + t], { type: "text/plain;charset=utf-8" }), url = URL.createObjectURL(f), a = el("a", { href: url, download: name });
      document.body.append(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      setMsg("info", "Файл «" + name + "» сохранён на устройство. Пришлите его в Telegram @komarez или приложите к письму.");
    }).catch(function () { setMsg("err", "Файл не сохранён. Нажмите «Скопировать для Telegram» и вставьте текст в сообщение."); });
  };
  if (ENDPOINT) { $("push").hidden = false; $("copy").classList.remove("main"); $("push").classList.add("main"); } else { $("push").hidden = true; }
  $("push").onclick = function () {
    if (sendS === "busy" || sendS === "ok") return;
    var doc = [], mk = function (t, a) { if (a.length) doc.push({ section: t, items: a.map(function (i) { return { q: i.title, a: i.min + " мин" }; }) }); };
    var y = [], m = [], n = []; IDEAS.forEach(function (i) { var v = st[i.id] || ""; (v === "y" ? y : v === "m" ? m : v === "n" ? n : []).push(i); });
    mk("Хотим", y); mk("Можно", m); mk("Не наше", n);
    var payload = { app: "wedding-constructor", kind: "program", couple: "gazprom-phg-29-10", names: { b: "Газпром ПХГ, профсоюз, 29.10", g: "" }, answers: st, doc: doc, text: summary() };
    var sig = JSON.stringify(st);
    setSend("busy", "Отправляю ведущему. Это занимает несколько секунд.");
    var ctl = "AbortController" in window ? new AbortController() : null, to = setTimeout(function () { ctl && ctl.abort(); }, 30000);
    fetch(ENDPOINT, { method: "POST", mode: "cors", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) { sentSig = sig; setSend("ok", "Отправлено. Ведущий получил ваш выбор. Спасибо!"); } else { throw new Error("no"); } })
      .catch(function () { setSend("err", "Не получилось отправить. Нажмите «Скопировать для Telegram» и вставьте текст ведущему @komarez или сохраните файл."); })
      .then(function () { clearTimeout(to); });
  };

  // ——— вкладки: ползунок-линза, сворачивание шапки ———
  var curTab = groups[0].slug;
  function moveThumb(slug) {
    var t = tabEl[slug]; if (!t) return;
    thumb.style.width = t.offsetWidth + "px"; thumb.style.transform = "translateX(" + t.offsetLeft + "px)";
    if (tabEl[curTab]) tabEl[curTab].removeAttribute("aria-current"); curTab = slug; t.setAttribute("aria-current", "true");
    var box = tabsBox.getBoundingClientRect(), tb = t.getBoundingClientRect();
    if (tabsBox.scrollWidth > tabsBox.clientWidth + 2) tabsBox.scrollTo({ left: tabsBox.scrollLeft + (tb.left - box.left) - (box.width - tb.width) / 2, behavior: reduced() ? "auto" : "smooth" });
  }
  var redo = function () { thumb.style.transition = "none"; moveThumb(curTab); requestAnimationFrame(function () { thumb.style.transition = ""; }); };
  tabEl[curTab].setAttribute("aria-current", "true"); requestAnimationFrame(redo); addEventListener("resize", redo); if (document.fonts && document.fonts.ready) document.fonts.ready.then(redo);
  var topEl = $("top");
  function setPanel() { if (!document.body.classList.contains("compact")) document.documentElement.style.setProperty("--panel-b", Math.round(topEl.getBoundingClientRect().bottom) + "px"); }
  if (window.ResizeObserver) new ResizeObserver(setPanel).observe(topEl); addEventListener("resize", setPanel); if (document.fonts && document.fonts.ready) document.fonts.ready.then(setPanel); setPanel();
  var scrollTick = 0;
  function onScroll() {
    scrollTick = 0;
    document.body.classList.toggle("compact", scrollY > 180);
    var line = innerHeight * 0.4, cur = null;
    groups.forEach(function (g) { var r = $("s-" + g.slug).getBoundingClientRect(); if (r.top <= line && r.bottom > line) cur = g.slug; });
    if (cur && cur !== curTab) moveThumb(cur);
    var up = $("toTop"); if (up) up.classList.toggle("on", scrollY > 1100);
  }
  addEventListener("scroll", function () { if (!scrollTick) scrollTick = requestAnimationFrame(onScroll); }, { passive: true });
  var up = $("toTop"); if (up) up.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); });

  paint(); onScroll();
})();
