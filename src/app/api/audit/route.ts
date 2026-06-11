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
import { hostIsBlocked } from "@/lib/ssrf";
import { normalizeError } from "@/lib/audit/errorMessages";

export const maxDuration = 120; // seconds — allows up to 3 retry attempts on crash

const MAX_BODY_BYTES = 4096;

/* ---- simple in-memory rate limiter ---- */

const hits = new Map<string, number[]>();
const LIMIT = 5;
const WINDOW = 60_000;
const MAX_TRACKED_IPS = 5000;

function rateOk(ip: string): boolean {
  const now = Date.now();

  /* Bound the Map: when too many distinct IPs accumulate on a warm
     container, sweep every key's stale timestamps in one pass. */
  if (hits.size > MAX_TRACKED_IPS) {
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < WINDOW);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }

  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (list.length >= LIMIT) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  return true;
}

function clientIp(req: NextRequest): string {
  /* On Vercel, x-forwarded-for is normalised by the platform; the
     first entry is the client. Strip any extra entries appended by
     intermediate proxies so one client can't rotate identities. */
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/* ---- handler ---- */

export async function POST(req: NextRequest) {
  if (!rateOk(clientIp(req))) {
    return Response.json(
      { error: "You've run too many audits in a short time. Wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: { url?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return Response.json({ error: "Request is too large." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "We couldn't read your request. Please try again." }, { status: 400 });
  }

  if (typeof body?.url !== "string" || !body.url) {
    return Response.json({ error: "Please enter a URL to analyse." }, { status: 400 });
  }

  const v = validateUrl(body.url);
  if (!v.valid) {
    return Response.json({ error: v.error }, { status: 400 });
  }

  /* DNS-level SSRF check: reject hostnames that resolve to private or
     special-purpose addresses (cloud metadata, internal services). */
  if (await hostIsBlocked(new URL(v.url!).hostname)) {
    return Response.json(
      { error: "That address points to an internal/private network. Enter a publicly accessible URL." },
      { status: 400 }
    );
  }

  /* ---- Create an AbortController that fires when the client disconnects.
     This is critical: without it, a user who closes the tab still leaves
     a Playwright browser running until timeout, wasting serverless $$. ---- */

  const abortController = new AbortController();

  /* Next.js provides req.signal which aborts when the client disconnects.
     Check the flag first — the abort event never fires for listeners added
     after the signal has already aborted. */
  if (req.signal) {
    if (req.signal.aborted) abortController.abort();
    else req.signal.addEventListener("abort", () => abortController.abort());
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
