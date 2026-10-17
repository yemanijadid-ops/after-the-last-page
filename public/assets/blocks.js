// Shared block system. Each block: { id, type, content: {...} }
// Loaded by both the public site and the admin editor.

const BLOCK_TYPES = {
  heading: {
    label: "تیتر",
    defaultContent: { text: "تیتر تازه", level: 2 },
  },
  paragraph: {
    label: "متن",
    defaultContent: { text: "" },
  },
  quote: {
    label: "نقل‌قول کتاب",
    defaultContent: { text: "", source: "" },
  },
  image: {
    label: "تصویر",
    defaultContent: { url: "", caption: "" },
  },
  divider: {
    label: "جداکننده",
    defaultContent: {},
  },
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Plain text -> HTML paragraphs, preserving line breaks, without allowing raw HTML injection.
function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function renderBlockHTML(block) {
  const c = block.content || {};
  switch (block.type) {
    case "heading": {
      const level = c.level === 3 ? 3 : 2;
      const tag = `h${level}`;
      return `<${tag} class="block block-heading">${textToHtml(c.text)}</${tag}>`;
    }
    case "paragraph":
      return `<p class="block block-paragraph">${textToHtml(c.text)}</p>`;
    case "quote":
      return `<blockquote class="block block-quote">
        <p>${textToHtml(c.text)}</p>
        ${c.source ? `<cite>${textToHtml(c.source)}</cite>` : ""}
      </blockquote>`;
    case "image":
      return `<figure class="block block-image">
        ${c.url ? `<img src="${escapeHtml(c.url)}" alt="${escapeHtml(c.caption || "")}" loading="lazy">` : ""}
        ${c.caption ? `<figcaption>${textToHtml(c.caption)}</figcaption>` : ""}
      </figure>`;
    case "divider":
      return `<hr class="block block-divider">`;
    default:
      return "";
  }
}

function renderBlocksHTML(blocks) {
  return (blocks || []).map(renderBlockHTML).join("\n");
}
