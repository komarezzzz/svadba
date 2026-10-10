// Настройки конструктора. Меняется здесь — действует на обеих страницах.
window.WC_CONFIG = {
  version: "0.1",
  host: {
    name: "Григорий Комаревцев",
    short: "Григорий",
    tg: "komarez",
    phone: "+7 923 636-89-97"
  },
  // Шаг 2 (программа) закрыт для пар, пока каталог не утверждён. Посмотреть самому: program.html?preview=1
  programLocked: true,
  // Адрес приёмника ответов. Пусто — ответы уходят файлом через «Поделиться» (Telegram, WhatsApp, почта).
  // "/api/submit" — локальный приёмник server/receiver.mjs (ответы ложатся в папку inbox); на опубликованном сайте приёмника нет.
  endpoint: ["localhost", "127.0.0.1"].includes(location.hostname) ? "/api/submit" : ""
};
