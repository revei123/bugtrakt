import { TARIFFS } from "./tariffs.js";
import { calculateQuote, formatManagerCopy, validateRequest } from "./quote.js";
import { sendManagerCopy } from "./notify.js";
import { renderQuotePdf } from "./pdf.js";

let pdfAssets = null;
const form = document.getElementById("kp-form");
if (form) {
  const result = document.getElementById("kp-result");
  let lastQuote = null;

  fillModes();
  fillCargo();
  fillPlaces();
  setDateBounds();
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 800));
  idle(() => { loadPdfAssets().catch(() => {}); });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const checked = validateRequest(readForm(), TARIFFS, new Date());
    clearErrors();
    if (!checked.ok) {
      showErrors(checked.errors);
      const first = form.querySelector("[aria-invalid='true']");
      const focusTarget = first && (first.matches("input, select, textarea") ? first : first.querySelector("input, select, textarea") || first);
      if (focusTarget) focusTarget.focus();
      return;
    }
    const quote = calculateQuote(checked.value, { now: new Date(), seq: nextSeq() });
    const copy = await sendManagerCopy(quote, formatManagerCopy);
    lastQuote = quote;
    renderResult(quote, copy);
  });

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (target && target.getAttribute("aria-invalid") === "true") {
      target.removeAttribute("aria-invalid");
      const box = target.closest(".field");
      const err = box && box.querySelector(".err");
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
    }
  });

  form.addEventListener("change", (event) => {
    if (event.target && event.target.name === "mode") {
      const mode = TARIFFS.modes.find((item) => item.id === event.target.value);
      const hint = document.getElementById("kp-mode-hint");
      if (hint && mode) hint.textContent = mode.hint;
    }
  });

  result.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-download]");
    if (!button || !lastQuote) return;
    const error = document.getElementById("kp-pdf-error");
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "Готовим PDF…";
    if (error) error.hidden = true;
    try {
      const assets = await loadPdfAssets();
      const bytes = renderQuotePdf(lastQuote, assets);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Бугтракт-" + lastQuote.number + ".pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      if (error) {
        error.hidden = false;
        error.textContent = "Не удалось собрать PDF. Обновите страницу и попробуйте ещё раз.";
      }
      console.error(err);
    } finally {
      button.disabled = false;
      button.textContent = previous;
    }
  });

  function fillModes() {
    const box = document.getElementById("kp-modes");
    TARIFFS.modes.forEach((mode) => {
      const label = document.createElement("label");
      label.className = "seg";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "mode";
      input.value = mode.id;
      const span = document.createElement("span");
      span.textContent = mode.short;
      label.append(input, span);
      box.append(label);
    });
  }

  function fillCargo() {
    const select = document.getElementById("kp-cargo");
    TARIFFS.cargoTypes.forEach((cargo) => {
      const option = document.createElement("option");
      option.value = cargo.id;
      option.textContent = cargo.label;
      select.append(option);
    });
  }

  function fillPlaces() {
    const list = document.getElementById("kp-places");
    const seen = new Set();
    const add = (value) => {
      if (seen.has(value)) return;
      seen.add(value);
      const option = document.createElement("option");
      option.value = value;
      list.append(option);
    };
    TARIFFS.places.forEach((place) => add(place.name + ", " + place.country));
    TARIFFS.countries.forEach((country) => add(country.name));
  }

  function setDateBounds() {
    const input = document.getElementById("kp-date");
    const today = new Date();
    input.min = iso(today);
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + TARIFFS.limits.dateHorizonDays);
    input.max = iso(horizon);
  }

  function readForm() {
    const data = new FormData(form);
    return {
      from: data.get("from"),
      to: data.get("to"),
      mode: data.get("mode") || "",
      weight: data.get("weight"),
      volume: data.get("volume"),
      pallets: data.get("pallets"),
      cargo: data.get("cargo"),
      date: data.get("date"),
      customs: data.get("customs") || "",
      name: data.get("name"),
      company: data.get("company"),
      phone: data.get("phone"),
      email: data.get("email"),
      consent: Boolean(form.querySelector("#kp-consent").checked),
    };
  }

  function clearErrors() {
    form.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    form.querySelectorAll(".err").forEach((node) => {
      node.hidden = true;
      node.textContent = "";
    });
  }

  function showErrors(errors) {
    Object.keys(errors).forEach((key) => {
      const node = form.querySelector("[data-field='" + key + "']");
      const box = node ? node.closest(".field") : null;
      const err = box && box.querySelector(".err");
      if (node) {
        node.setAttribute("aria-invalid", "true");
        if (err) {
          if (!err.id) err.id = node.id ? node.id + "-err" : key + "-err";
          node.setAttribute("aria-describedby", err.id);
          err.textContent = errors[key];
          err.hidden = false;
        }
      }
    });
  }

  function renderResult(quote, copy) {
    result.replaceChildren();
    const kicker = el("div", "kp-kicker");
    kicker.append(el("span", "", "Мгновенный расчёт · " + quote.number));
    if (quote.demo) kicker.append(el("span", "kp-demo", "демо-расчёт"));
    const route = el("p", "kp-route", quote.from + " — " + quote.to);
    const price = el("p", "kp-price", quote.rangeLabel);
    const days = el("p", "kp-days", "Срок доставки: " + quote.daysLabel);
    const meta = el("p", "kp-meta", quote.kmLabel + " · " + sourceLabel(quote.distanceSource) + " · действует до " + quote.validUntilLabel);
    const note = el("p", "kp-note", [quote.disclaimer, quote.demoDisclaimer, quote.distanceNote].filter(Boolean).join(" "));
    const list = document.createElement("ul");
    list.className = "kp-lines";
    quote.lines.forEach((line) => {
      const item = document.createElement("li");
      const text = document.createElement("div");
      text.append(el("strong", "", line.label));
      text.append(el("span", "", line.detail));
      item.append(text, el("b", "", line.amountLabel));
      list.append(item);
    });
    const actions = el("div", "kp-actions");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.dataset.download = "pdf";
    button.textContent = "Скачать КП в PDF";
    actions.append(button);
    const pdfError = el("p", "kp-error", "");
    pdfError.id = "kp-pdf-error";
    pdfError.hidden = true;
    pdfError.setAttribute("role", "alert");
    const manager = el("div", "kp-manager");
    manager.append(el("h3", "", "Копия заявки отправлена менеджеру"));
    manager.append(el("p", "kp-note", "Получатель в демо — " + quote.companyInfo.logistician + ", " + quote.companyInfo.email + ". Письмо и Telegram с этого сайта не уходят: ниже тот же текст копии."));
    const pre = document.createElement("pre");
    pre.className = "kp-copy";
    pre.textContent = copy.text;
    manager.append(pre);
    const again = el("p", "kp-note", "Измените параметры и нажмите кнопку ещё раз — вилка пересчитается.");
    result.append(kicker, route, price, days, meta, note, actions, pdfError, list, manager, again);
    result.hidden = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    result.focus();
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function sourceLabel(source) {
  if (source === "table") return "таблица направлений";
  if (source === "coords") return "оценка по координатам";
  return "запасной километраж";
}

function iso(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

function nextSeq() {
  try {
    const key = "bugtrakt-kp-seq";
    const current = Number(sessionStorage.getItem(key) || "1000");
    const next = current >= 9999 ? 1001 : current + 1;
    sessionStorage.setItem(key, String(next));
    return next;
  } catch (err) {
    return Math.floor(1000 + Math.random() * 9000);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[src='" + src + "']");
    if (existing && existing.dataset.loaded === "1") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error("Не удалось загрузить библиотеку PDF"));
    document.head.appendChild(script);
  });
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function loadPdfAssets() {
  if (pdfAssets) return pdfAssets;
  const pending = (async () => {
    await loadScript("assets/vendor/jspdf.umd.min.js");
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error("PDF-библиотека не инициализировалась");
    const loadFont = async (path) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error("Шрифт PDF не найден");
      return toBase64(await response.arrayBuffer());
    };
    return {
      jsPDF,
      regularBase64: await loadFont("assets/fonts/kp/Roboto-Regular.ttf"),
      boldBase64: await loadFont("assets/fonts/kp/Roboto-Bold.ttf"),
    };
  })();
  pdfAssets = pending.catch((err) => {
    pdfAssets = null;
    throw err;
  });
  return pdfAssets;
}
