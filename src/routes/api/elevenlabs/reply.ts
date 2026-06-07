import { createFileRoute } from "@tanstack/react-router";

const VOICE_ID = "XrExE9yKIg1WjnnlVkGX"; // Matilda — warm, gentle

export const Route = createFileRoute("/api/elevenlabs/reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const elKey = process.env.ELEVENLABS_API_KEY;
        const aiKey = process.env.LOVABLE_API_KEY;
        if (!elKey || !aiKey) {
          return new Response(
            JSON.stringify({ error: "Missing ELEVENLABS_API_KEY or LOVABLE_API_KEY" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const { transcript, vocalMood, distress, arousal } = (await request.json()) as {
          transcript?: string;
          vocalMood?: string;
          distress?: number;
          arousal?: number;
        };
        const userText = (transcript ?? "").trim();
        if (!userText) {
          return new Response(JSON.stringify({ error: "Empty transcript" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const moodLine = vocalMood
          ? `\n\nHer voice this moment — ${vocalMood}${
              typeof distress === "number" && typeof arousal === "number"
                ? ` (inner-weather ~${distress.toFixed(2)}, energy ~${arousal.toFixed(2)} on 0–1)`
                : ""
            }. Mirror this *how*, not just the words. If her voice is small, soft, or hesitant, slow down and become quieter with her. If it's fast or charged, meet the heat gently before easing it. If it's flat or monotone, name the heaviness with tenderness.`
          : "";

        // 1) Generate a gentle reflection with Lovable AI Gateway
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": aiKey,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "You are Lyra, a warm, embodied companion for women navigating PMDD. Respond in 2–3 short sentences. Be tender, validating, grounded — never clinical or prescriptive. Use 'you' and speak directly. No lists, no advice unless gently invited. Mirror their feeling first — and crucially match the *texture* of their voice (pace, weight, energy), not only the words." +
                  moodLine,
              },
              { role: "user", content: userText },
            ],
            temperature: 0.8,
            max_tokens: 180,
          }),
        });

        if (!aiRes.ok) {
          const err = await aiRes.text();
          return new Response(JSON.stringify({ error: `AI failed: ${err}` }), {
            status: aiRes.status,
            headers: { "Content-Type": "application/json" },
          });
        }
        const aiJson = await aiRes.json();
        const replyText: string =
          aiJson?.choices?.[0]?.message?.content?.trim() ??
          "I hear you. Take a slow breath with me — you don't have to carry this alone.";

        // 2) Synthesize with ElevenLabs
        const ttsRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": elKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: replyText,
              model_id: "eleven_multilingual_v2",
              voice_settings: tuneVoice(distress, arousal),

            }),
          }
        );

        if (!ttsRes.ok) {
          const err = await ttsRes.text();
          return new Response(JSON.stringify({ error: `TTS failed: ${err}` }), {
            status: ttsRes.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const audioBuf = await ttsRes.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuf).toString("base64");

        return Response.json({ reply: replyText, audio_base64: audioBase64 });
      },
    },
  },
});
