import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT =
  "You are a mental health screening assistant. Based on this free-form voice transcript, infer PHQ-9 scores for each of the 9 domains where possible: little interest or pleasure, feeling down or hopeless, sleep problems, low energy, appetite problems, feeling bad about yourself, concentration problems, moving slowly or restlessness, thoughts of self-harm. Score each 0-3 based on language cues. Return only JSON: {total: number, severity: string, domains: [{question: string, score: number, cue: string}], caveat: string}";

const CRISIS_PATTERNS = [
  /\bkill myself\b/i,
  /\bsuicide\b/i,
  /\bsuicidal\b/i,
  /\bend (it|my life)\b/i,
  /\bself[- ]harm\b/i,
  /\bhurt myself\b/i,
  /\bdon'?t want to (live|be here|wake up)\b/i,
  /\bwant to die\b/i,
  /\bno reason to live\b/i,
];

function detectCrisis(text: string) {
  return CRISIS_PATTERNS.some((r) => r.test(text));
}

export const Route = createFileRoute("/api/screen/phq9")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const aiKey = process.env.LOVABLE_API_KEY;
        if (!aiKey) {
          return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { transcript } = (await request.json()) as { transcript?: string };
        const text = (transcript ?? "").trim();
        if (!text) {
          return new Response(JSON.stringify({ error: "Empty transcript" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const crisis = detectCrisis(text);

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": aiKey,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: text },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (!aiRes.ok) {
          const err = await aiRes.text();
          return new Response(JSON.stringify({ error: `Screening failed: ${err}`, crisis }), {
            status: aiRes.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const aiJson = await aiRes.json();
        const raw: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
        let parsed: any = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) {
            try { parsed = JSON.parse(m[0]); } catch { parsed = {}; }
          }
        }

        return Response.json({ screening: parsed, crisis });
      },
    },
  },
});
