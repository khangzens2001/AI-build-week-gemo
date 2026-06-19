import { BASE_URL } from "./config";

export interface MarkdownLink {
  text: string;
  url: string;
  type: string;
}

export interface MarkdownImage {
  alt: string;
  url: string;
}

/**
 * Port of `extract_markdown_links` from the Python scraper. Images (`![..](..)`)
 * are matched first so their spans can be excluded from the plain link pass.
 */
export function extractMarkdownLinks(markdown: string): {
  links: MarkdownLink[];
  images: MarkdownImage[];
} {
  const images: MarkdownImage[] = [];
  const imageSpans: Array<[number, number]> = [];

  const imageRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  for (let m = imageRe.exec(markdown); m !== null; m = imageRe.exec(markdown)) {
    imageSpans.push([m.index, m.index + m[0].length]);
    images.push({ alt: m[1].trim(), url: m[2].trim() });
  }

  const links: MarkdownLink[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (let m = linkRe.exec(markdown); m !== null; m = linkRe.exec(markdown)) {
    const start = m.index;
    if (imageSpans.some(([s, e]) => s <= start && start < e)) continue;
    const url = m[2].trim();
    links.push({
      text: m[1].replace(/\s+/g, " ").trim(),
      url,
      type: classifyLink(url),
    });
  }

  return { links, images };
}

/**
 * Port of `classify_link`, adapted for the Devpost base host. Same-host links
 * are `internal_anchor` when they carry a fragment, otherwise `internal_page`.
 */
export function classifyLink(url: string): string {
  if (url.startsWith("mailto:")) return "email";

  let parsed: URL;
  try {
    parsed = new URL(url, `${BASE_URL}/`);
  } catch {
    return "external";
  }

  const baseHost = new URL(BASE_URL).host;
  if (parsed.host === baseHost) {
    return parsed.hash ? "internal_anchor" : "internal_page";
  }

  const host = parsed.host;
  if (host.includes("luma.com")) return "registration";
  if (host.includes("discord")) return "community";
  if (host.includes("whatsapp")) return "community";
  if (host.includes("drive.google.com")) return "document";
  return "external";
}
