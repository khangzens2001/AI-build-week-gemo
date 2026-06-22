import path from "node:path";

export const BASE_URL = "https://agentic-ai-build-week-2026.devpost.com";

export interface PageSpec {
  name: string;
  url: string;
  title: string;
}

/**
 * The five Devpost pages we ingest. `name` is a filesystem-safe slug used for
 * output filenames and chunk ids. The Dart source attached a `_gl` tracking
 * query param to the home url — we drop it and use the bare base url.
 */
export const PAGES: PageSpec[] = [
  { name: "home", url: BASE_URL, title: "Home" },
  { name: "resources", url: `${BASE_URL}/resources`, title: "Resources" },
  { name: "updates", url: `${BASE_URL}/updates`, title: "Updates" },
  { name: "rules", url: `${BASE_URL}/rules`, title: "Rules" },
  {
    name: "project-gallery",
    url: `${BASE_URL}/project-gallery`,
    title: "Project Gallery",
  },
];

/**
 * Where the scrape writes per-page JSON + retrieval_chunks.json + report.json.
 * Defaults to packages/ingest/data/devpost/, overridable via DEVPOST_OUTPUT_DIR
 * so the VM sweep (infra/vm/devpost-ingest.sh) can point it at a mounted podman
 * volume the embed step then reads from.
 */
export const OUTPUT_DIR =
  process.env.DEVPOST_OUTPUT_DIR ?? path.join(import.meta.dir, "../../data/devpost");

export const MAX_RETRIES = 2;
