import Solapi from "solapi";

export function makeSmsClient() {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  if (!apiKey || !apiSecret) return null;

  // solapi 패키지는 환경/버전에 따라 export 형태가 달라질 수 있어서 둘 다 대응
  // - named export: { SolapiMessageService }
  // - default export: SolapiMessageService
  const Service = Solapi?.SolapiMessageService ?? Solapi;

  const client = new Service(apiKey, apiSecret);

  // 혹시 생성은 되었는데 메서드가 없으면 런타임에서 바로 알 수 있게 에러
  if (!client || typeof client.sendOne !== "function") {
    throw new Error("Solapi client initialization failed: sendOne() not found");
  }

  return client;
}

export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("0") ? digits : `0${digits}`;
}

export async function sendSms({ client, to, from, text }) {
  return await client.sendOne({
    to,
    from,
    text
  });
}
