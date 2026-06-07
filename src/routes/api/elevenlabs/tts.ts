import { createFileRoute } from "@tanstack/react-router";

// Sarah — warm, gentle female voice; good for affirmations.
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export const Route = createFileRoute("/api/elevenlabs/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "ElevenLabs not connected" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { text, voiceId } = (await request.json()) as { text?: string; voiceId?: string };
        const trimmed = (text ?? "").trim();
        if (!trimmed) {
          return new Response(JSON.stringify({ error: "Missing text" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const vid = voiceId || DEFAULT_VOICE_ID;
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: trimmed,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.6,
                similarity_boost: 0.75,
                style: 0.35,
                use_speaker_boost: true,
                speed: 0.92,
              },
            }),
          },
        );

        if (!res.ok) {
          const err = await res.text();
          return new Response(JSON.stringify({ error: err || `TTS failed: ${res.status}` }), {
            status: res.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const buf = await res.arrayBuffer();
        const audio_base64 = Buffer.from(buf).toString("base64");
        return Response.json({ audio_base64 });
      },
    },
  },
});
