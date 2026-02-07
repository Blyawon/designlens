/* ---------------------------------------------------------------
   POST /api/audit  — SSE-streamed design-system audit
   --------------------------------------------------------------- */

import { NextRequest } from "next/server";
import { runAudit } from "@/lib/audit/runAudit";
import { validateUrl } from "@/lib/validateUrl";
import { saveReport } from "@/lib/store";

/* ---- simple in-memory rate limiter ---- */

const hits = new Map<string, number[]>();
const LIMIT = 5;
const WINDOW = 60_000;

function rateOk(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  hits.set(ip, list);
  if (list.length >= LIMIT) return false;
  list.push(now);
  return true;
}

/* ---- handler ---- */

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!rateOk(ip)) {
    return Response.json(
      { error: "Rate limit exceeded – try again in a minute." },
      { status: 429 }
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.url) {
    return Response.json({ error: "URL is required." }, { status: 400 });
  }

  const v = validateUrl(body.url);
  if (!v.valid) {
    return Response.json({ error: v.error }, { status: 400 });
  }

  /* ---- stream response via SSE ---- */

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(d)}\n\n`)
          );
        } catch {
          /* stream already closed */
        }
      };

      try {
        const result = await runAudit(v.url!, (progress) => {
          send({ type: "progress", ...progress });
        });

        await saveReport(result);
        send({ type: "complete", data: result });
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Unexpected error during audit.";
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
