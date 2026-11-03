import { describe, expect, it } from "vitest";
import content from "../content/real-world.json";
import sources from "../content/sources.json";

const SRC = sources as Record<string, { title: string; url: string; publisher: string }>;

describe("How this works for real", () => {
  it("cites a known source for every answer", () => {
    for (const it of content.items) {
      expect(it.sources.length, it.id).toBeGreaterThan(0);
      for (const k of it.sources) {
        expect(SRC[k], `${it.id} cites ${k}`).toBeDefined();
        expect(SRC[k].url).toMatch(/^https:\/\//);
      }
    }
  });

  it("keeps ids unique and the copy free of em dashes", () => {
    const ids = content.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(content)).not.toMatch(new RegExp(String.fromCharCode(0x2014)));
  });
});
