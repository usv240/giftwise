import { describe, expect, it } from "vitest";
import sources from "../content/sources.json";
import { OPTIONS, shownUrl } from "@/components/evidence/Compare";

const SRC = sources as Record<string, { url: string; read?: string }>;

/** Every row on /evidence/impact#compare shows each source's address and the day it was read, from content/sources.json. */
describe("the comparison rows", () => {
  it("every row names at least one source, each with an https address and a read date", () => {
    expect(OPTIONS.length).toBeGreaterThanOrEqual(10);
    for (const o of OPTIONS) {
      expect(o.src.length, o.slug).toBeGreaterThan(0);
      for (const [id] of o.src) {
        const s = SRC[id];
        expect(s, `${o.slug}: ${id}`).toBeDefined();
        expect(s.url, `${o.slug}: ${id}`).toMatch(/^https:\/\//);
        expect(s.read, `${o.slug}: ${id}`).toMatch(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d\d$/);
        expect(shownUrl(s.url)).not.toMatch(/^https?:/);
      }
    }
  });
});
