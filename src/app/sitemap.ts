import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { pageOrigin } from "@/lib/origin";
import { PUBLIC_PAGES } from "@/lib/site-pages";

/** /sitemap.xml: the public pages and the sample household's pages, at the address visitors use. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const origin = await pageOrigin();
  return PUBLIC_PAGES.map((path) => ({ url: path === "/" ? origin : `${origin}${path}` }));
}
