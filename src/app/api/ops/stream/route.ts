import { connection } from "next/server";
import { api } from "@/lib/api/handler";
import { log } from "@/lib/log";
import { feed } from "@/lib/ops";

/** GET /api/ops/stream: the same feed over server-sent events, one message every two seconds, for up to ten minutes. Public. */
async function getRoute(req: Request) {
  await connection();
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let last = "";
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const tick = async () => {
        try {
          const json = JSON.stringify(await feed());
          if (json === last) {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
            return;
          }
          last = json;
          controller.enqueue(encoder.encode(`event: feed\ndata: ${json}\n\n`));
        } catch (err) {
          log.warn("ops stream tick failed", { err });
        }
      };
      await tick();
      timer = setInterval(tick, 2000);
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", stop);
      setTimeout(stop, 10 * 60_000);
    },
    cancel() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive" } });
}

export const GET = api("/api/ops/stream", getRoute);
