import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable the service worker in dev to avoid caching headaches while building.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // packages/core is shipped as TS source and transpiled by Next.
  transpilePackages: ["@event/core"],
  // chromadb does a dynamic require of an optional default embedder we never use
  // (we BYO embeddings + pass a no-op embedding function). Keep it external so
  // it's resolved at runtime from node_modules rather than bundled by webpack.
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
