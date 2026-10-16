import { isAuthenticated, json } from "../_lib/auth.js";

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `page-${Date.now()}`;
}

export async function onRequestGet({ request, env }) {
  if (!(await isAuthenticated(request, env))) {
    return json({ error: "لطفاً وارد شوید." }, { status: 401 });
  }
  const { results } = await env.DB.prepare(
    "SELECT id, slug, title, status, created_at, updated_at FROM pages ORDER BY updated_at DESC"
  ).all();
  return json({ pages: results });
}

export async function onRequestPost({ request, env }) {
  if (!(await isAuthenticated(request, env))) {
    return json({ error: "لطفاً وارد شوید." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const title = (body?.title || "صفحه بدون عنوان").trim();
  let slug = slugify(body?.slug || title);
  const now = new Date().toISOString();

  // ensure slug uniqueness
  let finalSlug = slug;
  let attempt = 1;
  while (true) {
    const existing = await env.DB.prepare("SELECT id FROM pages WHERE slug = ?")
      .bind(finalSlug)
      .first();
    if (!existing) break;
    attempt += 1;
    finalSlug = `${slug}-${attempt}`;
  }

  const result = await env.DB.prepare(
    "INSERT INTO pages (slug, title, content, status, created_at, updated_at) VALUES (?, ?, '[]', 'draft', ?, ?)"
  )
    .bind(finalSlug, title, now, now)
    .run();

  const newId = result.meta.last_row_id;
  return json({ id: newId, slug: finalSlug }, { status: 201 });
}
