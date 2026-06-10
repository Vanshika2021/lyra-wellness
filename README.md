# 🌙 Lyra

> *An acute-moment, voice-first sound-therapy companion for PMDD.*

**[🎬 Watch the Demo](https://lyra-calm-space.lovable.app)** &nbsp;|&nbsp; **[📊 View the Pitch Deck](https://www.canva.com/design/DAHL5VwlvTA/iw2Py1EPtyJl9Teobl87zQ/view?utm_content=DAHL5VwlvTA&utm_campaign=designshare&utm_medium=link&utm_source=viewer)**

---

## What It Does

You turn on your mic. You say how you're feeling. Lyra listens — and speaks back to you in **your own voice**.

- 🎤 **Voice In** — ElevenLabs Scribe v2 for real-time speech-to-text
- 🧠 **Neural Mood Map** — A 3-axis emotional state visualization (distress × arousal × valence), inspired by Meta's TRIBE v2
- 🔊 **Voice Out** — ElevenLabs Instant Voice Clone + Multilingual v2 TTS so the response sounds unmistakably like *you*
- 🎵 **Generative Healing Music** — Adaptive ambient tracks from ElevenLabs that breathe with you, responding to your distress level
- 🫁 **Breathwork Synced to HRV** — Paced breathing exercises that adapt to your emotional state in real time
- ✨ **AI-Curated Affirmations** — Grounded in PHQ-9 and GAD-7 screening logic, delivered gently in your cloned voice
- 🔔 **Crisis Alert** — Automatic escalation protocol when severe distress is detected

The music doesn't wait for the voice to finish — it **holds space underneath the entire session**, creating a seamless sonic environment.

---

## The Bet

**No typing. No scrolling. Just voice.**

We believe the moment someone needs support most is the moment they shouldn't have to navigate an interface. Lyra is designed for the acute emotional episodes that come with PMDD — when cognitive load is already high and gentle, embodied interaction matters most.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19 + Vite 7) |
| Voice STT | ElevenLabs Scribe v2 |
| Voice Clone + TTS | ElevenLabs Instant Voice Clone, Multilingual v2 |
| Generative Music | ElevenLabs Music API |
| AI Reflection | Lovable AI Gateway → Google Gemini 3 Flash |
| Audio Engine | Web Audio API |
| Styling | Tailwind CSS v4 |
| Rapid Prototyping | Lovable |

---

## API Routes

| Endpoint | Purpose |
|----------|---------|
| `/api/elevenlabs/stt` | Speech-to-text via ElevenLabs Scribe v2 |
| `/api/elevenlabs/clone` | Instant voice cloning from a short audio sample |
| `/api/elevenlabs/tts` | Text-to-speech in the cloned voice |
| `/api/elevenlabs/music` | Generative ambient music based on mood state |
| `/api/gemini/reflection` | AI reflection + affirmation generation |
| `/api/screening/phq9` | PHQ-9 depression screening |
| `/api/screening/gad7` | GAD-7 anxiety screening |
| `/api/crisis/alert` | Crisis detection + escalation alert |

---

## Run Locally

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Add your API keys:
# - VITE_ELEVENLABS_API_KEY
# - VITE_GEMINI_API_KEY

# 3. Start dev server
bun dev
```

---

## Team

Built with 💙 by **Petra**, **Vanshika**, **Sanjana**, and **Lauren** at the **GirlsIntoVC × Techstars London** hackathon.

Powered by **Meta AI**, **ElevenLabs**, and **Lovable**.

---

## Disclaimer

Lyra is a **wellness companion**, not a medical device. The Neural Mood Map is a heuristic visualization for self-awareness, not a clinical diagnostic tool. If you are experiencing a mental health crisis, please contact emergency services or a licensed mental health professional.

---

## License

MIT
