import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { pageOrigin } from "@/lib/origin";
import { PRIVATE_PATHS } from "@/lib/site-pages";

/** /robots.txt: every public and sample page may be crawled; private links, receipts, the API and /ops may not. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const origin = await pageOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS.map((p) => p.path) },
    sitemap: `${origin}/sitemap.xml`,
  };
}
