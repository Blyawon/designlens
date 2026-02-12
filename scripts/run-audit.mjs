#!/usr/bin/env node
/**
 * One-off: POST to local /api/audit, consume SSE, print summary when complete.
 * Usage: node scripts/run-audit.mjs <url>
 */
const url = process.argv[2] || "https://www.play.pl/";

async function run() {
  const res = await fetch("http://localhost:3000/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    console.error("API error:", res.status, await res.text());
    process.exit(1);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const msg = JSON.parse(line.slice(6));
          if (msg.type === "progress") {
            process.stderr.write(`  ${msg.phase || msg.message || ""}\n`);
          } else if (msg.type === "complete") {
            summarize(msg.data);
            return;
          } else if (msg.type === "error") {
            console.error("Error:", msg.message);
            process.exit(1);
          }
        } catch (_) {}
      }
    }
  }
  console.error("Stream ended without complete event");
  process.exit(1);
}

function summarize(data) {
  const t = data?.typeSprawl || {};
  const c = data?.colorSprawl || {};
  const s = data?.spacingSprawl || {};
  const scores = data?.scores || {};
  console.log("\n--- Play.pl audit summary ---\n");
  console.log("Typography");
  console.log("  Font families:", (t.fontFamilies || []).map((f) => f.value).join(", ") || "(none)");
  console.log("  Font sizes (top 12):", (t.fontSizes || []).slice(0, 12).map((f) => f.value).join(", ") || "(none)");
  console.log("  Font weights:", (t.fontWeights || []).map((w) => w.value).join(", ") || "(none)");
  console.log("\nColors");
  console.log("  Unique colors:", c.uniqueCount ?? "—");
  console.log("  Near-duplicates:", (c.nearDuplicates || []).length);
  console.log("\nSpacing");
  console.log("  Base grid:", s.detectedBase ?? "—");
  console.log("  Adherence:", s.adherence != null ? s.adherence + "%" : "—");
  console.log("\nScores (confidence)", scores.confidence ?? "—");
  console.log("\nFont faces (count):", (data?.fontFaces || []).length);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
