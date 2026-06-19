import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Firecrawl } from "firecrawl";
import { buildRetrievalChunks } from "./chunks";
import { OUTPUT_DIR } from "./config";
import { type PageRecord, scrapeAll } from "./scraper";

interface ReportPage {
  name: string;
  status: string;
  markdown_length: number;
  link_count: number;
}

interface Report {
  scraped_at: string;
  pages: ReportPage[];
  ok_count: number;
  failed_count: number;
}

/** Map a record back to its filesystem slug (matches config PAGES names). */
function slugFromRecord(record: PageRecord): string {
  try {
    const p = new URL(record.url).pathname.replace(/^\/|\/$/g, "");
    return p || "home";
  } catch {
    return "home";
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: FIRECRAWL_API_KEY is not set. Provide it in the environment, e.g.\n" +
        "  FIRECRAWL_API_KEY=fc-... bun run crawl:devpost",
    );
    process.exit(1);
  }

  const firecrawl = new Firecrawl({ apiKey });

  console.log("Scraping Devpost pages via Firecrawl...");
  const records = await scrapeAll(firecrawl);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const reportPages: ReportPage[] = [];
  for (const record of records) {
    const name = slugFromRecord(record);
    const outPath = path.join(OUTPUT_DIR, `${name}.json`);
    await writeFile(outPath, `${JSON.stringify(record, null, 2)}\n`, "utf-8");

    const marker = record.status === "ok" ? "ok" : record.status;
    console.log(
      `  [${marker}] ${name} — ${record.markdown.length} chars, ` +
        `${record.links.length} links${record.statusReason ? ` (${record.statusReason})` : ""}`,
    );

    reportPages.push({
      name,
      status: record.status,
      markdown_length: record.markdown.length,
      link_count: record.links.length,
    });
  }

  const chunks = buildRetrievalChunks(records);
  await writeFile(
    path.join(OUTPUT_DIR, "retrieval_chunks.json"),
    `${JSON.stringify(chunks, null, 2)}\n`,
    "utf-8",
  );

  const okCount = records.filter((r) => r.status === "ok").length;
  const report: Report = {
    scraped_at: new Date().toISOString(),
    pages: reportPages,
    ok_count: okCount,
    failed_count: records.length - okCount,
  };
  await writeFile(
    path.join(OUTPUT_DIR, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf-8",
  );

  console.log(
    `\nDone. ${okCount}/${records.length} pages ok, ${chunks.length} chunks. ` +
      `Output: ${OUTPUT_DIR}`,
  );
}

main().catch((error) => {
  console.error("Crawl failed:", error);
  process.exit(1);
});
