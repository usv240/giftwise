import { describe, expect, it } from "vitest";
import { shortId } from "@/lib/ops";

describe("the operations page shortens ids before they leave", () => {
  it("keeps the kind and the ends of the id", () => {
    expect(shortId("order:5AB12345XY678901K")).toBe("order:5AB1…01K");
    expect(shortId("household:12")).toBe("household:12");
    expect(shortId("render-task-run:abcdefgh")).toBe("render-task-run:abc…gh");
    expect(shortId("runner")).toBe("runner");
  });
});
