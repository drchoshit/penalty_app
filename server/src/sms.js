import SolapiMessageService from "solapi";

export function makeSmsClient() {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  if (!apiKey || !apiSecret) return null;

  // Solapi SDK is compatible with CoolSMS family services.
  // Node.js 18+ recommended.
  return new SolapiMessageService(apiKey, apiSecret);
}

export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("0") ? digits : `0${digits}`;
}

export async function sendSms({ client, to, from, text }) {
  // solapi: sendOne (returns promise)
  return await client.sendOne({
    to,
    from,
    text
  });
}
