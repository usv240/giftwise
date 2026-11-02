import type { AgAiEvent, AgLlmAdapter, AgLlmRequest, AgLlmResponse } from "ag-studio";

/**
 * AG Studio's LLM adapter, backed by Claude through /api/studio-ai. The browser sends each turn to the server, which
 * holds the API key, and reads the streamed events back. AG Studio ships no Claude adapter; this is ours.
 */
export function claudeAdapter(endpoint = "/api/studio-ai"): AgLlmAdapter {
  return {
    executeTurn(request: AgLlmRequest, options?: { signal?: AbortSignal }) {
      let resolve!: (r: AgLlmResponse) => void;
      let reject!: (e: Error) => void;
      const complete = new Promise<AgLlmResponse>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // A consumer that stops reading early never awaits `complete`; mark the rejection seen so it is not reported twice.
      void complete.catch(() => {});

      async function* events(): AsyncGenerator<AgAiEvent> {
        let response: AgLlmResponse | undefined;
        let failure: Error | undefined;
        try {
          const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal: options?.signal });
          if (!res.ok || !res.body) {
            const j = await res.json().catch(() => null);
            throw new Error(j?.error?.message ?? `The assistant is unavailable (${res.status}).`);
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              const msg = JSON.parse(line) as { event?: AgAiEvent; complete?: AgLlmResponse; error?: string };
              if (msg.event) yield msg.event;
              if (msg.complete) response = msg.complete;
              if (msg.error) failure = new Error(msg.error);
            }
          }
        } catch (e) {
          failure = e instanceof Error ? e : new Error(String(e));
        }
        if (failure) reject(failure);
        else if (response) resolve(response);
        else reject(new Error("The assistant's reply ended early."));
      }

      const it = events();
      return { stream: { [Symbol.asyncIterator]: () => it }, complete };
    },
  };
}
