/**
 * ДЕМО-ТАРИФЫ ООО «Бугтракт».
 *
 * Компания вымышленная. Все ставки, минималки, надбавки и километраж ниже —
 * демонстрационные числа для портфолио, не прайс реальной перевозки.
 * Чтобы поставить тариф живого клиента, правьте только этот файл:
 * ставка за км и минималка у каждого типа, надбавки, сроки, таблица направлений.
 * Платных API и ключей нет.
 *
 * showDemoMark: поставьте false, когда вместо демо-ставок будут тарифы клиента.
 * Пометка «цена ориентировочная, подтверждает менеджер» при этом остаётся.
 */

export const COMPANY = {
  brand: "Бугтракт",
  legal: "ООО «Бугтракт»",
  unp: "291284736",
  city: "Брест",
  address: "224016, г. Брест, ул. Катин Бор, 106/2, офис 14",
  phone: "+375 162 51-73-08",
  phoneHref: "+375162517308",
  mobile: "+375 29 721-46-90",
  email: "cargo@bugtrakt.by",
  emailInfo: "info@bugtrakt.by",
  director: "Сергей Мартынюк",
  logistician: "Ольга Ковальчук",
  hours: "пн–пт 8:00–19:00, сб 9:00–14:00",
};

const FROM_BREST = [
  ["minsk", 350, [1, 2]],
  ["gomel", 530, [1, 2]],
  ["grodno", 230, [1, 2]],
  ["vitebsk", 650, [2, 3]],
  ["mogilev", 620, [2, 3]],
  ["pinsk", 180, [1, 1]],
  ["moscow", 1070, [2, 3]],
  ["spb", 1230, [3, 4]],
  ["smolensk", 620, [1, 2]],
  ["kazan", 1860, [4, 5]],
  ["ekb", 2550, [5, 6]],
  ["novosibirsk", 4100, [7, 9]],
  ["krasnodar", 1750, [4, 5]],
  ["nizhny", 1550, [3, 4]],
  ["warsaw", 210, [1, 2]],
  ["bialystok", 90, [1, 1]],
  ["poznan", 620, [2, 3]],
  ["gdansk", 680, [2, 3]],
  ["krakow", 670, [2, 3]],
  ["vilnius", 320, [1, 2]],
  ["kaunas", 260, [1, 2]],
  ["klaipeda", 500, [1, 2]],
  ["riga", 540, [2, 3]],
  ["berlin", 780, [2, 3]],
  ["hamburg", 1150, [2, 3]],
  ["munich", 1450, [3, 4]],
  ["frankfurt", 1280, [3, 4]],
  ["cologne", 1400, [3, 4]],
  ["prague", 950, [2, 3]],
  ["rotterdam", 1550, [3, 4]],
  ["paris", 1700, [3, 5]],
  ["almaty", 4550, [9, 12]],
  ["astana", 3650, [8, 11]],
  ["tashkent", 4300, [10, 14]],
  ["bishkek", 4500, [11, 14]],
  ["dushanbe", 4700, [12, 15]],
  ["istanbul", 2150, [8, 12], { ltlDays: [15, 17] }],
  ["urumqi", 6200, [18, 25], { daysIncludeMode: true }],
  ["shanghai", 9800, [22, 30], { daysIncludeMode: true }],
  ["guangzhou", 10200, [22, 32], { daysIncludeMode: true }],
];

const EXTRA_ROUTES = [
  ["minsk", "moscow", 720, [2, 3]],
  ["moscow", "spb", 710, [1, 2]],
  ["warsaw", "berlin", 580, [1, 2]],
  ["vilnius", "riga", 300, [1, 1]],
  ["almaty", "astana", 980, [2, 3]],
];

function buildRoutes() {
  const routes = {};
  for (const [id, km, days, flags] of FROM_BREST) {
    routes[["brest", id].sort().join("|")] = { km, days, ...(flags || {}) };
  }
  for (const [a, b, km, days] of EXTRA_ROUTES) {
    routes[[a, b].sort().join("|")] = { km, days };
  }
  return routes;
}

export const TARIFFS = {
  showDemoMark: true,
  currency: "EUR",

  // Вилка вокруг расчёта. У известного маршрута уже, у запасного километража шире.
  spreadExact: 0.08,
  spreadApproximate: 0.18,

  validityDays: 7,
  urgentWithinDays: 2,
  urgentPercent: 0.12,
  customsEur: 180,
  customsDays: 1,
  // Как на странице направлений: перегрузка из ЕС +1–2 дня и от 180 €.
  euReloadEur: 180,
  euReloadDays: [1, 2],

  sameCityKm: 40,
  minLegKm: 40,
  // Если города нет ни в таблице, ни в координатах.
  fallbackKm: 1800,
  // Запасной вариант: прямая между координатами × коэффициент (дорога длиннее прямой).
  roadFactor: 1.25,

  limits: {
    weightTonMax: 80,
    volumeMax: 200,
    palletsMax: 100,
    dateHorizonDays: 180,
  },

  modes: [
    {
      id: "ftl",
      short: "FTL",
      label: "FTL — полная машина",
      pdfLabel: "Целая машина (FTL)",
      hint: "Тент до 20 т, 92 м³, 33 европаллеты. Машина целиком, без чужих партий.",
      perKm: 1.05,
      minEur: 420,
      kmPerDay: 520,
      floor: 0.84,
      capacityTon: 20,
      capacityM3: 92,
      capacityPallets: 33,
    },
    {
      id: "ltl",
      short: "LTL",
      label: "LTL — сборный груз",
      pdfLabel: "Сборный груз (LTL)",
      hint: "От 300 кг или 1 м³. Склад в Бресте, отправки в Москву по вторникам и пятницам.",
      perKm: 0.55,
      minEur: 140,
      kmPerDay: 400,
      consolidationDays: 2,
      // Доля партии относительно условной отправки. Чем больше груз, тем ближе к цене машины, но дешевле FTL.
      weightTonDivisor: 12,
      volumeDivisor: 40,
      palletDivisor: 12,
      factorMin: 0.3,
      factorMax: 1.6,
    },
    {
      id: "reefer",
      short: "Рефрижератор",
      label: "Рефрижератор",
      pdfLabel: "Рефрижератор",
      hint: "От −20 до +20 °C, термописец и распечатка температуры при выгрузке.",
      perKm: 1.42,
      minEur: 560,
      kmPerDay: 480,
      floor: 0.88,
      capacityTon: 20,
      capacityM3: 86,
      capacityPallets: 33,
    },
    {
      id: "oversized",
      short: "Негабарит",
      label: "Негабарит",
      pdfLabel: "Негабарит",
      hint: "Груз вне стандартного тента. В ставку входит демо-надбавка за разрешение.",
      perKm: 1.8,
      minEur: 780,
      permitEur: 260,
      kmPerDay: 380,
      extraDays: 1,
      floor: 0.9,
      capacityTon: 20,
      capacityM3: 92,
      capacityPallets: 20,
    },
  ],

  cargoTypes: [
    { id: "general", label: "Генеральный груз", surchargeEur: 0 },
    { id: "food", label: "Продукты питания", surchargeEur: 40 },
    { id: "equipment", label: "Оборудование", surchargeEur: 80 },
    { id: "construction", label: "Стройматериалы", surchargeEur: 30 },
    { id: "adr", label: "Химия и ADR (классы 3, 8, 9)", surchargePercent: 0.18 },
    { id: "personal", label: "Личные вещи", surchargeEur: 0 },
  ],

  terms: [
    "Предложение действует до {validUntil}. После этой даты ставку нужно пересчитать.",
    "В вилку входят провоз и надбавки из расчёта. Простой сверх 24 часов, досмотр по решению таможни и перегрузка по требованию контролирующих органов оплачиваются отдельно и подтверждаются документом.",
    "Оплата безналичная, в BYN, RUB, USD, EUR или CNY. Обычно в течение 5 банковских дней после выгрузки по сканам документов.",
    "Груз застрахован по CMR до 300 000 € по одному случаю. Страхование на полную стоимость оформляем по запросу.",
    "Итог подтверждает менеджер до погрузки. Это не оферта.",
  ],

  disclaimer: "Цена ориентировочная и подтверждается менеджером до погрузки.",
  demoDisclaimer: "Демо-расчёт: тарифы вымышленные.",

  places: [
    { id: "brest", name: "Брест", country: "Беларусь", countryId: "BY", lat: 52.1, lon: 23.73, aliases: ["брест", "brest"] },
    { id: "minsk", name: "Минск", country: "Беларусь", countryId: "BY", lat: 53.9, lon: 27.56, aliases: ["минск", "minsk"] },
    { id: "gomel", name: "Гомель", country: "Беларусь", countryId: "BY", lat: 52.43, lon: 30.98, aliases: ["гомель", "gomel"] },
    { id: "grodno", name: "Гродно", country: "Беларусь", countryId: "BY", lat: 53.67, lon: 23.83, aliases: ["гродно", "hrodna"] },
    { id: "vitebsk", name: "Витебск", country: "Беларусь", countryId: "BY", lat: 55.19, lon: 30.2, aliases: ["витебск", "vitebsk"] },
    { id: "mogilev", name: "Могилёв", country: "Беларусь", countryId: "BY", lat: 53.92, lon: 30.34, aliases: ["могилев", "могилёв"] },
    { id: "pinsk", name: "Пинск", country: "Беларусь", countryId: "BY", lat: 52.12, lon: 26.1, aliases: ["пинск"] },

    { id: "moscow", name: "Москва", country: "Россия", countryId: "RU", lat: 55.76, lon: 37.62, aliases: ["москва", "мск", "moscow"] },
    { id: "spb", name: "Санкт-Петербург", country: "Россия", countryId: "RU", lat: 59.93, lon: 30.36, aliases: ["санкт-петербург", "петербург", "спб", "питер", "saint petersburg", "st petersburg"] },
    { id: "smolensk", name: "Смоленск", country: "Россия", countryId: "RU", lat: 54.78, lon: 32.05, aliases: ["смоленск"] },
    { id: "kazan", name: "Казань", country: "Россия", countryId: "RU", lat: 55.79, lon: 49.12, aliases: ["казань", "kazan"] },
    { id: "ekb", name: "Екатеринбург", country: "Россия", countryId: "RU", lat: 56.84, lon: 60.61, aliases: ["екатеринбург", "екб"] },
    { id: "novosibirsk", name: "Новосибирск", country: "Россия", countryId: "RU", lat: 55.01, lon: 82.94, aliases: ["новосибирск", "нск"] },
    { id: "krasnodar", name: "Краснодар", country: "Россия", countryId: "RU", lat: 45.04, lon: 38.98, aliases: ["краснодар"] },
    { id: "nizhny", name: "Нижний Новгород", country: "Россия", countryId: "RU", lat: 56.33, lon: 44.0, aliases: ["нижний новгород"] },

    { id: "warsaw", name: "Варшава", country: "Польша", countryId: "PL", eu: true, lat: 52.23, lon: 21.01, aliases: ["варшава", "warsaw", "warszawa"] },
    { id: "bialystok", name: "Белосток", country: "Польша", countryId: "PL", eu: true, lat: 53.13, lon: 23.16, aliases: ["белосток", "bialystok"] },
    { id: "poznan", name: "Познань", country: "Польша", countryId: "PL", eu: true, lat: 52.41, lon: 16.93, aliases: ["познань", "poznań", "poznan"] },
    { id: "gdansk", name: "Гданьск", country: "Польша", countryId: "PL", eu: true, lat: 54.35, lon: 18.65, aliases: ["гданьск", "gdansk"] },
    { id: "krakow", name: "Краков", country: "Польша", countryId: "PL", eu: true, lat: 50.06, lon: 19.94, aliases: ["краков", "krakow", "kraków"] },

    { id: "vilnius", name: "Вильнюс", country: "Литва", countryId: "LT", eu: true, lat: 54.69, lon: 25.28, aliases: ["вильнюс", "vilnius"] },
    { id: "kaunas", name: "Каунас", country: "Литва", countryId: "LT", eu: true, lat: 54.9, lon: 23.9, aliases: ["каунас", "kaunas"] },
    { id: "klaipeda", name: "Клайпеда", country: "Литва", countryId: "LT", eu: true, lat: 55.71, lon: 21.14, aliases: ["клайпеда", "klaipeda"] },
    { id: "riga", name: "Рига", country: "Латвия", countryId: "LV", eu: true, lat: 56.95, lon: 24.11, aliases: ["рига", "riga"] },

    { id: "berlin", name: "Берлин", country: "Германия", countryId: "DE", eu: true, lat: 52.52, lon: 13.41, aliases: ["берлин", "berlin"] },
    { id: "hamburg", name: "Гамбург", country: "Германия", countryId: "DE", eu: true, lat: 53.55, lon: 10.0, aliases: ["гамбург", "hamburg"] },
    { id: "munich", name: "Мюнхен", country: "Германия", countryId: "DE", eu: true, lat: 48.14, lon: 11.58, aliases: ["мюнхен", "munich", "münchen"] },
    { id: "frankfurt", name: "Франкфурт", country: "Германия", countryId: "DE", eu: true, lat: 50.11, lon: 8.68, aliases: ["франкфурт", "frankfurt"] },
    { id: "cologne", name: "Кёльн", country: "Германия", countryId: "DE", eu: true, lat: 50.94, lon: 6.96, aliases: ["кельн", "кёльн", "cologne", "köln"] },
    { id: "prague", name: "Прага", country: "Чехия", countryId: "CZ", eu: true, lat: 50.08, lon: 14.44, aliases: ["прага", "prague", "praha"] },
    { id: "rotterdam", name: "Роттердам", country: "Нидерланды", countryId: "NL", eu: true, lat: 51.92, lon: 4.48, aliases: ["роттердам", "rotterdam"] },
    { id: "paris", name: "Париж", country: "Франция", countryId: "FR", eu: true, lat: 48.86, lon: 2.35, aliases: ["париж", "paris"] },

    { id: "almaty", name: "Алматы", country: "Казахстан", countryId: "KZ", lat: 43.24, lon: 76.95, aliases: ["алматы", "алма-ата", "almaty"] },
    { id: "astana", name: "Астана", country: "Казахстан", countryId: "KZ", lat: 51.13, lon: 71.43, aliases: ["астана", "нур-султан", "astana"] },
    { id: "tashkent", name: "Ташкент", country: "Узбекистан", countryId: "UZ", lat: 41.3, lon: 69.28, aliases: ["ташкент", "tashkent"] },
    { id: "bishkek", name: "Бишкек", country: "Кыргызстан", countryId: "KG", lat: 42.87, lon: 74.59, aliases: ["бишкек", "bishkek"] },
    { id: "dushanbe", name: "Душанбе", country: "Таджикистан", countryId: "TJ", lat: 38.56, lon: 68.78, aliases: ["душанбе", "dushanbe"] },
    { id: "istanbul", name: "Стамбул", country: "Турция", countryId: "TR", lat: 41.01, lon: 28.98, aliases: ["стамбул", "istanbul"] },
    { id: "urumqi", name: "Урумчи", country: "Китай", countryId: "CN", lat: 43.83, lon: 87.62, aliases: ["урумчи", "urumqi"] },
    { id: "shanghai", name: "Шанхай", country: "Китай", countryId: "CN", lat: 31.23, lon: 121.47, aliases: ["шанхай", "shanghai"] },
    { id: "guangzhou", name: "Гуанчжоу", country: "Китай", countryId: "CN", lat: 23.13, lon: 113.26, aliases: ["гуанчжоу", "guangzhou"] },
  ],

  countries: [
    { id: "BY", name: "Беларусь", hub: "minsk", aliases: ["беларусь", "белоруссия", "belarus"] },
    { id: "RU", name: "Россия", hub: "moscow", aliases: ["россия", "рф", "russia"] },
    { id: "PL", name: "Польша", hub: "warsaw", eu: true, aliases: ["польша", "poland", "polska"] },
    { id: "LT", name: "Литва", hub: "vilnius", eu: true, aliases: ["литва", "lithuania"] },
    { id: "LV", name: "Латвия", hub: "riga", eu: true, aliases: ["латвия", "latvia"] },
    { id: "DE", name: "Германия", hub: "berlin", eu: true, aliases: ["германия", "germany", "deutschland"] },
    { id: "CZ", name: "Чехия", hub: "prague", eu: true, aliases: ["чехия", "czech"] },
    { id: "NL", name: "Нидерланды", hub: "rotterdam", eu: true, aliases: ["нидерланды", "голландия", "netherlands"] },
    { id: "FR", name: "Франция", hub: "paris", eu: true, aliases: ["франция", "france"] },
    { id: "KZ", name: "Казахстан", hub: "astana", aliases: ["казахстан", "kazakhstan"] },
    { id: "UZ", name: "Узбекистан", hub: "tashkent", aliases: ["узбекистан", "uzbekistan"] },
    { id: "KG", name: "Кыргызстан", hub: "bishkek", aliases: ["кыргызстан", "киргизия"] },
    { id: "TJ", name: "Таджикистан", hub: "dushanbe", aliases: ["таджикистан"] },
    { id: "TR", name: "Турция", hub: "istanbul", aliases: ["турция", "turkey"] },
    { id: "CN", name: "Китай", hub: "urumqi", aliases: ["китай", "кнр", "china"] },
  ],

  routes: null,
};

TARIFFS.routes = buildRoutes();

export function modeById(id) {
  return TARIFFS.modes.find((mode) => mode.id === id) || null;
}

export function cargoById(id) {
  return TARIFFS.cargoTypes.find((cargo) => cargo.id === id) || null;
}
