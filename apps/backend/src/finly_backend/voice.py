"""Voice TTS via ElevenLabs HTTP API and STT via OpenAI Whisper (no SDK dependency)."""

from __future__ import annotations

import logging
import os
import tempfile

import httpx

logger = logging.getLogger(__name__)

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel
ELEVENLABS_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"


async def text_to_speech(text: str) -> bytes | None:
    """Convert text to speech audio bytes. Returns None if API key not set."""
    api_key = os.getenv("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY)
    if not api_key:
        return None

    voice_id = os.getenv("ELEVENLABS_VOICE_ID", ELEVENLABS_VOICE_ID)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                headers={
                    "xi-api-key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text[:5000],  # ElevenLabs limit
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
            )
            if resp.status_code == 200:
                return resp.content
            logger.warning(
                "ElevenLabs TTS failed: status=%d body=%s", resp.status_code, resp.text[:200]
            )
            return None
    except httpx.TimeoutException:
        logger.warning("ElevenLabs TTS timeout")
        return None
    except httpx.HTTPError as e:
        logger.warning("ElevenLabs TTS transport error: %s", e)
        return None
    except Exception as e:
        logger.exception("Unexpected ElevenLabs TTS error: %s", e)
        return None


async def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/m4a") -> str | None:
    """Transcribe audio bytes to text using OpenAI Whisper API.

    Returns transcribed text or None if API key not set or transcription fails.
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — cannot transcribe audio")
        return None

    # Map content type to file extension for Whisper
    ext_map = {
        "audio/m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/webm": "webm",
        "audio/ogg": "ogg",
    }
    ext = ext_map.get(content_type, "m4a")

    try:
        # Write to temp file (Whisper API needs a file upload)
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        async with httpx.AsyncClient(timeout=30.0) as client:
            with open(tmp_path, "rb") as f:
                resp = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": (f"audio.{ext}", f, content_type)},
                    data={"model": "whisper-1"},
                )

        # Clean up temp file
        os.unlink(tmp_path)

        if resp.status_code == 200:
            text = resp.json().get("text", "").strip()
            logger.info("Whisper transcription: %s", text[:100])
            return text if text else None

        logger.warning("Whisper STT failed: status=%d body=%s", resp.status_code, resp.text[:200])
        return None

    except Exception as e:
        logger.error("Whisper transcription error: %s", e)
        return None
