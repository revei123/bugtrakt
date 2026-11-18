import { COMPANY, TARIFFS, cargoById, modeById } from "./tariffs.js";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[ńň]/g, "n")
    .replace(/[öó]/g, "o")
    .replace(/[üú]/g, "u")
    .replace(/[äá]/g, "a")
    .replace(/[éè]/g, "e")
    .replace(/ł/g, "l")
    .replace(/[«»"'`]/g, "")
    .replace(/[^a-zа-я0-9-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLine(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function parseNum(value) {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return Number.NaN;
  return Number(text);
}

function containsAlias(text, alias) {
  const needle = normalizeText(alias);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^a-zа-я0-9])" + escaped + "([^a-zа-я0-9]|$)", "i").test(text);
}

function placeById(id, tariffs) {
  return tariffs.places.find((place) => place.id === id) || null;
}

export function resolvePlace(raw, tariffs = TARIFFS) {
  const text = normalizeText(raw);
  if (!text) return null;
  let best = null;
  let bestLen = 0;
  for (const place of tariffs.places) {
    if (place.id === "brest" && /франц/.test(text)) continue;
    for (const alias of place.aliases) {
      const len = normalizeText(alias).length;
      if (len > bestLen && containsAlias(text, alias)) {
        best = { ...place, precision: "city" };
        bestLen = len;
      }
    }
  }
  if (best) return best;
  for (const country of tariffs.countries) {
    if (country.aliases.some((alias) => containsAlias(text, alias))) {
      const hub = placeById(country.hub, tariffs);
      if (!hub) return null;
      return {
        ...hub,
        precision: "country",
        country: country.name,
        countryId: country.id,
        eu: Boolean(country.eu || hub.eu),
      };
    }
  }
  return null;
}

function haversineKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function lookupKm(a, b, tariffs) {
  if (!a || !b) return null;
  if (a.id === b.id) {
    return { km: tariffs.sameCityKm, source: "table", approximate: a.precision !== "city" || b.precision !== "city", route: null };
  }
  const key = [a.id, b.id].sort().join("|");
  const route = tariffs.routes[key];
  if (route) {
    return {
      km: route.km,
      source: "table",
      approximate: a.precision !== "city" || b.precision !== "city",
      route,
    };
  }
  if (a.lat != null && b.lat != null) {
    const km = Math.max(tariffs.minLegKm, Math.round(haversineKm(a, b) * tariffs.roadFactor));
    return { km, source: "coords", approximate: true, route: null };
  }
  return null;
}

export function explainRoute(fromRaw, toRaw, tariffs = TARIFFS) {
  const fromPlace = resolvePlace(fromRaw, tariffs);
  const toPlace = resolvePlace(toRaw, tariffs);
  if (!fromPlace || !toPlace) {
    return {
      fromPlace,
      toPlace,
      km: tariffs.fallbackKm,
      source: "fallback",
      approximate: true,
      reload: false,
      route: null,
      note: "Города нет в таблице направлений — взят запасной километраж. Менеджер уточнит маршрут.",
    };
  }
  const reload = Boolean(fromPlace.eu || toPlace.eu);
  let leg;
  if (fromPlace.id === toPlace.id) {
    leg = lookupKm(fromPlace, toPlace, tariffs);
  } else if (reload && fromPlace.id !== "brest" && toPlace.id !== "brest") {
    const brest = { ...placeById("brest", tariffs), precision: "city" };
    const left = lookupKm(fromPlace, brest, tariffs);
    const right = lookupKm(brest, toPlace, tariffs);
    if (!left || !right) {
      leg = { km: tariffs.fallbackKm, source: "fallback", approximate: true, route: null };
    } else {
      const approximate = left.approximate || right.approximate || left.source !== "table" || right.source !== "table";
      leg = {
        km: left.km + right.km,
        source: approximate ? (left.source === "fallback" || right.source === "fallback" ? "fallback" : "coords") : "table",
        approximate,
        route: null,
      };
    }
  } else {
    leg = lookupKm(fromPlace, toPlace, tariffs) || {
      km: tariffs.fallbackKm,
      source: "fallback",
      approximate: true,
      route: null,
    };
  }
  const notes = {
    table: "Километраж из таблицы основных направлений.",
    coords: "Прямой пары в таблице нет — оценка по координатам городов, без картографического API.",
    fallback: "Запасной километраж: маршрут не распознан.",
  };
  let note = notes[leg.source] || notes.fallback;
  if (reload) note += " Груз из ЕС или в ЕС идёт с перегрузкой в терминале под Брестом: своими машинами по ЕС не ездим.";
  if (fromPlace.precision !== "city" || toPlace.precision !== "city") note += " Город не назван — взята основная точка страны.";
  return { fromPlace, toPlace, reload, ...leg, note };
}

function calendarDay(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function isoDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function formatPlain(amount) {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

export function formatEuro(amount) {
  return formatPlain(amount) + "\u00a0€";
}

export function formatEuroRange(low, high) {
  return formatPlain(low) + "–" + formatPlain(high) + "\u00a0€";
}

export function formatRate(amount) {
  const [whole, frac] = amount.toFixed(2).split(".");
  return frac === "00" ? whole : whole + "," + frac.replace(/0$/, "");
}

export function formatDate(date) {
  return date.getDate() + "\u00a0" + MONTHS[date.getMonth()] + "\u00a0" + date.getFullYear();
}

export function formatInputDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return day + "\u00a0" + MONTHS[month - 1] + "\u00a0" + year;
}

function machinesWord(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "машина";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "машины";
  return "машин";
}

function clamp(min, max, value) {
  return Math.min(max, Math.max(min, value));
}

function round10(amount) {
  return Math.round(amount / 10) * 10;
}

function loadUnits(mode, input) {
  if (mode.id === "ltl") {
    const factor = Math.max(
      input.weightTon / mode.weightTonDivisor,
      input.volumeM3 ? input.volumeM3 / mode.volumeDivisor : 0,
      input.pallets ? input.pallets / mode.palletDivisor : 0,
    );
    return { units: clamp(mode.factorMin, mode.factorMax, factor), trucks: 1 };
  }
  const ratios = [input.weightTon / mode.capacityTon];
  if (input.volumeM3 && mode.capacityM3) ratios.push(input.volumeM3 / mode.capacityM3);
  if (input.pallets && mode.capacityPallets) ratios.push(input.pallets / mode.capacityPallets);
  const ratio = Math.max(...ratios);
  const trucks = Math.max(1, Math.ceil(ratio - 1e-9));
  const full = Math.floor(ratio + 1e-9);
  const frac = Math.max(0, ratio - full);
  const partial = mode.floor + (1 - mode.floor) * Math.min(1, frac || (full === 0 ? ratio : 0));
  const units = full === 0 ? partial : full + (frac > 0 ? mode.floor + (1 - mode.floor) * Math.min(1, frac) : 0);
  return { units, trucks };
}

function transit(routeInfo, mode, flags, tariffs) {
  let lo;
  let hi;
  const route = routeInfo.route;
  if (route && route.ltlDays && mode.id === "ltl") {
    lo = route.ltlDays[0];
    hi = route.ltlDays[1];
  } else if (route && route.days) {
    lo = route.days[0];
    hi = route.days[1];
    if (mode.id === "ltl" && !route.daysIncludeMode) {
      lo += mode.consolidationDays;
      hi += mode.consolidationDays + 1;
    }
  } else {
    const drive = routeInfo.km / mode.kmPerDay;
    lo = Math.max(1, Math.round(drive));
    hi = Math.max(lo + 1, Math.round(drive * 1.2 + 1));
    if (mode.id === "ltl") {
      lo += mode.consolidationDays;
      hi += mode.consolidationDays + 1;
    }
  }
  if (flags.customs) {
    lo += tariffs.customsDays;
    hi += tariffs.customsDays;
  }
  if (flags.reload) {
    lo += tariffs.euReloadDays[0];
    hi += tariffs.euReloadDays[1];
  }
  if (mode.extraDays) {
    lo += mode.extraDays;
    hi += mode.extraDays;
  }
  if (flags.urgent) {
    lo = Math.max(1, lo - 1);
    hi = Math.max(lo, hi - 1);
  }
  if (hi < lo) hi = lo;
  return [lo, hi];
}

function pushLine(lines, label, detail, amount) {
  lines.push({ label, detail, amount, amountLabel: formatEuro(amount) });
}

export function calculateQuote(input, options = {}) {
  const tariffs = options.tariffs || TARIFFS;
  const now = options.now || new Date();
  const seq = options.seq ?? Math.floor(1000 + Math.random() * 9000);
  const mode = modeById(input.mode);
  const cargo = cargoById(input.cargoId);
  if (!mode || !cargo) throw new Error("Неизвестный тип перевозки или груза");
  const routeInfo = explainRoute(input.from, input.to, tariffs);
  const { units, trucks } = loadUnits(mode, input);
  const lines = [];
  let running = Math.max(mode.minEur, mode.perKm * routeInfo.km * units);
  const loadNote = mode.id === "ltl"
    ? "доля партии " + units.toFixed(2).replace(".", ",")
    : trucks > 1
      ? trucks + " " + machinesWord(trucks)
      : "загрузка " + units.toFixed(2).replace(".", ",");
  pushLine(
    lines,
    mode.pdfLabel,
    formatPlain(routeInfo.km) + " км × " + formatRate(mode.perKm) + " €/км, " + loadNote,
    running,
  );
  if (mode.permitEur) {
    const permit = mode.permitEur * trucks;
    pushLine(lines, "Разрешение на негабарит", "демо-надбавка за рейс", permit);
    running += permit;
  }
  if (routeInfo.reload) {
    pushLine(lines, "Перегрузка у границы ЕС", "партнёр довозит груз до терминала под Брестом", tariffs.euReloadEur);
    running += tariffs.euReloadEur;
  }
  const customs = input.customs === "yes";
  if (customs) {
    pushLine(lines, "Таможенное оформление", "T1, EX или содействие декларанту", tariffs.customsEur);
    running += tariffs.customsEur;
  }
  if (cargo.surchargeEur) {
    pushLine(lines, "Надбавка за тип груза", cargo.label, cargo.surchargeEur);
    running += cargo.surchargeEur;
  }
  if (cargo.surchargePercent) {
    const extra = running * cargo.surchargePercent;
    pushLine(lines, "Надбавка ADR", cargo.label + ", " + Math.round(cargo.surchargePercent * 100) + "%", extra);
    running += extra;
  }
  const loadingDay = isoDay(input.loadingDate);
  const urgent = loadingDay != null && loadingDay - calendarDay(now) <= tariffs.urgentWithinDays && loadingDay >= calendarDay(now);
  if (urgent) {
    const extra = running * tariffs.urgentPercent;
    pushLine(lines, "Срочная подача", "загрузка в ближайшие " + tariffs.urgentWithinDays + " дн.", extra);
    running += extra;
  }
  const spread = routeInfo.approximate ? tariffs.spreadApproximate : tariffs.spreadExact;
  let low = round10(running * (1 - spread));
  let high = round10(running * (1 + spread));
  if (high <= low) high = low + 10;
  const [daysLo, daysHi] = transit(routeInfo, mode, { customs, reload: routeInfo.reload, urgent }, tariffs);
  const validUntil = addDays(now, tariffs.validityDays);
  const validUntilLabel = formatDate(validUntil);
  const number = "КП-" + now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + String(seq).padStart(4, "0");
  const sizeBits = [];
  if (input.volumeM3) sizeBits.push(formatRate(input.volumeM3) + " м³");
  if (input.pallets) sizeBits.push(input.pallets + " палл.");
  const customsLabel = customs ? "нужна" : input.customs === "unknown" ? "не указана, в ставку не включена" : "не нужна";
  const contact = [input.phone, input.email].filter(Boolean).join(", ");
  const terms = tariffs.terms.map((line) => line.replace("{validUntil}", validUntilLabel));
  return {
    number,
    demo: tariffs.showDemoMark,
    dateLabel: formatDate(now),
    validUntilLabel,
    from: input.from,
    to: input.to,
    fromName: routeInfo.fromPlace ? routeInfo.fromPlace.name : input.from,
    toName: routeInfo.toPlace ? routeInfo.toPlace.name : input.to,
    modeId: mode.id,
    modeLabel: mode.label,
    modePdf: mode.pdfLabel,
    cargoLabel: cargo.label,
    weightLabel: formatRate(input.weightTon) + " т",
    sizeLabel: sizeBits.join(", ") || "—",
    loadingLabel: formatInputDate(input.loadingDate),
    customs,
    customsLabel,
    name: input.name,
    company: input.company,
    phone: input.phone,
    email: input.email,
    contact,
    km: routeInfo.km,
    kmLabel: formatPlain(routeInfo.km) + " км",
    distanceSource: routeInfo.source,
    distanceNote: routeInfo.note,
    approximate: routeInfo.approximate,
    reload: routeInfo.reload,
    urgent,
    trucks,
    lines,
    total: running,
    totalLabel: formatEuro(running),
    low,
    high,
    rangeLabel: formatEuroRange(low, high),
    daysLo,
    daysHi,
    daysLabel: daysLo === daysHi
      ? daysLo + (daysLo === 1 ? " сутки" : " суток")
      : daysLo + "–" + daysHi + " суток",
    terms,
    disclaimer: tariffs.disclaimer,
    demoDisclaimer: tariffs.showDemoMark ? tariffs.demoDisclaimer : "",
    companyInfo: COMPANY,
  };
}

export function formatManagerCopy(quote) {
  return [
    "Бугтракт · копия заявки менеджеру",
    "Номер: " + quote.number,
    "Дата: " + quote.dateLabel,
    "Клиент: " + quote.name + ", " + quote.company,
    "Контакт: " + quote.contact,
    "Маршрут: " + quote.from + " — " + quote.to,
    "Тип: " + quote.modeLabel,
    "Груз: " + quote.cargoLabel + ", " + quote.weightLabel + ", " + quote.sizeLabel,
    "Загрузка: " + quote.loadingLabel,
    "Таможня: " + quote.customsLabel,
    "Километраж: " + quote.kmLabel + " (" + quote.distanceNote + ")",
    "Вилка: " + quote.rangeLabel,
    "Срок: " + quote.daysLabel,
    "Действует до: " + quote.validUntilLabel,
    quote.demo ? "Демо-расчёт. Подтвердить ставку до погрузки." : "Подтвердить ставку до погрузки.",
  ].join("\n");
}

export function validateRequest(raw, tariffs = TARIFFS, now = new Date()) {
  const errors = {};
  const from = cleanLine(raw.from);
  const to = cleanLine(raw.to);
  const name = cleanLine(raw.name);
  const company = cleanLine(raw.company);
  const phone = cleanLine(raw.phone);
  const email = cleanLine(raw.email);
  const mode = cleanLine(raw.mode);
  const cargoId = cleanLine(raw.cargo);
  const customs = cleanLine(raw.customs);
  const loadingDate = cleanLine(raw.date);
  if (from.length < 2) errors.from = "Укажите город и страну отправления";
  if (to.length < 2) errors.to = "Укажите город и страну назначения";
  if (!modeById(mode)) errors.mode = "Выберите тип перевозки";
  const weight = parseNum(raw.weight);
  if (weight == null) errors.weight = "Укажите вес в тоннах, хотя бы примерно";
  else if (Number.isNaN(weight)) errors.weight = "Вес запишите числом, например 18 или 1,5";
  else if (weight <= 0) errors.weight = "Вес должен быть больше нуля";
  else if (weight > tariffs.limits.weightTonMax) errors.weight = "Для такого веса расчёт лучше разберёт менеджер — укажите до " + tariffs.limits.weightTonMax + " т";
  const volumeEmpty = String(raw.volume || "").trim() === "";
  const palletsEmpty = String(raw.pallets || "").trim() === "";
  const volume = volumeEmpty ? 0 : parseNum(raw.volume);
  const pallets = palletsEmpty ? 0 : parseNum(raw.pallets);
  if (volumeEmpty && palletsEmpty) errors.volume = "Укажите объём или число паллет";
  if (!volumeEmpty && (Number.isNaN(volume) || volume < 0)) errors.volume = "Объём запишите числом, например 12,5";
  else if (!volumeEmpty && volume > tariffs.limits.volumeMax) errors.volume = "Объём больше " + tariffs.limits.volumeMax + " м³ — уточните у менеджера";
  if (!palletsEmpty && (Number.isNaN(pallets) || pallets < 0 || Math.round(pallets) !== pallets)) errors.pallets = "Число паллет — целое, например 8";
  else if (!palletsEmpty && pallets > tariffs.limits.palletsMax) errors.pallets = "Паллет больше " + tariffs.limits.palletsMax + " — уточните у менеджера";
  if (!cargoById(cargoId)) errors.cargo = "Выберите тип груза";
  const day = isoDay(loadingDate);
  const today = calendarDay(now);
  if (!loadingDate) errors.date = "Укажите дату загрузки";
  else if (day == null) errors.date = "Укажите дату в календаре";
  else if (day < today) errors.date = "Дата загрузки уже прошла";
  else if (day > today + tariffs.limits.dateHorizonDays) errors.date = "Для расчёта возьмите дату в ближайшие " + tariffs.limits.dateHorizonDays + " дней";
  if (customs !== "yes" && customs !== "no" && customs !== "unknown") errors.customs = "Укажите, нужна ли таможенная очистка";
  if (name.length < 2) errors.name = "Укажите имя";
  if (company.length < 2) errors.company = "Укажите компанию";
  const digits = phone.replace(/\D/g, "");
  if (!phone && !email) errors.phone = "Укажите телефон или e-mail";
  else if (phone && (digits.length < 7 || digits.length > 15)) errors.phone = "Проверьте телефон: нужно от 7 до 15 цифр";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Проверьте e-mail, похоже в адресе опечатка";
  if (!raw.consent) errors.consent = "Без согласия на обработку данных мы не можем принять заявку";
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      from,
      to,
      mode,
      weightTon: Number(weight) || 0,
      volumeM3: Number(volume) || 0,
      pallets: Number(pallets) || 0,
      cargoId,
      loadingDate,
      customs,
      name,
      company,
      phone,
      email,
    },
  };
}
