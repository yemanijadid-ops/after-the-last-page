import { json } from "../../_lib/auth.js";

export async function onRequestGet({ env }) {
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
