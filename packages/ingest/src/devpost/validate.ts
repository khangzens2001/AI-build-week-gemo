export type PageStatus = "ok" | "skipped_empty" | "skipped_404" | "failed_api";

export interface ValidationResult {
  status: PageStatus;
  statusReason: string;
}

/**
 * Bot-block / Cloudflare signals ported from `_proxyErrorSignals` in the Dart
 * scraper. Compared case-insensitively against the markdown.
 */
const BOT_BLOCK_SIGNALS = [
  "error 1015",
  "error 1020",
  "checking your browser",
  "cf-browser-verification",
  "access denied",
];

/**
 * Port of `validate_page`. The bot-block check runs before the length check so
 * a short challenge page is reported as `failed_api`, not `skipped_empty`.
 */
export function validatePage(markdown: string, title: string): ValidationResult {
  const md = (markdown ?? "").trim();
  const t = (title ?? "").toLowerCase();

  if (!md) {
    return { status: "skipped_empty", statusReason: "empty markdown" };
  }

  if (md.includes("# 404") || md.includes("Oops! Page not found") || t === "404") {
    return { status: "skipped_404", statusReason: "page returned 404 content" };
  }

  const lower = md.toLowerCase();
  for (const signal of BOT_BLOCK_SIGNALS) {
    if (lower.includes(signal)) {
      return { status: "failed_api", statusReason: "bot-block detected" };
    }
  }

  if (md.length < 300) {
    return {
      status: "skipped_empty",
      statusReason: `markdown too short (${md.length} chars)`,
    };
  }

  return { status: "ok", statusReason: "" };
}
