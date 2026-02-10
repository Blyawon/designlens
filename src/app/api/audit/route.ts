/* ---------------------------------------------------------------
   POST /api/audit  — SSE-streamed design-system audit

   Performance notes:
   - Propagates AbortSignal to runAudit so Playwright is killed
     the moment the client disconnects (no orphaned browsers).
   - Rate limiter prevents abuse.
   --------------------------------------------------------------- */

import { NextRequest } from "next/server";
import { runAudit } from "@/lib/audit/runAudit";
import { validateUrl } from "@/lib/validateUrl";
import { saveReport } from "@/lib/store";
import { normalizeError } from "@/lib/audit/errorMessages";

export const maxDuration = 120; // seconds — allows up to 3 retry attempts on crash

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
      { error: "You've run too many audits in a short time. Wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "We couldn't read your request. Please try again." }, { status: 400 });
  }

  if (!body.url) {
    return Response.json({ error: "Please enter a URL to analyse." }, { status: 400 });
  }

  const v = validateUrl(body.url);
  if (!v.valid) {
    return Response.json({ error: v.error }, { status: 400 });
  }

  /* ---- Create an AbortController that fires when the client disconnects.
     This is critical: without it, a user who closes the tab still leaves
     a Playwright browser running until timeout, wasting serverless $$. ---- */

  const abortController = new AbortController();

  /* Next.js provides req.signal which aborts when the client disconnects */
  if (req.signal) {
    req.signal.addEventListener("abort", () => abortController.abort());
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
          /* stream already closed — trigger abort so audit stops */
          abortController.abort();
        }
      };

      try {
        const result = await runAudit(
          v.url!,
          (progress) => {
            send({ type: "progress", ...progress });
          },
          abortController.signal
        );

        await saveReport(result);
        send({ type: "complete", data: result });
      } catch (err: unknown) {
        /* Don't send error for intentional aborts */
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        send({ type: "error", message: normalizeError(err) });
      } finally {
        controller.close();
      }
    },
    cancel() {
      /* Called when the client disconnects from the SSE stream.
         This is the other half of cleanup — abort everything. */
      abortController.abort();
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
