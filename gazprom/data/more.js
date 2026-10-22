// Три готовых набора (как в рабочей странице site/gazprom). Набор отмечает «Хотим» у своих игр и «Не наше» у остальных.
// Описание набора и минуты согласованы с рабочей страницей: Лёгкий 15+12+10+15 = 52 (около 50), Основной 15+12+10+12+15+15+8 = 87 (около 90).
window.SETS = [
 { id: "light", name: "Лёгкий", desc: "4 игры, около 50 минут", ids: ["quiz", "guesspics", "tablelie", "musiccombat"] },
 { id: "main", name: "Основной", desc: "7 игр, около 90 минут", ids: ["quiz", "guesspics", "tablelie", "logic", "musiccombat", "tablebattle", "memes"] },
 { id: "full", name: "Расширенный", desc: "все игры списка", ids: "all" }
];
