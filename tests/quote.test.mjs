import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import { jsPDF } from "jspdf";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { TARIFFS } from "../assets/kp/tariffs.js";
import { calculateQuote, explainRoute, resolvePlace, validateRequest } from "../assets/kp/quote.js";
import { sendManagerCopy } from "../assets/kp/notify.js";
import { formatManagerCopy } from "../assets/kp/quote.js";
import { renderQuotePdf } from "../assets/kp/pdf.js";

const now = new Date(2026, 10, 18);

function input(overrides = {}) {
  return {
    from: "Брест, Беларусь",
    to: "Москва, Россия",
    mode: "ftl",
    weightTon: 18,
    volumeM3: 82,
    pallets: 33,
    cargoId: "general",
    loadingDate: "2026-11-25",
    customs: "no",
    name: "Анна Ковалёва",
    company: "ООО «Полесье»",
    phone: "+375291112233",
    email: "anna@example.com",
    ...overrides,
  };
}

function quote(overrides = {}, options = {}) {
  return calculateQuote(input(overrides), { now, seq: 1001, ...options });
}

test("таблица: Брест — Москва, фура, 2–3 суток", () => {
  const result = quote();
  assert.equal(result.distanceSource, "table");
  assert.equal(result.approximate, false);
  assert.equal(result.km, 1070);
  assert.equal(result.daysLo, 2);
  assert.equal(result.daysHi, 3);
  assert.equal(result.reload, false);
  assert.equal(result.number, "КП-2026-1118-1001");
  assert.ok(result.low < result.total && result.total < result.high);
  assert.match(result.rangeLabel, /€/);
});

test("параметры меняют вилку: тип, вес, объём, паллеты, груз, дата, таможня, маршрут", () => {
  const base = quote();
  const ltl = quote({ mode: "ltl", weightTon: 1.2, volumeM3: 4, pallets: 2 });
  const heavier = quote({ mode: "ltl", weightTon: 8, volumeM3: 4, pallets: 2 });
  const bulkier = quote({ mode: "ltl", weightTon: 1.2, volumeM3: 30, pallets: 2 });
  const morePallets = quote({ mode: "ltl", weightTon: 1.2, volumeM3: 4, pallets: 10 });
  const reefer = quote({ mode: "reefer" });
  const oversized = quote({ mode: "oversized" });
  const adr = quote({ cargoId: "adr" });
  const customs = quote({ customs: "yes" });
  const urgent = quote({ loadingDate: "2026-11-19" });
  const almaty = quote({ to: "Алматы, Казахстан" });
  assert.ok(ltl.total < base.total);
  assert.ok(heavier.total > ltl.total);
  assert.ok(bulkier.total > ltl.total);
  assert.ok(morePallets.total > ltl.total);
  assert.ok(reefer.total > base.total);
  assert.ok(oversized.total > reefer.total);
  assert.ok(adr.total > base.total);
  assert.ok(customs.total > base.total);
  assert.equal(customs.daysLo, base.daysLo + 1);
  assert.ok(urgent.total > base.total);
  assert.equal(urgent.urgent, true);
  assert.ok(almaty.total > base.total);
  assert.equal(almaty.daysLo, 9);
  assert.equal(almaty.daysHi, 12);
});

test("короткое плечо упирается в минималку FTL", () => {
  const result = quote({ to: "Белосток, Польша", weightTon: 20, volumeM3: 10, pallets: 2 });
  assert.equal(result.km, 90);
  assert.equal(result.reload, true);
  assert.ok(result.lines[0].amount >= TARIFFS.modes[0].minEur);
});

test("груз из ЕС идёт через Брест и включает перегрузку", () => {
  const route = explainRoute("Варшава", "Москва");
  assert.equal(route.source, "table");
  assert.equal(route.km, 210 + 1070);
  assert.equal(route.reload, true);
  const result = quote({ from: "Варшава, Польша", to: "Москва" });
  assert.ok(result.lines.some((line) => line.label.includes("Перегрузка")));
});

test("нет прямой пары — запасной расчёт по координатам, неизвестный город — запасной километраж", () => {
  const viaCoords = explainRoute("Гомель", "Казань");
  assert.equal(viaCoords.source, "coords");
  assert.equal(viaCoords.approximate, true);
  assert.ok(viaCoords.km > 1000 && viaCoords.km < 2500);
  const unknown = explainRoute("Брест", "Лисабон, Португалия");
  assert.equal(unknown.source, "fallback");
  assert.equal(unknown.km, TARIFFS.fallbackKm);
  const wide = quote({ to: "Лисабон" });
  const exact = quote();
  const wideSpread = (wide.high - wide.low) / wide.total;
  const exactSpread = (exact.high - exact.low) / exact.total;
  assert.ok(wideSpread > exactSpread);
});

test("страна без города берётся по столице и помечается как оценка", () => {
  const place = resolvePlace("Германия");
  assert.equal(place.id, "berlin");
  assert.equal(place.precision, "country");
  const route = explainRoute("Брест", "Германия");
  assert.equal(route.km, 780);
  assert.equal(route.approximate, true);
  assert.equal(route.reload, true);
});

test("Санкт-Петербург не путается с коротким алиасом, французский Брест не белорусский", () => {
  assert.equal(resolvePlace("Санкт-Петербург").id, "spb");
  const french = resolvePlace("Брест, Франция");
  assert.equal(french.id, "paris");
  assert.equal(french.precision, "country");
  assert.notEqual(resolvePlace("Брест").id, "paris");
});

test("проверка полей не пускает пустую заявку и кривые числа", () => {
  const empty = validateRequest({ consent: false }, TARIFFS, now);
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.from && empty.errors.to && empty.errors.weight && empty.errors.consent);
  const bad = validateRequest({
    from: "Брест",
    to: "Москва",
    mode: "ftl",
    weight: "много",
    volume: "",
    pallets: "1,5",
    cargo: "general",
    date: "2020-01-01",
    customs: "yes",
    name: "Ан",
    company: "ООО Ромашка",
    phone: "123",
    email: "not-an-email",
    consent: true,
  }, TARIFFS, now);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.weight && bad.errors.pallets && bad.errors.date && bad.errors.phone && bad.errors.email);
  const ok = validateRequest({
    from: "Брест, Беларусь",
    to: "Москва",
    mode: "reefer",
    weight: "1,5",
    volume: "",
    pallets: "2",
    cargo: "food",
    date: "2026-11-20",
    customs: "unknown",
    name: "Иван",
    company: "ИП Петров",
    phone: "",
    email: "ivan@example.com",
    consent: true,
  }, TARIFFS, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.weightTon, 1.5);
  assert.equal(ok.value.customs, "unknown");
});

test("копия менеджеру остаётся на экране и не вызывает отправку", async () => {
  const result = quote();
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return { ok: true, status: 200 };
  };
  try {
    const delivery = await sendManagerCopy(result, formatManagerCopy);
    assert.equal(delivery.demo, true);
    assert.equal(delivery.delivered, false);
    assert.equal(delivery.channel, "screen");
    assert.match(delivery.text, /Анна Ковалёва/);
    assert.match(delivery.text, /Москва/);
    assert.match(delivery.text, /КП-2026-1118-1001/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("PDF содержит кириллицу, номер, маршрут и пометку об ориентире", async () => {
  const result = quote({ name: "Ёлка Йод", company: "ООО «Бугтракт-тест»" });
  const regular = readFileSync(new URL("../assets/fonts/kp/Roboto-Regular.ttf", import.meta.url));
  const bold = readFileSync(new URL("../assets/fonts/kp/Roboto-Bold.ttf", import.meta.url));
  const bytes = renderQuotePdf(result, {
    jsPDF,
    regularBase64: regular.toString("base64"),
    boldBase64: bold.toString("base64"),
  });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  writeFileSync("/tmp/bugtrakt-kp-sample.pdf", Buffer.from(bytes));
  const pdf = await getDocument({ data: bytes.slice(), disableWorker: true, isEvalSupported: false }).promise;
  assert.ok(pdf.numPages >= 1);
  let text = "";
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join("\n") + "\n";
  }
  assert.match(text, /Бугтракт/);
  assert.match(text, /Коммерческое предложение/);
  assert.match(text, /Ёлка Йод/);
  assert.match(text, /Бугтракт-тест/);
  assert.match(text, /Брест, Беларусь/);
  assert.match(text, /Москва, Россия/);
  assert.match(text, /КП-2026-1118-1001/);
  assert.match(text, /ориентировочн/i);
  assert.match(text, /менеджер/i);
  assert.match(text, /демо-расчёт/);
  assert.doesNotMatch(text, /\uFFFD/);
});
