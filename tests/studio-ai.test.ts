import type { AgAiConversationItem, AgLlmRequest } from "ag-studio";
import { describe, expect, it } from "vitest";
import { STUDIO_MODEL, toMessages, toParams, toolNames } from "@/lib/studio-ai/translate";

const user = (text: string, role: "user" | "system" = "user"): AgAiConversationItem => ({ id: `u-${text}`, kind: "input", type: "message", role, status: "completed", content: [{ type: "text", text }] });
const said = (text: string): AgAiConversationItem => ({ id: `a-${text}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text, annotations: [] }] });
const call = (callId: string, name: string, args: object): AgAiConversationItem => ({ id: callId, kind: "output", type: "function_call", callId, name, arguments: JSON.stringify(args), status: "completed" });
const result = (callId: string, output: string): AgAiConversationItem => ({ type: "function_call_output", callId, output, status: "completed" });

const req = (over: Partial<AgLlmRequest>): AgLlmRequest => ({ input: [user("Hi")], responseFormat: { type: "text" }, ...over });

describe("toolNames", () => {
  it("keeps names Claude accepts and maps the rest both ways", () => {
    const n = toolNames(req({ tools: [{ name: "view_report", description: "", parameters: { type: "object" } }, { name: "studio.add widget", description: "", parameters: { type: "object" } }] }));
    expect(n.toClaude("view_report")).toBe("view_report");
    expect(n.toClaude("studio.add widget")).toBe("studio_add_widget");
    expect(n.toStudio("studio_add_widget")).toBe("studio.add widget");
  });
});

describe("toMessages", () => {
  it("alternates roles, puts a tool call and its result on the right sides, and lifts system input to the system prompt", () => {
    const n = toolNames(req({ tools: [{ name: "view_report", description: "", parameters: { type: "object" } }] }));
    const { system, messages } = toMessages([user("Be brief.", "system"), user("What changed?"), said("Let me look."), call("c1", "view_report", { page: "year" }), result("c1", "8 widgets"), said("Eight widgets.")], n);
    expect(system).toBe("Be brief.");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(messages[1].content).toEqual([
      { type: "text", text: "Let me look." },
      { type: "tool_use", id: "c1", name: "view_report", input: { page: "year" } },
    ]);
    expect(messages[2].content).toEqual([{ type: "tool_result", tool_use_id: "c1", content: "8 widgets" }]);
  });
  it("starts with a user message even when the history does not", () => {
    expect(toMessages([said("Hello")], toolNames(req({}))).messages[0].role).toBe("user");
  });
});

describe("toParams", () => {
  it("uses Haiku with thinking off, maps a required tool choice, and passes a JSON response format", () => {
    const r = req({ instructions: "You build dashboards.", tools: [{ name: "add_widget", description: "Add one.", parameters: { type: "object", properties: {} } }], toolChoice: "required", responseFormat: { type: "json", name: "plan", schema: { type: "object" } } });
    const p = toParams(r, toolNames(r));
    expect(p.model).toBe(STUDIO_MODEL);
    expect(p.thinking).toEqual({ type: "disabled" });
    expect(p.tool_choice).toEqual({ type: "any" });
    expect(p.output_config?.format).toEqual({ type: "json_schema", schema: { type: "object" } });
    expect(p.system).toBe("You build dashboards.");
  });
  it("falls back to asking for JSON in the instructions when the schema cannot be sent as a format", () => {
    const r = req({ responseFormat: { type: "json", name: "plan", schema: { type: "object" } } });
    const p = toParams(r, toolNames(r), false);
    expect(p.output_config?.format).toBeUndefined();
    expect(p.system).toMatch(/Reply with only a JSON object/);
  });
});
