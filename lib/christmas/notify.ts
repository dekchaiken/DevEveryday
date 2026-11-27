// แจ้งเตือนแอดมินผ่าน Webhook (ตั้งค่า XMAS_ALERT_WEBHOOK_URL) รูปแบบ JSON ใช้ได้กับ Discord และ Slack
// ไม่ทำให้การทำรายการหลักล้มเหลว: หมดเวลาหรือส่งไม่ได้ก็แค่ข้ามไป
export function alertsConfigured(): boolean {
  return Boolean(process.env.XMAS_ALERT_WEBHOOK_URL);
}

export async function notifyAdmin(text: string): Promise<boolean> {
  const url = process.env.XMAS_ALERT_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, text }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
