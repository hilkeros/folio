import type { Publisher, StandardDocument } from "../atproto/publications";

// --- Facet / rich-text helpers (mirrors indiemusich-blog's applyFacets) ---

interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFacets(plaintext: string, facets: any[]): TextSpan[] {
  if (!facets?.length) return [{ text: plaintext }];

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(plaintext);
  const sorted = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  );
  const spans: TextSpan[] = [];
  let cursor = 0;

  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart > cursor) {
      spans.push({ text: decoder.decode(bytes.slice(cursor, byteStart)) });
    }
    const facetText = decoder.decode(bytes.slice(byteStart, byteEnd));
    const span: TextSpan = { text: facetText };
    for (const f of facet.features ?? []) {
      if (f.$type?.endsWith("#bold")) span.bold = true;
      else if (f.$type?.endsWith("#italic")) span.italic = true;
      else if (f.$type?.endsWith("#code")) span.code = true;
      else if (f.$type?.endsWith("#link") && f.uri) span.href = f.uri;
    }
    spans.push(span);
    cursor = byteEnd;
  }

  if (cursor < bytes.length) {
    spans.push({ text: decoder.decode(bytes.slice(cursor)) });
  }
  return spans;
}

function spansToHtml(spans: TextSpan[]): string {
  return spans
    .map((span) => {
      let text = escapeHtml(span.text);
      if (span.bold) text = `<strong>${text}</strong>`;
      if (span.italic) text = `<em>${text}</em>`;
      if (span.code) text = `<code>${text}</code>`;
      if (span.href)
        text = `<a href="${escapeHtml(span.href)}">${text}</a>`;
      return text;
    })
    .join("");
}

// --- Content parser: handles pub.leaflet.content and blog.pckt.content ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contentToHtml(content: any): string {
  if (!content) return "";

  const parts: string[] = [];

  if (content.$type === "pub.leaflet.content") {
    // Hierarchical: pages → blocks → block
    for (const page of content.pages ?? []) {
      for (const entry of page.blocks ?? []) {
        const b = entry.block ?? entry;
        const html = blockToHtml(b);
        if (html) parts.push(html);
      }
    }
  } else {
    // Flat: items array (blog.pckt.content or unknown)
    const items = content.items ?? content.blocks ?? [];
    for (const item of items) {
      const html = blockToHtml(item);
      if (html) parts.push(html);
    }
  }

  return parts.join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blockToHtml(b: any): string {
  if (!b) return "";

  // Unordered list — pub.leaflet.blocks.unorderedList
  // children[].content.{ plaintext, facets }
  if (b.$type === "pub.leaflet.blocks.unorderedList") {
    const items: string[] = (b.children ?? []).map((child: any) => {
      const c = child.content ?? {};
      return `<li>${spansToHtml(applyFacets(c.plaintext ?? "", c.facets ?? []))}</li>`;
    });
    return items.length > 0 ? `<ul>${items.join("")}</ul>` : "";
  }

  // Unordered list — blog.pckt.block.bulletList
  // content[] of blog.pckt.block.listItem, each with content[] of blog.pckt.block.text
  if (b.$type === "blog.pckt.block.bulletList") {
    const items: string[] = (b.content ?? []).map((listItem: any) => {
      const text = (listItem.content ?? [])
        .map((t: any) => spansToHtml(applyFacets(t.plaintext ?? "", t.facets ?? [])))
        .join("");
      return `<li>${text}</li>`;
    });
    return items.length > 0 ? `<ul>${items.join("")}</ul>` : "";
  }

  // Image block — emit a placeholder caption; blobs can't easily embed in EPUB
  if (
    b.$type === "pub.leaflet.blocks.image" ||
    b.$type === "blog.pckt.block.image" ||
    b.image ||
    b.attrs?.blob
  ) {
    const alt = b.alt ?? b.attrs?.alt ?? "";
    return alt ? `<p><em>[Image: ${escapeHtml(alt)}]</em></p>` : "";
  }

  const plaintext: string = b.plaintext ?? b.text ?? b.attrs?.text ?? "";
  const facets = b.facets ?? b.attrs?.facets ?? [];

  if (!plaintext.trim()) return "<br/>";

  const spans = applyFacets(plaintext, facets);
  const html = spansToHtml(spans);

  // Heading blocks
  if (
    b.$type === "pub.leaflet.blocks.header" ||
    b.$type === "blog.pckt.block.heading"
  ) {
    const level = Math.min(Math.max(b.level ?? 2, 1), 6);
    return `<h${level}>${html}</h${level}>`;
  }

  return `<p>${html}</p>`;
}

// --- Utilities ---

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// --- EPUB chapter assembly ---

function documentToChapter(doc: StandardDocument): {
  title: string;
  author: string;
  content: string;
} {
  const byline = doc.authorHandle ? `@${doc.authorHandle}` : doc.authorDid;

  const meta = [
    doc.site ? `<strong>${escapeHtml(doc.site)}</strong>` : null,
    byline ? `<span>${escapeHtml(byline)}</span>` : null,
    `<time>${formatDate(doc.publishedAt)}</time>`,
    doc.tags?.length
      ? `<span class="tags">${doc.tags.map(escapeHtml).join(", ")}</span>`
      : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  const description = doc.description
    ? `<p class="description"><em>${escapeHtml(doc.description)}</em></p>`
    : "";

  const body = contentToHtml(doc.content);

  const noContentNote = !body && doc.canonicalUrl
    ? `<p class="read-online">Full article: <a href="${escapeHtml(doc.canonicalUrl)}">${escapeHtml(doc.canonicalUrl)}</a></p>`
    : !body
    ? `<p><em>(No content available)</em></p>`
    : "";

  return {
    title: doc.title,
    author: byline,
    content: `
      <div class="article-meta">${meta}</div>
      ${description}
      <hr/>
      ${body || noContentNote}
    `,
  };
}

// --- Main export ---

export async function generateEpub(
  publishers: Publisher[],
  from: Date,
  to: Date,
): Promise<Buffer> {
  const allDocs: StandardDocument[] = publishers.flatMap((p) =>
    p.documents.filter((d) => {
      const dt = new Date(d.publishedAt);
      return dt >= from && dt <= to;
    }),
  );

  allDocs.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const fromLabel = formatDate(from.toISOString());
  const toLabel = formatDate(to.toISOString());
  const title = `Folio: ${fromLabel} – ${toLabel}`;

  const chapters = allDocs.map(documentToChapter);

  const { default: Epub } = await import("epub-gen-memory");

  const epubBuffer = await Epub(
    {
      title,
      author: "folio",
      publisher: "folio / standard.site",
      description: `Collected articles from ${fromLabel} to ${toLabel}`,
      tocTitle: "Articles",
      prependChapterTitles: true,
      css: `
        body { font-family: Georgia, serif; line-height: 1.6; }
        .article-meta { font-size: 0.85em; color: #666; margin-bottom: 0.5em; }
        .description { font-style: italic; color: #444; }
        hr { border: none; border-top: 1px solid #ccc; margin: 1.2em 0; }
        h1, h2, h3, h4 { line-height: 1.3; margin: 1em 0 0.4em; }
        p { margin: 0.6em 0; }
        code { font-family: monospace; background: #f4f4f4; padding: 0 0.2em; }
        a { color: #1a5490; }
        .read-online { font-size: 0.9em; color: #555; word-break: break-all; }
      `,
    },
    chapters,
  );

  return Buffer.isBuffer(epubBuffer)
    ? epubBuffer
    : Buffer.from(epubBuffer as ArrayBuffer);
}
