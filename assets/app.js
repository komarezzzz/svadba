// Движок конструктора: рисует страницу по схеме window.WC_FORM, сам сохраняет ответы и отправляет их.
(function () {
  "use strict";
  const CFG = window.WC_CONFIG, FORM = window.WC_FORM;
  const qs = new URLSearchParams(location.search);
  const couple = (qs.get("c") || "para").toLowerCase().replace(/[^a-z0-9а-яё_-]/gi, "").slice(0, 40) || "para";
  // Обращение на первом экране: ?n=… или из метки вида «юля-и-серёжа».
  const greet = (qs.get("n") || (couple.includes("-и-") ? couple.split("-").filter(Boolean).map(w => w === "и" ? w : w[0].toUpperCase() + w.slice(1)).join(" ") : "")).slice(0, 60);
  const KEY = "wc:" + FORM.kind + ":" + couple;
  const N = FORM.sections.length;
  const REACT = [["yes", "Хотим"], ["maybe", "Можно"], ["no", "Не наше"]];

  function read(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
  const S = Object.assign({ a: {}, i: -1, sent: false, delivered: false }, read(KEY));
  if (FORM.kind === "program" && !filled(S.a.names)) {
    const b = read("wc:brief:" + couple).a;
    if (b && b.names) S.a.names = b.names;
  }
  const NO_SCREEN = read("wc:brief:" + couple).a && read("wc:brief:" + couple).a.screen === "Нет";
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* личный режим браузера — работаем без памяти */ } }

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

  function filled(v) {
    if (v == null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "number") return true;
    if (typeof v === "boolean") return v;
    if (Array.isArray(v)) return v.some(filled);
    return Object.values(v).some(filled);
  }
  const counted = f => f.type !== "summary" && !f.optional;
  function ratio(sec) {
    const fs = sec.fields.filter(counted);
    return fs.length ? fs.filter(f => filled(S.a[f.id])).length / fs.length : 1;
  }
  function pairNames() {
    const n = S.a.names || {}, first = s => (s || "").trim().split(/\s+/)[0];
    return [first(n.b) || "Невеста", first(n.g) || "Жених"];
  }

  // ---------- запись ответа ----------
  let savedTimer;
  function set(id, val) {
    S.a[id] = val;
    S.sent = false;
    save();
    paintRail();
    const s = document.getElementById("saved");
    if (s) { s.classList.add("on"); clearTimeout(savedTimer); savedTimer = setTimeout(() => s.classList.remove("on"), 1400); }
  }
  function grow(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }

  // ---------- поля ----------
  function input(f, value, onval, ph, label) {
    if (f === "long") {
      const t = h("textarea", { rows: 3, value: value || "", placeholder: ph || "", "aria-label": label, oninput: e => { grow(e.target); onval(e.target.value); } });
      requestAnimationFrame(() => grow(t));
      return t;
    }
    return h("input", { type: f === "date" ? "date" : "text", value: value || "", placeholder: ph || "", "aria-label": label, oninput: e => onval(e.target.value) });
  }

  const FIELD = {
    text: f => input("text", S.a[f.id], v => set(f.id, v), f.ph, f.label),
    date: f => input("date", S.a[f.id], v => set(f.id, v), "", f.label),
    long: f => input("long", S.a[f.id], v => set(f.id, v), f.ph, f.label),
    pair(f) {
      const v = Object.assign({ b: "", g: "" }, S.a[f.id]);
      const names = f.id === "names" ? ["Невеста", "Жених"] : pairNames();
      const col = (k, i) => h("label", { class: "who who-" + k },
        h("span", { class: "who-name" }, names[i]),
        input(f.sub, v[k], val => { v[k] = val; set(f.id, v); }, f.ph && f.ph[i], f.label + " — " + names[i]));
      return h("div", { class: "pair" }, col("b", 0), col("g", 1));
    },
    choice(f) {
      const box = h("div", { class: "chips", role: "radiogroup", "aria-label": f.label });
      f.options.forEach(o => box.append(h("button", {
        type: "button", class: "chip", role: "radio", "aria-checked": String(S.a[f.id] === o),
        onclick() { set(f.id, S.a[f.id] === o ? "" : o); box.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-checked", String(c.textContent === S.a[f.id]))); }
      }, o)));
      return box;
    },
    chips(f) {
      const cur = () => S.a[f.id] || [];
      const box = h("div", { class: "chips" + (f.tone === "no" ? " chips-no" : ""), role: "group", "aria-label": f.label });
      f.options.forEach(o => box.append(h("button", {
        type: "button", class: "chip", "aria-pressed": String(cur().includes(o)),
        onclick(e) { const on = !cur().includes(o); set(f.id, on ? cur().concat(o) : cur().filter(x => x !== o)); e.currentTarget.setAttribute("aria-pressed", String(on)); }
      }, o)));
      if (!f.other) return box;
      return h("div", null, box, h("input", { type: "text", class: "other", value: S.a[f.id + "__other"] || "", placeholder: "Своё — через запятую", "aria-label": f.label + ": свой вариант", oninput: e => set(f.id + "__other", e.target.value) }));
    },
    scale(f) {
      const box = h("div", { class: "scale-dots", role: "radiogroup", "aria-label": f.label });
      for (let n = 1; n <= 5; n++) box.append(h("button", {
        type: "button", class: "dot", role: "radio", "aria-checked": String(S.a[f.id] === n), "aria-label": n + " из 5",
        onclick() { set(f.id, n); box.querySelectorAll(".dot").forEach((d, i) => d.setAttribute("aria-checked", String(i + 1 === n))); }
      }, String(n)));
      return h("div", { class: "scale" }, h("span", { class: "scale-l" }, f.left), box, h("span", { class: "scale-r" }, f.right));
    },
    list(f) {
      const rows = (S.a[f.id] || []).slice();
      if (!rows.length) rows.push("");
      const box = h("ol", { class: "list" });
      const row = (val, i) => h("li", null, h("input", { type: "text", value: val, placeholder: f.ph || "", "aria-label": f.label + ", " + (i + 1), oninput: e => { rows[i] = e.target.value; set(f.id, rows.slice()); } }));
      rows.forEach((r, i) => box.append(row(r, i)));
      const add = h("button", { type: "button", class: "ghost small", onclick() { rows.push(""); box.append(row("", rows.length - 1)); box.lastChild.querySelector("input").focus(); } }, "+ ещё один");
      return h("div", null, box, add);
    },
    check(f) {
      return h("label", { class: "check" },
        h("input", { type: "checkbox", checked: !!S.a[f.id], onchange: e => set(f.id, e.target.checked) }),
        h("span", { class: "check-box", "aria-hidden": "true" }),
        h("span", null, h("b", null, f.label), f.hint ? h("small", null, f.hint) : null));
    },
    pick(f) {
      const val = () => S.a[f.id] || {};
      const count = h("p", { class: "hint pick-count", "aria-live": "polite" });
      const recount = () => {
        const yes = f.options.filter(o => (val()[o.id] || {}).r === "yes");
        const mins = yes.reduce((s, o) => s + (o.dur || 0), 0);
        count.textContent = yes.length ? "В этой фазе вы точно хотите: " + yes.length + (mins ? " · ≈ " + mins + " мин" : " · идёт фоном") : "";
        count.hidden = !yes.length;
      };
      recount();
      return h("div", { class: "picks" }, f.options.map(o => {
        const cur = () => val()[o.id] || {};
        const card = h("article", { class: "pick", "data-r": cur().r || "" });
        const note = h("textarea", { rows: 2, class: "note", hidden: !cur().c, value: cur().c || "", placeholder: "Комментарий: что нравится, что изменить", "aria-label": "Комментарий: " + o.title,
          oninput: e => { grow(e.target); set(f.id, Object.assign({}, val(), { [o.id]: Object.assign({}, cur(), { c: e.target.value }) })); } });
        const btns = h("div", { class: "react", role: "radiogroup", "aria-label": o.title });
        REACT.forEach(([r, label]) => btns.append(h("button", {
          type: "button", class: "r r-" + r, role: "radio", "aria-checked": String(cur().r === r),
          onclick() {
            const next = cur().r === r ? "" : r;
            set(f.id, Object.assign({}, val(), { [o.id]: Object.assign({}, cur(), { r: next }) }));
            card.dataset.r = next;
            recount();
            btns.querySelectorAll(".r").forEach(b => b.setAttribute("aria-checked", String(b.classList.contains("r-" + next))));
          }
        }, label)));
        const meta = [o.dur ? o.dur + " мин" : "фоном", o.tag].filter(Boolean);
        const pm = /^(пара|я)[^:]*: (.+)$/.exec(o.prep || "");
        const prep = pm ? (pm[1] === "я" ? "С меня: " : "С вас: ") + pm[2] : o.prep && o.prep !== "нет" ? "Нужно: " + o.prep : "";
        const screen = o.screen === "да" ? (NO_SCREEN ? "Нужен экран — на площадке его нет, обсудим проектор" : "Нужен экран") : "";
        card.append(
          h("div", { class: "pick-head" }, h("h3", null, o.title), h("span", { class: "pick-meta" }, meta.map((m, i) => h("span", { class: i ? "tag" : "" }, m)))),
          h("p", null, o.text),
          prep || screen || o.pair ? h("ul", { class: "needs" }, prep ? h("li", null, prep) : null, o.pair ? h("li", null, "Работает вместе с «" + o.pair + "»") : null, screen ? h("li", { class: NO_SCREEN ? "warn" : "" }, screen) : null) : null,
          btns,
          h("button", { type: "button", class: "link", onclick(e) { note.hidden = false; e.currentTarget.hidden = true; note.focus(); }, hidden: !!cur().c }, "+ комментарий"),
          note);
        return card;
      }), count);
    },
    summary() {
      const groups = collectPicks();
      if (!groups.yes.length && !groups.maybe.length) return h("p", { class: "empty" }, "Пока ничего не отмечено. Вернитесь к фазам вечера — там достаточно просто нажимать.");
      const mins = groups.yes.reduce((s, x) => s + (x.o.dur || 0), 0);
      const block = (title, arr, cls) => arr.length ? h("div", { class: "sum-block " + cls }, h("h3", null, title + " · " + arr.length),
        h("ul", null, arr.map(x => h("li", null, h("b", null, x.o.title), h("span", null, x.sec.title))))) : null;
      return h("div", { class: "sum" },
        h("p", { class: "sum-total" }, h("b", null, "≈ " + mins + " мин"), " программы из того, что вы точно хотите. Остальное время — банкет, тосты и танцы."),
        block("Хотим", groups.yes, "yes"), block("Можно", groups.maybe, "maybe"), block("Не наше", groups.no, "no"));
    }
  };

  function collectPicks() {
    const g = { yes: [], maybe: [], no: [] };
    FORM.sections.forEach(sec => sec.fields.forEach(f => {
      if (f.type !== "pick") return;
      f.options.forEach(o => { const v = (S.a[f.id] || {})[o.id]; if (v && g[v.r]) g[v.r].push({ o, sec, c: v.c }); });
    }));
    return g;
  }

  function fieldNode(f) {
    const body = FIELD[f.type](f);
    if (f.type === "check" || f.type === "pick" || f.type === "summary") return h("div", { class: "field field-" + f.type, id: "f-" + f.id }, body);
    return h("div", { class: "field field-" + f.type + (f.big ? " big" : ""), id: "f-" + f.id },
      h("div", { class: "label" }, f.label, f.optional ? h("i", null, " · по желанию") : null),
      f.hint ? h("p", { class: "hint" }, f.hint) : null, body);
  }

  // ---------- экраны ----------
  const app = document.getElementById("app");
  let rail;

  function paintRail() {
    if (!rail) return;
    rail.querySelectorAll("button").forEach((b, i) => {
      b.style.setProperty("--fill", Math.round(ratio(FORM.sections[i]) * 100) + "%");
      b.setAttribute("aria-current", i === S.i ? "step" : "false");
    });
  }

  function go(i) {
    S.i = Math.max(-1, Math.min(N, i));
    save(); render();
    window.scrollTo(0, 0);
    const t = app.querySelector("h1, h2");
    if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
  }

  function header() {
    rail = h("nav", { class: "rail", "aria-label": "Разделы" }, FORM.sections.map((s, i) =>
      h("button", { type: "button", title: s.title, "aria-label": (i + 1) + ". " + s.title, onclick: () => go(i) }, h("span", null, String(i + 1).padStart(2, "0")))));
    return h("header", { class: "top" },
      h("div", { class: "top-row" },
        h("a", { class: "brand", href: "https://t.me/" + CFG.host.tg, target: "_blank", rel: "noopener" }, h("b", null, CFG.host.name), h("span", null, "ведущий")),
        h("span", { id: "saved", class: "saved", "aria-live": "polite" }, "сохранено")),
      rail);
  }

  function welcome() {
    const w = FORM.welcome, started = filled(S.a);
    return h("main", { class: "screen hero" },
      h("p", { class: "kicker" }, w.kicker),
      h("h1", null, greet ? h("span", { class: "greet" }, greet + ",") : null, " ", h("mark", null, w.title)),
      h("p", { class: "lede" }, w.text),
      h("ul", { class: "facts" }, w.facts.map(x => h("li", null, x))),
      h("button", { type: "button", class: "primary big", onclick: () => go(started && S.i >= 0 ? S.i : 0) }, started ? "Продолжить" : "Начать"),
      h("p", { class: "sign" }, CFG.host.short));
  }

  function section(i) {
    const s = FORM.sections[i], last = i === N - 1;
    return h("main", { class: "screen" },
      h("div", { class: "sec-head" },
        h("span", { class: "num" }, String(i + 1).padStart(2, "0")),
        h("div", null, h("h2", null, h("mark", null, s.title)), s.time ? h("span", { class: "time" }, s.time) : null)),
      s.lead ? h("p", { class: "lede" }, s.lead) : null,
      s.fields.map(fieldNode),
      h("div", { class: "nav" },
        h("button", { type: "button", class: "ghost", onclick: () => go(i - 1) }, "Назад"),
        h("button", { type: "button", class: "primary", id: "next", onclick: () => last ? submit() : go(i + 1) }, last ? "Отправить Григорию" : "Далее")));
  }

  function done() {
    const d = FORM.done, ok = S.delivered;
    const tg = "https://t.me/" + CFG.host.tg;
    return h("main", { class: "screen hero" },
      h("p", { class: "kicker" }, ok ? "Ответы доставлены" : "Остался один шаг"),
      h("h1", null, h("mark", null, d.title)),
      h("p", { class: "lede" }, ok ? d.text : "Нажмите кнопку ниже, выберите Telegram и отправьте файл с ответами мне — @" + CFG.host.tg + ". " + d.text),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "primary big", onclick: share }, ok ? "Сохранить копию себе" : "Отправить Григорию"),
        h("button", { type: "button", class: "ghost", onclick: copyText }, "Скопировать текстом"),
        ok ? null : h("a", { class: "ghost", href: tg, target: "_blank", rel: "noopener" }, "Открыть Telegram Григория")),
      h("p", { id: "msg", class: "msg", "aria-live": "polite" }),
      d.next && !CFG.programLocked ? h("a", { class: "next-step", href: d.next.href + location.search }, h("span", null, "Дальше"), h("b", null, d.next.label)) : null,
      d.next && CFG.programLocked ? h("div", { class: "next-step off" }, h("span", null, "Дальше"), h("b", null, "Шаг 2 · Программа"), h("small", null, "Откроется позже — я пришлю ссылку, когда прочитаю ваш бриф.")) : null,
      h("button", { type: "button", class: "link", onclick: () => go(0) }, "Вернуться и поправить ответы"),
      h("p", { class: "sign" }, CFG.host.short));
  }

  const LOCKED = CFG.programLocked && !qs.has("preview");
  function locked() {
    return h("main", { class: "screen hero" },
      h("p", { class: "kicker" }, "Шаг 2 из 2 · программа"),
      h("h1", null, h("mark", null, "Скоро откроется")),
      h("p", { class: "lede" }, "Программу вечера я собираю под вас после того, как прочитаю бриф. Когда всё будет готово, пришлю ссылку — и вы выберете, что вам по душе."),
      h("a", { class: "primary big", href: "index.html" + location.search }, "Вернуться к брифу"),
      h("p", { class: "sign" }, CFG.host.short));
  }

  function render() {
    app.replaceChildren();
    if (LOCKED && FORM.kind === "program") { app.append(locked()); return; }
    if (S.i < 0) { rail = null; app.append(welcome()); return; }
    app.append(header(), S.i >= N ? done() : section(S.i));
    paintRail();
  }

  // ---------- текст и отправка ----------
  function fmt(f) {
    const v = S.a[f.id];
    const other = S.a[f.id + "__other"];
    if (f.type === "pair") { const n = f.id === "names" ? ["Невеста", "Жених"] : pairNames(); return [v && v.b && n[0] + ": " + v.b, v && v.g && n[1] + ": " + v.g].filter(Boolean).join("\n"); }
    if (f.type === "chips") return (v || []).concat(filled(other) ? [other] : []).join("; ");
    if (f.type === "scale") return v ? v + " из 5 (1 — " + f.left + ", 5 — " + f.right + ")" : "";
    if (f.type === "list") return (v || []).filter(filled).map((x, i) => (i + 1) + ". " + x).join("\n");
    if (f.type === "check") return v ? "да" : "";
    if (f.type === "pick") return REACT.map(([r, label]) => {
      const xs = f.options.filter(o => ((v || {})[o.id] || {}).r === r).map(o => o.title + (v[o.id].c ? " (" + v[o.id].c + ")" : ""));
      return xs.length ? label + ": " + xs.join("; ") : "";
    }).concat(f.options.filter(o => v && v[o.id] && !v[o.id].r && v[o.id].c).map(o => "Комментарий к «" + o.title + "»: " + v[o.id].c)).filter(Boolean).join("\n");
    return filled(v) ? String(v) : "";
  }
  function toText() {
    const n = S.a.names || {};
    const out = [FORM.title.toUpperCase() + " · " + [n.b, n.g].filter(filled).join(" и "), "Отправлено: " + new Date().toLocaleString("ru-RU"), ""];
    FORM.sections.forEach(sec => {
      const rows = sec.fields.filter(f => f.type !== "summary").map(f => [f, fmt(f)]).filter(x => x[1]);
      if (!rows.length) return;
      out.push("— " + sec.title.toUpperCase() + " —");
      rows.forEach(([f, t]) => { if (f.label) out.push(f.label); out.push(t, ""); });
    });
    return out.join("\n");
  }
  function payload() {
    const g = collectPicks(), picks = [];
    for (const r in g) g[r].forEach(x => picks.push({ phase: x.sec.title, id: x.o.id, title: x.o.title, dur: x.o.dur || 0, r, c: x.c || "" }));
    // doc — те же ответы по разделам «вопрос → ответ»: из них приёмник верстает Google Документ.
    const doc = FORM.sections.map(sec => ({ section: sec.title, items: sec.fields.filter(f => f.type !== "summary").map(f => ({ q: f.label || "", a: fmt(f) })).filter(x => x.a) })).filter(x => x.items.length);
    return { app: "wedding-constructor", version: CFG.version, kind: FORM.kind, couple, names: S.a.names || null, sentAt: new Date().toISOString(), answers: S.a, picks, doc, text: toText() };
  }
  function fileOf(p) {
    const body = p.text + "\n\n=== данные для конструктора (не редактировать) ===\n" + JSON.stringify(p);
    return new File([body], (FORM.kind === "brief" ? "brif" : "programma") + "-" + couple + ".txt", { type: "text/plain" });
  }
  function say(t) { const m = document.getElementById("msg"); if (m) m.textContent = t; }

  async function submit() {
    for (let si = 0; si < N; si++) for (const f of FORM.sections[si].fields) {
      if (f.required && !filled(S.a[f.id])) {
        if (si !== S.i) go(si);
        const el = document.getElementById("f-" + f.id);
        el.classList.add("need"); el.scrollIntoView({ block: "center" });
        return;
      }
    }
    const btn = document.getElementById("next");
    btn.disabled = true; btn.textContent = "Отправляю…";
    S.delivered = false;
    if (CFG.endpoint) {
      try {
        // Свой сервер — обычный запрос; внешний приёмник (Apps Script) — «простой» запрос, ответ читаем как JSON.
        const same = new URL(CFG.endpoint, location.href).origin === location.origin;
        const r = await fetch(CFG.endpoint, { method: "POST", mode: same ? "same-origin" : "cors", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload()) });
        S.delivered = r.ok && (await r.json()).ok === true;
      } catch (e) { S.delivered = false; }
    }
    S.sent = true;
    go(N);
  }

  async function share() {
    const file = fileOf(payload());
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: FORM.title + " для ведущего" });
        say("Готово. Если отправили файл Григорию — он уже читает.");
        return;
      }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = h("a", { href: URL.createObjectURL(file), download: file.name });
    document.body.append(a); a.click(); a.remove();
    say("Файл «" + file.name + "» сохранён. Отправьте его Григорию в Telegram: @" + CFG.host.tg);
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(toText()); say("Ответы скопированы — вставьте их в сообщение Григорию."); }
    catch (e) { say("Не получилось скопировать. Воспользуйтесь кнопкой отправки файла."); }
  }

  render();
})();
