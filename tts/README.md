# reader-tts

Tiny HTTP wrapper around hosted TTS for the Reader's "Listen" (read-aloud)
button — the Cloudflare Worker can't speak gRPC, so it proxies `POST /api/tts`
here. Two backends, routed per request:

- **NVIDIA Magpie TTS Multilingual** (free-tier NIM, gRPC at
  `grpc.nvcf.nvidia.com:443`) → `audio/wav` — the default.
- **OpenAI `gpt-4o-mini-tts`** → `audio/mpeg` — when the text looks
  Scandinavian (æ/ø/å or a Norwegian-stopword ratio ≥ 0.15) or
  `language_code` is `no/nb/nn/da/sv`. Magpie has no Scandinavian languages.
  Costs ~$0.015/min of audio; without `OPENAI_API_KEY` everything falls back
  to Magpie.

**Sleeper-only** (like the collectors in `scripts/`). Runs under PM2 as
`reader-tts` on port **3015**, proxied at `sleeper.phareim.no/reader-tts/`.

## API

- `GET /health` — open; `{ok, service, uptime_ms, synth_count, default_voice,
  norwegian_backend}`
- `POST /synthesize` — Bearer `READER_TTS_KEY`; body
  `{text (≤3000 chars), voice?, language_code?}` → `audio/wav` (Magpie,
  LINEAR_PCM 22050 Hz mono) or `audio/mpeg` (OpenAI) — read the response
  Content-Type

## Setup

```bash
cd ~/github/reader/tts
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt

# Env (never in the repo):
cat > ~/.config/reader-tts/env <<EOF
NVIDIA_API_KEY=nvapi-...
READER_TTS_KEY=$(openssl rand -hex 32)
OPENAI_API_KEY=sk-...          # optional: Norwegian/Scandinavian voice
# OPENAI_TTS_MODEL=gpt-4o-mini-tts
# OPENAI_TTS_VOICE=nova
EOF
chmod 600 ~/.config/reader-tts/env

pm2 start ./.venv/bin/python --name reader-tts -- server.py
pm2 save
```

The same `READER_TTS_KEY` value goes into the Reader Worker as the
`NUXT_TTS_API_KEY` secret (`npx wrangler secret put NUXT_TTS_API_KEY`).

## Notes

- Free-tier NIM: ~40 RPM, and NVIDIA can EOL hosted models (410) — if voice
  breaks, check `pm2 logs reader-tts` and the model page on build.nvidia.com.
- Default voice `Magpie-Multilingual.EN-US.Aria`; the model speaks 9 languages
  (no Norwegian — hence the OpenAI route).
- ä/ö deliberately do NOT trigger the Scandinavian route: they'd misroute
  German, which Magpie speaks natively. Swedish detection therefore rests on
  å and explicit `language_code=sv`.
