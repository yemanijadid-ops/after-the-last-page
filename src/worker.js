import {
  createSessionToken,
  isAuthenticated,
  sessionSetCookieHeader,
  sessionClearCookieHeader,
  json,
} from "./lib/auth.js";

function slugify(input) {
  return (
    String(input)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `page-${Date.now()}`
  );
}

async function requireAuth(request, env) {
  if (!(await isAuthenticated(request, env))) {
    return json({ error: "لطفاً وارد شوید." }, { status: 401 });
  }
  return null;
}

// ---- auth ----

async function login(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  if (!env.ADMIN_PASSWORD) {
    return json(
      { error: "رمز عبور ادمین تنظیم نشده است (ADMIN_PASSWORD را در تنظیمات تعیین کنید)." },
      { status: 500 }
    );
  }
  if (!body?.password || body.password !== env.ADMIN_PASSWORD) {
    return json({ error: "رمز عبور اشتباه است." }, { status: 401 });
  }
  if (!env.SESSION_SECRET) {
    return json({ error: "SESSION_SECRET تنظیم نشده است." }, { status: 500 });
  }

  const token = await createSessionToken(env.SESSION_SECRET);
  return json({ ok: true }, { headers: { "Set-Cookie": sessionSetCookieHeader(token) } });
}

async function logout() {
  return json({ ok: true }, { headers: { "Set-Cookie": sessionClearCookieHeader() } });
}

async function sessionCheck(request, env) {
  return json({ authenticated: await isAuthenticated(request, env) });
}

// ---- admin pages CRUD ----

async function listPages(request, env) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  const { results } = await env.DB.prepare(
    "SELECT id, slug, title, status, created_at, updated_at FROM pages ORDER BY updated_at DESC"
  ).all();
  return json({ pages: results });
}

async function createPage(request, env) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const title = (body?.title || "صفحه بدون عنوان").trim();
  const baseSlug = slugify(body?.slug || title);
  const now = new Date().toISOString();

  let finalSlug = baseSlug;
  let attempt = 1;
  while (true) {
    const existing = await env.DB.prepare("SELECT id FROM pages WHERE slug = ?").bind(finalSlug).first();
    if (!existing) break;
    attempt += 1;
    finalSlug = `${baseSlug}-${attempt}`;
  }

  const result = await env.DB.prepare(
    "INSERT INTO pages (slug, title, content, status, created_at, updated_at) VALUES (?, ?, '[]', 'draft', ?, ?)"
  )
    .bind(finalSlug, title, now, now)
    .run();

  return json({ id: result.meta.last_row_id, slug: finalSlug }, { status: 201 });
}

async function getPage(request, env, id) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  const page = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first();
  if (!page) return json({ error: "صفحه پیدا نشد." }, { status: 404 });
  return json({ ...page, content: JSON.parse(page.content || "[]") });
}

async function updatePage(request, env, id) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "صفحه پیدا نشد." }, { status: 404 });

  const title = body.title != null ? String(body.title).trim() : existing.title;
  const status = body.status === "published" ? "published" : body.status === "draft" ? "draft" : existing.status;
  const content = Array.isArray(body.content) ? JSON.stringify(body.content) : existing.content;

  let slug = existing.slug;
  if (body.slug) {
    const candidate = slugify(body.slug);
    if (candidate !== existing.slug) {
      const clash = await env.DB.prepare("SELECT id FROM pages WHERE slug = ? AND id != ?")
        .bind(candidate, id)
        .first();
      slug = clash ? existing.slug : candidate;
    }
  }

  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE pages SET title = ?, slug = ?, content = ?, status = ?, updated_at = ? WHERE id = ?")
    .bind(title, slug, content, status, now, id)
    .run();

  return json({ ok: true, slug });
}

async function deletePage(request, env, id) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// ---- public endpoints ----

async function publicListPages(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, slug, title, content, updated_at FROM pages WHERE status = 'published' ORDER BY updated_at DESC"
  ).all();

  const pages = results.map((p) => {
    let excerpt = "";
    try {
      const blocks = JSON.parse(p.content || "[]");
      const firstText = blocks.find((b) => b.type === "paragraph" || b.type === "heading");
      excerpt = firstText ? String(firstText.content?.text || "").slice(0, 160) : "";
    } catch {
      excerpt = "";
    }
    return { id: p.id, slug: p.slug, title: p.title, updated_at: p.updated_at, excerpt };
  });

  return json({ pages });
}

async function publicGetPage(env, slug) {
  const page = await env.DB.prepare(
    "SELECT id, slug, title, content, updated_at FROM pages WHERE slug = ? AND status = 'published'"
  )
    .bind(slug)
    .first();
  if (!page) return json({ error: "صفحه پیدا نشد." }, { status: 404 });
  return json({ ...page, content: JSON.parse(page.content || "[]") });
}

// ---- router ----

async function handleApi(request, env, path, method) {
  if (path === "/api/login" && method === "POST") return login(request, env);
  if (path === "/api/logout" && method === "POST") return logout();
  if (path === "/api/session" && method === "GET") return sessionCheck(request, env);

  if (path === "/api/pages" && method === "GET") return listPages(request, env);
  if (path === "/api/pages" && method === "POST") return createPage(request, env);

  const idMatch = path.match(/^\/api\/pages\/(\d+)$/);
  if (idMatch) {
    if (method === "GET") return getPage(request, env, idMatch[1]);
    if (method === "PUT") return updatePage(request, env, idMatch[1]);
    if (method === "DELETE") return deletePage(request, env, idMatch[1]);
  }

  if (path === "/api/public/pages" && method === "GET") return publicListPages(env);

  const slugMatch = path.match(/^\/api\/public\/pages\/([^/]+)$/);
  if (slugMatch && method === "GET") return publicGetPage(env, decodeURIComponent(slugMatch[1]));

  return json({ error: "یافت نشد." }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url.pathname, request.method);
    }
    return env.ASSETS.fetch(request);
  },
};
