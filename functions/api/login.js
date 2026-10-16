import { createSessionToken, sessionSetCookieHeader, json } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const { password } = body || {};

  if (!env.ADMIN_PASSWORD) {
    return json(
      { error: "رمز عبور ادمین تنظیم نشده است (متغیر ADMIN_PASSWORD را در تنظیمات هاست تعیین کنید)." },
      { status: 500 }
    );
  }

  if (!password || password !== env.ADMIN_PASSWORD) {
    return json({ error: "رمز عبور اشتباه است." }, { status: 401 });
  }

  if (!env.SESSION_SECRET) {
    return json(
      { error: "SESSION_SECRET تنظیم نشده است (آن را در تنظیمات هاست تعیین کنید)." },
      { status: 500 }
    );
  }

  const token = await createSessionToken(env.SESSION_SECRET);

  return json(
    { ok: true },
    { headers: { "Set-Cookie": sessionSetCookieHeader(token) } }
  );
}
