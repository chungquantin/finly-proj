"""Voice TTS via ElevenLabs HTTP API (no SDK dependency)."""

from __future__ import annotations

import os

import httpx

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
        return None
