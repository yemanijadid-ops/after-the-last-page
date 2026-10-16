import { json } from "../../../_lib/auth.js";

export async function onRequestGet({ env, params }) {
  const page = await env.DB.prepare(
    "SELECT id, slug, title, content, updated_at FROM pages WHERE slug = ? AND status = 'published'"
  )
    .bind(params.slug)
    .first();

  if (!page) return json({ error: "صفحه پیدا نشد." }, { status: 404 });

  return json({ ...page, content: JSON.parse(page.content || "[]") });
}
