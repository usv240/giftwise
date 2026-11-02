import type Anthropic from "@anthropic-ai/sdk";
import type { AgAiConversationItem, AgAiEvent, AgAiOutputItem, AgLlmRequest, AgLlmResponse } from "ag-studio";

/**
 * AG Studio's provider-neutral turn format, translated to Claude's Messages API and back.
 * AG Studio ships no Claude adapter; this is ours. Thinking is off (Haiku 5.5 allows it), so no thinking block ever
 * has to survive Studio's own copy of the conversation.
 */
export const STUDIO_MODEL = "claude-haiku-5-5";

const SAFE_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
/** Claude tool names allow letters, digits, "_" and "-"; Studio's names are mapped both ways. */
export function toolNames(request: AgLlmRequest) {
  const toClaude = new Map<string, string>();
  const toStudio = new Map<string, string>();
  for (const t of request.tools ?? []) {
    let safe = SAFE_NAME.test(t.name) ? t.name : t.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    while (toStudio.has(safe) && toStudio.get(safe) !== t.name) safe = `${safe.slice(0, 58)}_${toStudio.size}`;
    toClaude.set(t.name, safe);
    toStudio.set(safe, t.name);
  }
  return { toClaude: (n: string) => toClaude.get(n) ?? n.replace(/[^a-zA-Z0-9_-]/g, "_"), toStudio: (n: string) => toStudio.get(n) ?? n };
}

type Block = Anthropic.ContentBlockParam;
type Names = ReturnType<typeof toolNames>;

const parseArgs = (s: string) => {
  try {
    const v = JSON.parse(s || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : { value: v };
  } catch {
    return {};
  }
};

/** Studio's conversation items become alternating user and assistant messages; system input joins the system prompt. */
export function toMessages(items: AgAiConversationItem[], names: Names) {
  const system: string[] = [];
  const messages: Anthropic.MessageParam[] = [];
  const push = (role: "user" | "assistant", block: Block) => {
    const last = messages.at(-1);
    if (last?.role === role) (last.content as Block[]).push(block);
    else messages.push({ role, content: [block] });
  };
  for (const item of items) {
    if (item.type === "message" && item.kind === "input") {
      const text = item.content.map((c) => (c.type === "text" ? c.text : c.type === "file" ? `[file ${c.filename ?? ""}]` : "[image]")).join("\n");
      if (item.role === "system") system.push(text);
      else if (text.trim()) push("user", { type: "text", text });
    } else if (item.type === "message" && item.kind === "output") {
      const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("\n");
      if (text.trim()) push("assistant", { type: "text", text });
    } else if (item.type === "function_call") {
      push("assistant", { type: "tool_use", id: item.callId, name: names.toClaude(item.name), input: parseArgs(item.arguments) });
    } else if (item.type === "function_call_output") {
      push("user", { type: "tool_result", tool_use_id: item.callId, content: item.output || "(no output)" });
    }
    // Reasoning items are skipped: thinking is off, and summaries carry nothing Claude needs back.
  }
  if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: [{ type: "text", text: "Continue." }] });
  return { system: system.join("\n\n"), messages };
}

export function toParams(request: AgLlmRequest, names: Names, withFormat = true): Anthropic.MessageCreateParamsNonStreaming {
  const { system, messages } = toMessages(request.input, names);
  const json = request.responseFormat?.type === "json" ? request.responseFormat : null;
  const choice = request.toolChoice;
  const tools = (request.tools ?? []).map((t) => ({ name: names.toClaude(t.name), description: t.description.slice(0, 4000), input_schema: t.parameters as Anthropic.Tool.InputSchema }));
  return {
    model: STUDIO_MODEL,
    max_tokens: 8000,
    thinking: { type: "disabled" },
    system: [request.instructions, system, json && !withFormat ? `Reply with only a JSON object that matches this JSON schema:\n${JSON.stringify(json.schema)}` : ""].filter(Boolean).join("\n\n") || undefined,
    messages,
    ...(tools.length ? { tools } : {}),
    ...(tools.length && choice
      ? { tool_choice: choice === "auto" ? { type: "auto" } : choice === "none" ? { type: "none" } : choice === "required" ? { type: "any" } : { type: "tool", name: names.toClaude(choice.name) } }
      : {}),
    output_config: { effort: "medium", ...(json && withFormat ? { format: { type: "json_schema", schema: json.schema as Record<string, unknown> } } : {}) },
  };
}

/** Claude's streamed events, as the events Studio reads, plus the finished turn. */
export async function* toStudioEvents(stream: AsyncIterable<Anthropic.MessageStreamEvent>, final: () => Promise<Anthropic.Message>, names: Names): AsyncGenerator<{ event?: AgAiEvent; complete?: AgLlmResponse }> {
  let messageId = "msg";
  const open = new Map<number, { kind: "text" | "tool"; id: string }>();
  for await (const ev of stream) {
    if (ev.type === "message_start") messageId = ev.message.id;
    else if (ev.type === "content_block_start") {
      const b = ev.content_block;
      if (b.type === "text") {
        const id = `${messageId}_${ev.index}`;
        open.set(ev.index, { kind: "text", id });
        yield { event: { type: "TEXT_MESSAGE_START", messageId: id, role: "assistant" } };
        if (b.text) yield { event: { type: "TEXT_MESSAGE_CONTENT", messageId: id, delta: b.text } };
      } else if (b.type === "tool_use") {
        open.set(ev.index, { kind: "tool", id: b.id });
        yield { event: { type: "TOOL_CALL_START", toolCallId: b.id, toolCallName: names.toStudio(b.name) } };
      }
    } else if (ev.type === "content_block_delta") {
      const o = open.get(ev.index);
      if (o?.kind === "text" && ev.delta.type === "text_delta") yield { event: { type: "TEXT_MESSAGE_CONTENT", messageId: o.id, delta: ev.delta.text } };
      if (o?.kind === "tool" && ev.delta.type === "input_json_delta" && ev.delta.partial_json) yield { event: { type: "TOOL_CALL_ARGS", toolCallId: o.id, delta: ev.delta.partial_json } };
    } else if (ev.type === "content_block_stop") {
      const o = open.get(ev.index);
      if (o?.kind === "text") yield { event: { type: "TEXT_MESSAGE_END", messageId: o.id } };
      if (o?.kind === "tool") yield { event: { type: "TOOL_CALL_END", toolCallId: o.id } };
    }
  }
  const m = await final();
  const output: AgAiOutputItem[] = [];
  m.content.forEach((b, i) => {
    if (b.type === "text" && b.text) output.push({ id: `${m.id}_${i}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: b.text, annotations: [] }] });
    if (b.type === "tool_use") output.push({ id: b.id, kind: "output", type: "function_call", callId: b.id, name: names.toStudio(b.name), arguments: JSON.stringify(b.input ?? {}), status: "completed" });
  });
  const incomplete = m.stop_reason === "max_tokens";
  yield {
    complete: {
      id: m.id,
      createdAt: Math.floor(Date.now() / 1000),
      model: m.model,
      status: incomplete ? "incomplete" : "completed",
      ...(incomplete ? { incompleteDetails: { reason: "max_output_tokens" as const } } : {}),
      output,
      usage: { inputTokens: m.usage.input_tokens, outputTokens: m.usage.output_tokens, totalTokens: m.usage.input_tokens + m.usage.output_tokens, cachedInputTokens: m.usage.cache_read_input_tokens ?? undefined },
    },
  };
}
