"""
groq_client.py — Groq API wrapper
Handles: LLM chat, Whisper STT, LLaVA vision
"""

import os
from groq import AsyncGroq

LLM_MODEL    = "llama-3.1-70b-versatile"
STT_MODEL    = "whisper-large-v3"
VISION_MODEL = "llava-v1.5-7b"


class GroqClient:
    def __init__(self):
        self.client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

    async def chat(self, system_prompt: str, user_message: str, max_tokens: int = 300) -> str:
        """Send a chat message to Groq 70B and return the reply text."""
        try:
            response = await self.client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system",    "content": system_prompt},
                    {"role": "user",      "content": user_message},
                ],
                max_tokens=max_tokens,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[Groq/chat] Error: {e}")
            return "I'm sorry, I'm having a little trouble right now. Please give me a moment."

    async def transcribe(self, audio_path: str) -> str:
        """Transcribe an audio file using Groq Whisper."""
        try:
            with open(audio_path, "rb") as f:
                response = await self.client.audio.transcriptions.create(
                    model=STT_MODEL,
                    file=f,
                    language="en",   # change or auto-detect for HI/MR
                )
            return response.text.strip()
        except Exception as e:
            print(f"[Groq/STT] Error: {e}")
            return ""

    async def describe_image(self, base64_image: str, caregiver_note: str = "") -> str:
        """
        Describe an image using Groq LLaVA.
        Returns a warm, patient-friendly description.
        """
        note_context = f" The caregiver says: {caregiver_note}" if caregiver_note else ""
        prompt = (
            f"Describe this photo in 2–3 warm, simple sentences suitable for an elderly person "
            f"with memory difficulties.{note_context} Focus on people, relationships, and emotions."
        )
        try:
            response = await self.client.chat.completions.create(
                model=VISION_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                        },
                        {"type": "text", "text": prompt},
                    ],
                }],
                max_tokens=200,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[Groq/vision] Error: {e}")
            return caregiver_note if caregiver_note else "A special family memory."
