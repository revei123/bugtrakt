import { COMPANY } from "./tariffs.js";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const INK = [22, 25, 29];
const ORANGE = [232, 100, 27];
const MUTED = [92, 102, 112];
const LINE = [226, 223, 215];
const WHITE = [255, 255, 255];
const SOFT = [197, 198, 204];

function paint(pdf, color) {
  pdf.setFillColor(color[0], color[1], color[2]);
}

function write(pdf, color) {
  pdf.setTextColor(color[0], color[1], color[2]);
}

function rule(pdf, color) {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

function drawLogo(pdf, x, y, size) {
  paint(pdf, ORANGE);
  pdf.rect(x, y, size, size, "F");
  rule(pdf, INK);
  pdf.setLineWidth(Math.max(1.6, size * 0.085));
  pdf.setLineCap("round");
  pdf.setLineJoin("round");
  const scale = size / 34;
  const point = (px, py) => [x + px * scale, y + py * scale];
  const stroke = (a, b, c) => {
    const p1 = point(a[0], a[1]);
    const p2 = point(b[0], b[1]);
    const p3 = point(c[0], c[1]);
    pdf.line(p1[0], p1[1], p2[0], p2[1]);
    pdf.line(p2[0], p2[1], p3[0], p3[1]);
  };
  stroke([8, 9], [18, 17], [8, 25]);
  stroke([16, 9], [26, 17], [16, 25]);
}

function drawHeader(pdf, quote) {
  paint(pdf, INK);
  pdf.rect(0, 0, PAGE_W, 96, "F");
  paint(pdf, ORANGE);
  pdf.rect(0, 96, PAGE_W, 5, "F");
  drawLogo(pdf, M, 28, 40);
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(20);
  write(pdf, WHITE);
  pdf.text("БУГТРАКТ", M + 52, 48);
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(9);
  write(pdf, SOFT);
  pdf.text("Международные перевозки · Брест", M + 52, 66);
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(11);
  write(pdf, ORANGE);
  const number = "№ " + quote.number;
  pdf.text(number, PAGE_W - M - pdf.getTextWidth(number), 46);
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(9);
  write(pdf, SOFT);
  const date = quote.dateLabel.replace(/\u00a0/g, " ");
  pdf.text(date, PAGE_W - M - pdf.getTextWidth(date), 64);
}

function wrap(pdf, text, width) {
  const source = String(text || "").replace(/\u00a0/g, " ");
  const lines = pdf.splitTextToSize(source, width);
  return Array.isArray(lines) ? lines : [String(lines)];
}

function ensure(pdf, quote, cursor, height) {
  if (cursor.y + height <= PAGE_H - 56) return;
  drawFooter(pdf);
  pdf.addPage();
  drawHeader(pdf, quote);
  cursor.y = 122;
}

function sectionLabel(pdf, quote, cursor, label) {
  ensure(pdf, quote, cursor, 22);
  cursor.y += 6;
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(9);
  write(pdf, ORANGE);
  pdf.text(label, M, cursor.y);
  cursor.y += 5;
  rule(pdf, LINE);
  pdf.setLineWidth(0.8);
  pdf.line(M, cursor.y, PAGE_W - M, cursor.y);
  cursor.y += 13;
}

function paragraph(pdf, quote, cursor, text, size, color, gap) {
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(size);
  const lines = wrap(pdf, text, PAGE_W - M * 2);
  ensure(pdf, quote, cursor, lines.length * (size + 3) + gap);
  write(pdf, color);
  pdf.text(lines, M, cursor.y);
  cursor.y += lines.length * (size + 3) + gap;
}

function pairRow(pdf, quote, cursor, leftLabel, leftValue, rightLabel, rightValue) {
  const col = (PAGE_W - M * 2 - 16) / 2;
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(11);
  const leftLines = wrap(pdf, leftValue, col);
  const rightLines = wrap(pdf, rightValue, col);
  const valueLines = Math.max(leftLines.length, rightLines.length);
  const height = 16 + valueLines * 14 + 6;
  ensure(pdf, quote, cursor, height);
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(8);
  write(pdf, MUTED);
  pdf.text(leftLabel, M, cursor.y);
  pdf.text(rightLabel, M + col + 16, cursor.y);
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(11);
  write(pdf, INK);
  pdf.text(leftLines, M, cursor.y + 14);
  pdf.text(rightLines, M + col + 16, cursor.y + 14);
  cursor.y += height;
}

function singleRow(pdf, quote, cursor, label, value) {
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(11);
  const lines = wrap(pdf, value, PAGE_W - M * 2);
  ensure(pdf, quote, cursor, 16 + lines.length * 14);
  pdf.setFontSize(8);
  write(pdf, MUTED);
  pdf.text(label, M, cursor.y);
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(11);
  write(pdf, INK);
  pdf.text(lines, M, cursor.y + 14);
  cursor.y += 16 + lines.length * 14;
}

function moneyLines(pdf, quote, cursor) {
  const amountX = PAGE_W - M;
  for (const line of quote.lines) {
    pdf.setFont("Roboto", "normal");
    pdf.setFontSize(9);
    const detail = wrap(pdf, line.detail, 250);
    const height = Math.max(16, detail.length * 12 + 6);
    ensure(pdf, quote, cursor, height);
    pdf.setFont("Roboto", "bold");
    pdf.setFontSize(10);
    write(pdf, INK);
    pdf.text(line.label, M, cursor.y);
    const amount = line.amountLabel.replace(/\u00a0/g, " ");
    pdf.text(amount, amountX - pdf.getTextWidth(amount), cursor.y);
    pdf.setFont("Roboto", "normal");
    pdf.setFontSize(9);
    write(pdf, MUTED);
    pdf.text(detail, M, cursor.y + 13);
    cursor.y += height + 4;
    rule(pdf, LINE);
    pdf.setLineWidth(0.4);
    pdf.line(M, cursor.y - 2, PAGE_W - M, cursor.y - 2);
  }
}

function priceBox(pdf, quote, cursor) {
  const height = 86;
  ensure(pdf, quote, cursor, height + 8);
  paint(pdf, INK);
  pdf.rect(M, cursor.y, PAGE_W - M * 2, height, "F");
  paint(pdf, ORANGE);
  pdf.rect(M, cursor.y, 5, height, "F");
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(9);
  write(pdf, ORANGE);
  pdf.text("ОРИЕНТИР", M + 18, cursor.y + 20);
  pdf.setFontSize(22);
  write(pdf, WHITE);
  pdf.text(quote.rangeLabel.replace(/\u00a0/g, " "), M + 18, cursor.y + 48);
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(9);
  write(pdf, SOFT);
  pdf.text("Срок доставки", PAGE_W - M - 150, cursor.y + 20);
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(14);
  write(pdf, WHITE);
  pdf.text(quote.daysLabel, PAGE_W - M - 150, cursor.y + 40);
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(9);
  write(pdf, SOFT);
  pdf.text("до " + quote.validUntilLabel.replace(/\u00a0/g, " "), PAGE_W - M - 150, cursor.y + 58);
  cursor.y += height + 14;
}

function drawFooter(pdf) {
  const y = PAGE_H - 48;
  rule(pdf, LINE);
  pdf.setLineWidth(0.6);
  pdf.line(M, y, PAGE_W - M, y);
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(8);
  write(pdf, MUTED);
  pdf.text(COMPANY.legal + ", УНП " + COMPANY.unp + " · " + COMPANY.address, M, y + 14);
  pdf.text(COMPANY.phone + "  ·  " + COMPANY.email + "  ·  " + COMPANY.hours, M, y + 26);
}

function bullet(pdf, quote, cursor, text) {
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(9);
  const lines = wrap(pdf, text, PAGE_W - M * 2 - 16);
  ensure(pdf, quote, cursor, lines.length * 11 + 3);
  paint(pdf, ORANGE);
  pdf.rect(M, cursor.y - 6, 4, 4, "F");
  write(pdf, INK);
  pdf.text(lines, M + 12, cursor.y);
  cursor.y += lines.length * 11 + 3;
}

export function renderQuotePdf(quote, assets) {
  const { jsPDF, regularBase64, boldBase64 } = assets;
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  pdf.addFileToVFS("Roboto-Regular.ttf", regularBase64);
  pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  pdf.addFileToVFS("Roboto-Bold.ttf", boldBase64);
  pdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  pdf.setFont("Roboto", "normal");
  if (typeof pdf.setLanguage === "function") pdf.setLanguage("ru");
  pdf.setProperties({
    title: "Коммерческое предложение " + quote.number,
    subject: "Ориентировочный расчёт перевозки",
    author: COMPANY.legal,
    creator: "Бугтракт, мгновенное КП",
  });
  drawHeader(pdf, quote);
  const cursor = { y: 124 };
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(18);
  write(pdf, INK);
  const title = "Коммерческое предложение";
  pdf.text(title, M, cursor.y);
  const titleWidth = pdf.getTextWidth(title);
  if (quote.demo) {
    pdf.setFont("Roboto", "normal");
    pdf.setFontSize(9);
    write(pdf, ORANGE);
    pdf.text("демо-расчёт", M + titleWidth + 12, cursor.y);
  }
  cursor.y += 22;
  sectionLabel(pdf, quote, cursor, "КЛИЕНТ");
  pairRow(pdf, quote, cursor, "ИМЯ", quote.name, "КОМПАНИЯ", quote.company);
  pairRow(pdf, quote, cursor, "ТЕЛЕФОН", quote.phone || "—", "E-MAIL", quote.email || "—");
  sectionLabel(pdf, quote, cursor, "МАРШРУТ И ГРУЗ");
  singleRow(pdf, quote, cursor, "МАРШРУТ", quote.from + "  —  " + quote.to);
  pairRow(pdf, quote, cursor, "ТИП ПЕРЕВОЗКИ", quote.modePdf, "ТИП ГРУЗА", quote.cargoLabel);
  pairRow(pdf, quote, cursor, "ВЕС", quote.weightLabel, "ОБЪЁМ / ПАЛЛЕТЫ", quote.sizeLabel);
  pairRow(pdf, quote, cursor, "ДАТА ЗАГРУЗКИ", quote.loadingLabel, "ТАМОЖЕННАЯ ОЧИСТКА", quote.customsLabel);
  singleRow(pdf, quote, cursor, "КИЛОМЕТРАЖ", quote.kmLabel + ". " + quote.distanceNote);
  sectionLabel(pdf, quote, cursor, "РАСЧЁТ");
  moneyLines(pdf, quote, cursor);
  cursor.y += 8;
  priceBox(pdf, quote, cursor);
  paragraph(pdf, quote, cursor, quote.disclaimer + (quote.demoDisclaimer ? " " + quote.demoDisclaimer : ""), 10, INK, 8);
  sectionLabel(pdf, quote, cursor, "УСЛОВИЯ");
  for (const line of quote.terms) bullet(pdf, quote, cursor, line);
  drawFooter(pdf);
  return new Uint8Array(pdf.output("arraybuffer"));
}
