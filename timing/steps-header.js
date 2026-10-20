/* Общая шапка шагов сайта пары: «Ваш вечер · Виктория и Никита» + переход между шагами 1 · 2 · 3 (стиль «Жидкое стекло» из шага 2).
   Подключение: <script src="steps-header.js" defer></script>. Ссылки сохраняют ?c=… текущей пары. Текущий шаг — 3. */
(function () {
  var q = location.search || "";
  var CFG = window.STEPS_HEADER || {};
  var names = CFG.names || (window.TIMING && window.TIMING.couple) || "Виктория и Никита";
  var steps = [
    { n: 1, t: "Бриф", href: "../index.html" + q },
    { n: 2, t: "Программа", href: "../program.html" + q },
    { n: 3, t: "Тайминг", href: "", cur: true }
  ];
  var css = '@font-face{font-family:"Finlandica";src:url("fonts/finlandica.woff2") format("woff2");font-weight:400 700;font-display:swap}' +
    '.sh{position:fixed;z-index:30;top:max(10px,env(safe-area-inset-top));left:12px;right:12px;max-width:760px;margin:0 auto;padding:7px 8px 7px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:30px;' +
    'font-family:"Finlandica",system-ui,sans-serif;color:#2a1c10;background:linear-gradient(145deg,rgba(255,255,255,.62),rgba(255,255,255,.3));' +
    '-webkit-backdrop-filter:blur(10px) saturate(150%);backdrop-filter:blur(10px) saturate(150%);' +
    'box-shadow:inset 1.5px 1.5px 1px -.5px rgba(255,255,255,.95),inset -1.5px -1.5px 1px -.5px rgba(255,255,255,.6),0 14px 30px -14px rgba(60,30,10,.45),0 2px 6px rgba(60,30,10,.16)}' +
    '.sh .who{display:flex;flex-direction:column;justify-content:center;min-height:44px;min-width:0;text-decoration:none;color:inherit;line-height:1.05}' +
    '.sh .who b{display:block;font-weight:800;font-size:17px;letter-spacing:-.02em}' +
    '.sh .who span{display:block;margin-top:2px;font-weight:600;font-size:12.5px;color:#5c4a38;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.sh nav{display:flex;gap:4px;flex:none}' +
    '.sh nav a{display:inline-flex;align-items:center;gap:6px;flex:none;min-height:44px;min-width:44px;justify-content:center;padding:0 12px;border-radius:99px;text-decoration:none;color:#2a1c10;font-weight:600;font-size:14px;background:rgba(255,255,255,.35);box-shadow:inset 0 0 0 1px rgba(255,255,255,.7)}' +
    '.sh nav a i{font-style:normal;font-weight:800;font:800 12px/1 ui-monospace,Menlo,monospace;opacity:.75}' +
    '.sh nav a[aria-current]{background:#33322f;color:#f6efe0;box-shadow:none}' +
    '.sh nav a:focus-visible,.sh .who:focus-visible{outline:2px solid #33322f;outline-offset:2px}' +
    '@media(max-width:520px){.sh{padding-left:12px}.sh nav a{padding:0 10px}.sh nav a:not([aria-current]) b{display:none}.sh .who span{max-width:34vw}}' +
    '@media(prefers-reduced-transparency:reduce){.sh{background:#fbf6ea;-webkit-backdrop-filter:none;backdrop-filter:none}}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var h = document.createElement("header"); h.className = "sh"; h.setAttribute("role", "banner");
  var who = document.createElement("a"); who.className = "who"; who.href = "../index.html" + q; who.innerHTML = "<b>Ваш вечер</b><span></span>"; who.querySelector("span").textContent = names;
  var nav = document.createElement("nav"); nav.setAttribute("aria-label", "Шаги подготовки");
  steps.forEach(function (s) {
    var a = document.createElement("a"); if (s.cur) a.setAttribute("aria-current", "page"); else a.href = s.href;
    a.innerHTML = "<i>" + s.n + "</i><b>" + s.t + "</b>"; a.querySelector("b").style.fontWeight = "inherit"; nav.appendChild(a);
  });
  h.appendChild(who); h.appendChild(nav); document.body.insertBefore(h, document.body.firstChild);
})();
