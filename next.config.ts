import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // scripts/build.mjs sets this so a build machine with many CPUs does not start one worker per CPU.
  experimental: process.env.NEXT_BUILD_CPUS ? { cpus: Number(process.env.NEXT_BUILD_CPUS) } : undefined,
  turbopack: {
    // Bryntum's trial bundle stays out of the bundle; the page loads it as a script (scripts/vendor-bryntum.mjs).
    resolveAlias: { "@bryntum/calendar": "./src/components/calendar/bryntum-global.cjs" },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
