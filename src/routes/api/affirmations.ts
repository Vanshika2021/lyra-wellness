import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Lyra, a warm voice companion for women navigating PMDD. Given a short voice transcript and a mood reading (distress, arousal, valence 0-1), write 2 short, first-person affirmations the speaker can say to herself.

Rules:
- Each affirmation MUST reflect specific words, feelings, or themes from the transcript — never generic.
- 8 to 16 words. First person ("I…"). Present tense. Soft, embodied, non-toxic-positivity.
- No platitudes like "everything happens for a reason". No instructions ("breathe", "remember"). Just gentle self-statements.
- Match the emotional weather: if distress is high, lean tender + permission; if arousal is high, lean steadying; if valence is low, lean compassionate.
- Return ONLY JSON: {"affirmations": ["…", "…"]}`;

export const Route = createFileRoute("/api/affirmations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const aiKey = process.env.LOVABLE_API_KEY;
        if (!aiKey) {
          return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        const body = (await request.json().catch(() => ({}))) as {
          transcript?: string;
          state?: { distress?: number; arousal?: number; valence?: number };
        };
        const transcript = (body.transcript ?? "").trim();
        if (!transcript) {
          return new Response(JSON.stringify({ error: "Empty transcript" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }
        const s = body.state ?? {};
        const userMsg = `Transcript: "${transcript}"
Mood — distress: ${(s.distress ?? 0.5).toFixed(2)}, arousal: ${(s.arousal ?? 0.5).toFixed(2)}, valence: ${(s.valence ?? 0.5).toFixed(2)}.
Write the 2 affirmations now.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": aiKey },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMsg },
            ],
            response_format: { type: "json_object" },
            temperature: 0.9,
            max_tokens: 300,
          }),
        });
        if (!aiRes.ok) {
          const t = await aiRes.text().catch(() => "");
          return new Response(JSON.stringify({ error: `AI failed: ${aiRes.status} ${t}` }), {
            status: 502, headers: { "Content-Type": "application/json" },
          });
        }
        const json = await aiRes.json();
        const content = json?.choices?.[0]?.message?.content ?? "{}";
        let parsed: { affirmations?: string[] } = {};
        try { parsed = JSON.parse(content); } catch { /* fallback */ }
        const affs = Array.isArray(parsed.affirmations)
          ? parsed.affirmations.filter((x: unknown) => typeof x === "string" && x.trim().length).slice(0, 2)
          : [];
        if (affs.length < 2) {
          return new Response(JSON.stringify({ error: "AI returned no affirmations" }), {
            status: 502, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ affirmations: affs }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
