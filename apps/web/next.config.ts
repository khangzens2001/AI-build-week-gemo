import path from "node:path";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable the service worker in dev to avoid caching headaches while building.
  disable: process.env.NODE_ENV === "development",
  // Do NOT precache session covers / venue images. On the VM these are served by
  // host nginx from a volume the crawl loop refreshes; a build-time precache entry
  // (with a frozen revision hash) would shadow nginx and serve a stale/missing
  // cover forever. Serwist injects public/ files as additionalPrecacheEntries
  // (which bypass manifestTransforms) and glob v10 ignores "!negation" in the
  // pattern array — so the only reliable lever is an ALLOWLIST of public subtrees
  // that omits covers/ and venues/. Those then go through runtime
  // StaleWhileRevalidate instead, so newly-crawled covers appear without a rebuild.
  // EXCEPTION: covers/session-fallback.png IS precached — the static offline
  // safety-net SessionCard renders when a cover is missing (never crawled), so it
  // must work offline / cold-cache.
  // NOTE: a NEW top-level public asset must be added here to be precached.
  globPublicPatterns: [
    "brand/**",
    "icons/**",
    "*.png",
    "*.svg",
    "*.ico",
    "*.webmanifest",
    "*.json",
    "*.txt",
    "covers/session-fallback.png",
  ],
});

const nextConfig: NextConfig = {
  // Self-contained server bundle for VM/container deploy (Podman). Emits
  // `.next/standalone/apps/web/server.js` (nested under the monorepo path).
  output: "standalone",
  // MUST point at the monorepo root so file tracing includes the hoisted
  // workspace dep `@event/core`; without it the standalone server crashes at
  // boot with "Cannot find module" for the transpiled package.
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  // packages/core is shipped as TS source and transpiled by Next.
  transpilePackages: ["@event/core"],
  // chromadb does a dynamic require of an optional default embedder we never use
  // (we BYO embeddings + pass a no-op embedding function). Keep it external so
  // it's resolved at runtime from node_modules rather than bundled by webpack.
  // NOTE: because it's external + dynamic-require + lives in bun's symlink store,
  // Next's file tracer can't pull it into the standalone bundle. The deploy
  // packaging step copies the resolved `chromadb` (+ `semver`) into
  // `.next/standalone/node_modules/` (see scripts/package-standalone.sh).
  serverExternalPackages: ["chromadb"],
  experimental: {
    // Allow importing the bundled seed snapshot JSON from outside apps/web.
    externalDir: true,
  },
  // Silence the one known cosmetic warning from chromadb's optional dynamic
  // require of `@chroma-core/default-embed` (never reached — see vector.ts).
  webpack(config) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { message: /@chroma-core\/default-embed/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },
};

export default withSerwist(nextConfig);
