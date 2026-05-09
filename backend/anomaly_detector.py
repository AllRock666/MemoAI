"""
anomaly_detector.py — Cognitive Anomaly Detection for Alzheimer's Patients

Two-pass approach:
  1. Fast heuristic pass (pattern matching + confusion signal count)
  2. Groq 70B deep pass for nuanced analysis and caregiver summary

Score: 1–10
  8–10: Oriented, calm, conversational
   5–7: Mild confusion, some disorientation — monitor
   3–4: Moderate distress or confusion — consider checking in
   1–2: Severe distress, fear, repetition — alert caregiver immediately
"""

import re
from typing import Optional
from data_collector import CONFUSION_PATTERNS, detect_emotion


class AnomalyDetector:
    def __init__(self, groq_client):
        self.groq = groq_client

    def quick_confusion_check(self, text: str) -> bool:
        """Fast boolean check — used inline during /chat and /voice."""
        t = text.lower()
        return any(re.search(p, t) for p in CONFUSION_PATTERNS)

    def _heuristic_score(self, messages: list[str]) -> tuple[int, list[str]]:
        """
        Heuristic first pass — fast, no API call.
        Returns (score 1–10, list of detected flags)
        """
        flags = []
        total_confusion = 0
        emotions = []

        for msg in messages:
            t = msg.lower()

            # Count confusion markers
            hits = sum(1 for p in CONFUSION_PATTERNS if re.search(p, t))
            total_confusion += hits
            if hits:
                flags.append("confusion_marker")

            emotions.append(detect_emotion(msg))

        # Dominant emotion
        anxious_count = emotions.count("anxious")
        sad_count     = emotions.count("sad")

        if anxious_count >= 2:
            flags.append("repeated_anxiety")
        if sad_count >= 3:
            flags.append("prolonged_sadness")

        # Repetition — same phrase in multiple messages
        all_text = " ".join(messages).lower()
        words = all_text.split()
        bigrams = [f"{words[i]} {words[i+1]}" for i in range(len(words)-1)]
        bigram_freq = {}
        for bg in bigrams:
            bigram_freq[bg] = bigram_freq.get(bg, 0) + 1
        repeated_bigrams = [bg for bg, count in bigram_freq.items() if count >= 3 and len(bg) > 6]
        if repeated_bigrams:
            flags.append("speech_repetition")

        # Score from confusion density
        confusion_density = total_confusion / max(len(messages), 1)
        score = max(1, min(10, round(10 - (confusion_density * 4) - (len(flags) * 1.5))))

        # Deduplicate flags
        flags = list(set(flags))

        return score, flags

    async def analyse(self, patient_id: str, messages: list[str]) -> dict:
        """
        Full analysis: heuristic + Groq 70B.
        Returns: {score, flags, summary, alert, emotion_trend}
        """
        heuristic_score, flags = self._heuristic_score(messages)

        # Build context for Groq
        numbered = "\n".join(f"{i+1}. {m}" for i, m in enumerate(messages))

        analysis_prompt = f"""You are a clinical assistant helping monitor an Alzheimer's patient.

Analyse these recent messages from the patient:
{numbered}

Provide:
1. A wellbeing score from 1–10 (10=fully oriented and calm, 1=severe distress/confusion)
2. A brief 1-sentence summary for the caregiver
3. Key concern flags (choose from: confusion, anxiety, sadness, repetition, disorientation, loneliness, none)
4. Whether an immediate caregiver alert is warranted (true/false)

Heuristic pre-score: {heuristic_score}/10
Pre-detected flags: {', '.join(flags) if flags else 'none'}

Respond ONLY in this exact JSON format:
{{
  "score": <number 1-10>,
  "summary": "<one sentence for caregiver>",
  "flags": ["<flag1>", "<flag2>"],
  "alert": <true|false>
}}"""

        raw = await self.groq.chat(
            system_prompt="You are a clinical assistant. Return only valid JSON, no markdown fences.",
            user_message=analysis_prompt,
            max_tokens=200,
        )

        # Parse Groq response
        score   = heuristic_score
        summary = "Patient appears to be experiencing some difficulty."
        alert   = heuristic_score <= 3

        try:
            clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            parsed = __import__("json").loads(clean)
            score   = int(parsed.get("score", heuristic_score))
            summary = parsed.get("summary", summary)
            flags   = parsed.get("flags", flags)
            alert   = parsed.get("alert", alert)
        except Exception:
            pass  # Fall back to heuristic values

        return {
            "score":         score,
            "flags":         flags,
            "summary":       summary,
            "alert":         alert,
            "heuristic":     heuristic_score,
            "messages_analysed": len(messages),
        }
