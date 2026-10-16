import { isAuthenticated, json } from "../../_lib/auth.js";

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `page-${Date.now()}`;
}

export async function onRequestGet({ request, env, params }) {
  if (!(await isAuthenticated(request, env))) {
    return json({ error: "لطفاً وارد شوید." }, { status: 401 });
  }
  const page = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(params.id).first();
  if (!page) return json({ error: "صفحه پیدا نشد." }, { status: 404 });
  return json({ ...page, content: JSON.parse(page.content || "[]") });
}

export async function onRequestPut({ request, env, params }) {
  if (!(await isAuthenticated(request, env))) {
    return json({ error: "لطفاً وارد شوید." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(params.id).first();
  if (!existing) return json({ error: "صفحه پیدا نشد." }, { status: 404 });

  const title = body.title != null ? String(body.title).trim() : existing.title;
  const status = body.status === "published" ? "published" : body.status === "draft" ? "draft" : existing.status;
  const content = Array.isArray(body.content) ? JSON.stringify(body.content) : existing.content;

  let slug = existing.slug;
  if (body.slug) {
    const candidate = slugify(body.slug);
    if (candidate !== existing.slug) {
      const clash = await env.DB.prepare("SELECT id FROM pages WHERE slug = ? AND id != ?")
        .bind(candidate, params.id)
        .first();
      slug = clash ? existing.slug : candidate;
    }
  }

  const now = new Date().toISOString();

  await env.DB.prepare(
    "UPDATE pages SET title = ?, slug = ?, content = ?, status = ?, updated_at = ? WHERE id = ?"
  )
    .bind(title, slug, content, status, now, params.id)
    .run();

  return json({ ok: true, slug });
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await isAuthenticated(request, env))) {
    return json({ error: "لطفاً وارد شوید." }, { status: 401 });
  }
  await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
