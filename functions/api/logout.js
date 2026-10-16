import { sessionClearCookieHeader, json } from "../_lib/auth.js";

export async function onRequestPost() {
  return json({ ok: true }, { headers: { "Set-Cookie": sessionClearCookieHeader() } });
}
