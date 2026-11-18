/**
 * Копия заявки менеджеру.
 *
 * Демо не отправляет письма и не ходит в Telegram: ключей и секретов здесь нет.
 * Экран показывает текст копии, а эта функция — точка подключения.
 *
 * Как включить доставку для живого клиента:
 * 1. Поднимите свой эндпоинт (серверная функция, не браузер). CSP сайта
 *    разрешает запросы только на свой домен, поэтому Telegram Bot API
 *    отсюда напрямую вызывать не нужно и нельзя: токен не должен попасть в JS.
 * 2. В эндпоинте читайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID
 *    или SMTP-пароль из переменных окружения и отправляйте `text`.
 * 3. Здесь поставьте enabled: true и endpoint: "/api/lead".
 *    Тело запроса: { text, number }.
 */

export const NOTIFY = {
  enabled: false,
  endpoint: "",
  emailTo: "cargo@bugtrakt.by",
};

export async function sendManagerCopy(quote, formatText) {
  const text = formatText(quote);
  const delivery = {
    enabled: NOTIFY.enabled,
    endpoint: NOTIFY.endpoint,
    demo: true,
    delivered: false,
    channel: "screen",
    text,
  };
  if (!NOTIFY.enabled || !NOTIFY.endpoint) {
    console.info("[Бугтракт демо] Копия менеджеру показана на экране, наружу не отправлена.");
    return delivery;
  }
  const response = await fetch(NOTIFY.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ text, number: quote.number }),
  });
  delivery.demo = false;
  delivery.delivered = response.ok;
  delivery.channel = "endpoint";
  delivery.status = response.status;
  return delivery;
}
