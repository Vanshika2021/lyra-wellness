import { createFileRoute } from "@tanstack/react-router";

// Creates an Instant Voice Clone from the user's recording and returns the voice_id.
// The cloned voice can then be passed to /api/elevenlabs/tts so AI replies sound
// like the user themselves.
export const Route = createFileRoute("/api/elevenlabs/clone")({
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
        outForm.append("name", `tribe-user-${Date.now()}`);
        outForm.append(
          "description",
          "Ephemeral clone for personalized affirmation playback.",
        );
        outForm.append("remove_background_noise", "true");
        outForm.append("files", file, "sample.webm");

        const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: outForm,
        });

        if (!res.ok) {
          const err = await res.text();
          return new Response(
            JSON.stringify({ error: err || `Clone failed: ${res.status}` }),
            { status: res.status, headers: { "Content-Type": "application/json" } },
          );
        }

        const data = (await res.json()) as { voice_id?: string };
        if (!data.voice_id) {
          return new Response(JSON.stringify({ error: "No voice_id returned" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return Response.json({ voiceId: data.voice_id });
      },
    },
  },
});
