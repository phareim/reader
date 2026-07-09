#!/usr/bin/env python3
"""reader-tts — tiny HTTP wrapper around NVIDIA's hosted Magpie TTS.

The Reader Worker (reader.phareim.no) can't speak gRPC, so this service sits
on Sleeper and translates: POST /synthesize {"text": ..., "voice"?: ...,
"language_code"?: ...} -> audio/wav (LINEAR_PCM mono). GET /health is open.

Auth: `Authorization: Bearer $READER_TTS_KEY`. Env is loaded from
~/.config/reader-tts/env with override semantics (the house convention —
never trust ambient shell globals). Requires NVIDIA_API_KEY + READER_TTS_KEY.

Runs under PM2 as `reader-tts` on port 3015, proxied at
sleeper.phareim.no/reader-tts/. Logs to stdout only.
"""
import hmac
import io
import os
import sys
import time
import wave

ENV_FILE = os.path.expanduser("~/.config/reader-tts/env")


def load_env() -> None:
    if not os.path.exists(ENV_FILE):
        return
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ[key.strip()] = value.strip().strip('"').strip("'")


load_env()

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
READER_TTS_KEY = os.environ.get("READER_TTS_KEY", "")
PORT = int(os.environ.get("PORT", "3015"))

# magpie-tts-multilingual on build.nvidia.com (NVIDIA Cloud Functions id)
FUNCTION_ID = "877104f7-e885-42b9-8de8-f6e4c6303969"
GRPC_URI = "grpc.nvcf.nvidia.com:443"
DEFAULT_VOICE = "Magpie-Multilingual.EN-US.Aria"
DEFAULT_LANGUAGE = "en-US"
SAMPLE_RATE_HZ = 22050
MAX_CHARS = 3000

if not NVIDIA_API_KEY or not READER_TTS_KEY:
    print(
        f"fatal: NVIDIA_API_KEY and READER_TTS_KEY must be set (in {ENV_FILE})",
        file=sys.stderr,
    )
    sys.exit(1)

import riva.client  # noqa: E402
from flask import Flask, jsonify, request  # noqa: E402

app = Flask(__name__)
started_at = time.time()
synth_count = 0
_service = None


def get_service(fresh: bool = False) -> "riva.client.SpeechSynthesisService":
    global _service
    if _service is None or fresh:
        auth = riva.client.Auth(
            uri=GRPC_URI,
            use_ssl=True,
            metadata_args=[
                ["function-id", FUNCTION_ID],
                ["authorization", f"Bearer {NVIDIA_API_KEY}"],
            ],
        )
        _service = riva.client.SpeechSynthesisService(auth)
    return _service


def authorized() -> bool:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return False
    return hmac.compare_digest(header[7:], READER_TTS_KEY)


def to_wav(pcm: bytes) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE_HZ)
        f.writeframes(pcm)
    return buf.getvalue()


@app.get("/health")
def health():
    return jsonify(
        ok=True,
        service="reader-tts",
        uptime_ms=int((time.time() - started_at) * 1000),
        synth_count=synth_count,
        default_voice=DEFAULT_VOICE,
    )


@app.post("/synthesize")
def synthesize():
    global synth_count
    if not authorized():
        return jsonify(error="unauthorized"), 401
    body = request.get_json(silent=True) or {}
    text = (body.get("text") or "").strip()
    if not text:
        return jsonify(error="text is required"), 400
    if len(text) > MAX_CHARS:
        return jsonify(error=f"text exceeds {MAX_CHARS} chars"), 413
    voice = body.get("voice") or DEFAULT_VOICE
    language = body.get("language_code") or DEFAULT_LANGUAGE

    t0 = time.time()
    try:
        resp = _synthesize(text, voice, language)
    except Exception as err:  # noqa: BLE001 — surface every upstream failure as 502
        print(f"synthesize failed: {err}", file=sys.stderr)
        return jsonify(error="synthesis failed"), 502
    synth_count += 1
    wav = to_wav(resp.audio)
    print(
        f"synthesized {len(text)} chars -> {len(wav)} bytes "
        f"in {time.time() - t0:.2f}s (voice={voice})"
    )
    return app.response_class(wav, mimetype="audio/wav")


def _synthesize(text: str, voice: str, language: str):
    # One retry on a fresh channel: NVCF idles out long-lived gRPC channels.
    try:
        return get_service().synthesize(
            text=text,
            voice_name=voice,
            language_code=language,
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
            sample_rate_hz=SAMPLE_RATE_HZ,
        )
    except Exception:
        return get_service(fresh=True).synthesize(
            text=text,
            voice_name=voice,
            language_code=language,
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
            sample_rate_hz=SAMPLE_RATE_HZ,
        )


if __name__ == "__main__":
    print(f"reader-tts listening on 127.0.0.1:{PORT} (voice={DEFAULT_VOICE})")
    app.run(host="127.0.0.1", port=PORT, threaded=True)
