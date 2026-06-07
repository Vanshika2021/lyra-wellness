import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/elevenlabs/stt")({
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

        const inForm = await request.formData();
        const file = inForm.get("audio");
        if (!(file instanceof Blob)) {
          return new Response(JSON.stringify({ error: "Missing audio file" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const outForm = new FormData();
        outForm.append("file", file, "recording.webm");
        outForm.append("model_id", "scribe_v2");
        outForm.append("tag_audio_events", "false");
        outForm.append("diarize", "false");

        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: outForm,
        });

        if (!res.ok) {
          const err = await res.text();
          return new Response(JSON.stringify({ error: err || `STT failed: ${res.status}` }), {
            status: res.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const data = await res.json();
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
