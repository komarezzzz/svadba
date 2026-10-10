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
  // Адрес приёмника ответов. На сайте — Google Apps Script Григория (server/apps-script/Code.gs):
  // создаёт Google Документ в папке «Свадебный конструктор — брифы» и шлёт письмо. Адрес не секретный.
  // На localhost — локальный приёмник server/receiver.mjs (папка inbox). Пусто — только файл через «Поделиться».
  endpoint: ["localhost", "127.0.0.1"].includes(location.hostname) ? "/api/submit"
    : "https://script.google.com/macros/s/AKfycbwNkv6WGTWhvZ4d1KlBdtSTpKG4gTEg9cc9Y7oAeLlBt57euDRGjrtFSZsq6Its90qmqA/exec"
};
