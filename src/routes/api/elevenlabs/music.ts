import { createFileRoute } from "@tanstack/react-router";

function promptFor(distress: number): { prompt: string; bpm: number } {
  if (distress > 0.7) {
    return {
      prompt:
        "slow minor key ambient piano, heavy and melancholic, 60 BPM, gradually becoming warmer and calmer, no lyrics, therapeutic",
      bpm: 60,
    };
  }
  if (distress >= 0.4) {
    return {
      prompt:
        "gentle acoustic guitar, soft and reflective, 70 BPM, gradually brightening, no lyrics, calming",
      bpm: 70,
    };
  }
  return {
    prompt: "soft uplifting ambient, warm and peaceful, 80 BPM, no lyrics, soothing",
    bpm: 80,
  };
}

export const Route = createFileRoute("/api/elevenlabs/music")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const elKey = process.env.ELEVENLABS_API_KEY;
        if (!elKey) {
          return new Response(JSON.stringify({ error: "Missing ELEVENLABS_API_KEY" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { distress } = (await request.json()) as { distress?: number };
        const d = typeof distress === "number" ? Math.max(0, Math.min(1, distress)) : 0.5;
        const { prompt, bpm } = promptFor(d);

        const res = await fetch("https://api.elevenlabs.io/v1/music", {
          method: "POST",
          headers: {
            "xi-api-key": elKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            music_length_ms: 30000,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return new Response(JSON.stringify({ error: `Music failed: ${err}` }), {
            status: res.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const buf = await res.arrayBuffer();
        const audio_base64 = Buffer.from(buf).toString("base64");
        return Response.json({ audio_base64, bpm, prompt });
      },
    },
  },
});
