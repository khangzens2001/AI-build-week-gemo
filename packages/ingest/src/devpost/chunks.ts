import type { PageRecord } from "./scraper";

export interface Chunk {
  id: string;
  type: "devpost_page";
  text: string;
  source_url: string;
}

const MAX_CHUNK_CHARS = 1500;

/** Collapse runs of blank lines and trailing whitespace, then trim. */
function collapseWhitespace(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface Section {
  title: string;
  body: string;
}

/** Split markdown into sections at heading lines (`#`, `##`, `###`, ...). */
function splitByHeadings(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[2].trim(), body: "" };
    } else if (current) {
      current.body += `${line}\n`;
    } else {
      // Preamble before the first heading.
      current = { title: "", body: `${line}\n` };
    }
  }
  if (current) sections.push(current);

  return sections;
}

/**
 * Build retrieval chunks for the page-level RAG store. One chunk per non-empty
 * heading section; pages without headings yield a single whole-markdown chunk.
 * Non-`ok` pages are skipped. Each chunk is capped at ~1500 chars.
 */
export function buildRetrievalChunks(records: PageRecord[]): Chunk[] {
  const chunks: Chunk[] = [];

  for (const record of records) {
    if (record.status !== "ok") continue;

    const markdown = record.markdown;
    const sections = splitByHeadings(markdown).filter((s) =>
      collapseWhitespace(`${s.title}\n${s.body}`),
    );

    const pageName = pageNameFromUrl(record);

    if (sections.length === 0) {
      const text = collapseWhitespace(markdown).slice(0, MAX_CHUNK_CHARS);
      if (text) {
        chunks.push({
          id: `devpost-${pageName}-0`,
          type: "devpost_page",
          text,
          source_url: record.url,
        });
      }
      continue;
    }

    let n = 0;
    for (const section of sections) {
      const text = collapseWhitespace(`${section.title}\n${section.body}`).slice(
        0,
        MAX_CHUNK_CHARS,
      );
      if (!text) continue;
      chunks.push({
        id: `devpost-${pageName}-${n}`,
        type: "devpost_page",
        text,
        source_url: record.url,
      });
      n++;
    }
  }

  return chunks;
}

/** Derive a stable slug from the record url (matches config PAGES names). */
function pageNameFromUrl(record: PageRecord): string {
  try {
    const path = new URL(record.url).pathname.replace(/^\/|\/$/g, "");
    return path || "home";
  } catch {
    return "home";
  }
}
