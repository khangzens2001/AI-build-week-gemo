import { createHash } from "node:crypto";
import type { Firecrawl } from "firecrawl";
import { MAX_RETRIES, PAGES, type PageSpec } from "./config";
import { type MarkdownImage, type MarkdownLink, extractMarkdownLinks } from "./markdown";
import { type PageStatus, validatePage } from "./validate";

export interface PageRecord {
  url: string;
  title: string;
  markdown: string;
  metadata: {
    sourceURL: string;
    description: string;
    language: string;
  };
  links: MarkdownLink[];
  images: MarkdownImage[];
  status: PageStatus;
  statusReason: string;
  content_hash: string;
  scraped_at: string;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Scrape a single Devpost page via Firecrawl, retrying up to MAX_RETRIES on a
 * thrown error or on a `failed_api` bot-block result. Firecrawl returns
 * markdown directly (bypassing Cloudflare), replacing the Dart proxy + HTML→MD.
 */
export async function scrapePage(firecrawl: Firecrawl, page: PageSpec): Promise<PageRecord> {
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const doc = await firecrawl.scrape(page.url, {
        formats: ["markdown"],
        onlyMainContent: true,
      });

      const markdown = doc.markdown ?? "";
      const title = doc.metadata?.title ?? page.title;
      const { status, statusReason } = validatePage(markdown, title);

      // Bot-block: retry if we still have attempts left.
      if (status === "failed_api" && attempt < MAX_RETRIES) {
        lastError = statusReason;
        continue;
      }

      const { links, images } = extractMarkdownLinks(markdown);

      return {
        url: page.url,
        title,
        markdown,
        metadata: {
          sourceURL: doc.metadata?.sourceURL ?? page.url,
          description: doc.metadata?.description ?? "",
          language: doc.metadata?.language ?? "",
        },
        links,
        images,
        status,
        statusReason,
        content_hash: sha256(markdown),
        scraped_at: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // Fall through to retry; loop exit handles the final failure record.
    }
  }

  // All retries exhausted.
  return {
    url: page.url,
    title: page.title,
    markdown: "",
    metadata: { sourceURL: page.url, description: "", language: "" },
    links: [],
    images: [],
    status: "failed_api",
    statusReason: lastError || "scrape failed",
    content_hash: sha256(""),
    scraped_at: new Date().toISOString(),
  };
}

/** Scrape all five pages in parallel (mirrors the Dart `Future.wait`). */
export async function scrapeAll(firecrawl: Firecrawl): Promise<PageRecord[]> {
  return Promise.all(PAGES.map((page) => scrapePage(firecrawl, page)));
}
