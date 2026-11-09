import { svgToPng } from "./raster.js";

export function telegramConfigured() {
  return Boolean(process.env.CHAUPAL_TELEGRAM_BOT_TOKEN && process.env.CHAUPAL_TELEGRAM_CHAT_ID);
}

/**
 * Sends one approved family update (picture + caption) to the family's
 * Telegram chat through the Bot API. The token and chat belong to the
 * deployment; nothing is sent without the elder's approval upstream.
 */
export async function sendTelegramPhoto(svg: string, caption: string) {
  const token = process.env.CHAUPAL_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.CHAUPAL_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false as const, reason: "telegram_not_configured" };
  const png = await svgToPng(svg);
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption.slice(0, 1000));
  form.append("photo", new Blob([png.slice().buffer as ArrayBuffer], { type: "image/png" }), "chaupal.png");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id: number }; description?: string };
  if (!body.ok) return { ok: false as const, reason: (body.description ?? `http_${res.status}`).slice(0, 200) };
  return { ok: true as const, messageId: body.result!.message_id };
}
