"""
data_collector.py — Patient Session Logger + Fine-Tuning Exporter

This is the core of what the mentor requested:
  "Take actual data from the Alzheimer's patient and train accordingly."

Every conversation turn is:
  1. Saved to a local SQLite DB (no external dependency)
  2. Tagged with emotion, confusion signal, cognitive load estimate
  3. Exportable as JSONL in Alpaca/ChatML format for LLM fine-tuning

Usage:
    logger = DataCollector()
    turn_id = logger.log_turn(patient_id, user_input, ai_response, input_mode, confusion_detected)
    logger.update_feedback(session_id, turn_id, helpful=True)
    lines = logger.export_jsonl(patient_id, system_prompt)
"""

import os
import json
import uuid
import sqlite3
import re
from datetime import datetime
from typing import Optional

DB_PATH = os.getenv("DATA_DB_PATH", "./patient_data.db")

# ── Confusion / Emotion heuristics ──────────────────────────────────────────

CONFUSION_PATTERNS = [
    r"\bwhere am i\b",
    r"\bi don.?t know where\b",
    r"\bwho are you\b",
    r"\bi.?m scared\b",
    r"\bwhat.?s happening\b",
    r"\bi.?m lost\b",
    r"\bi don.?t remember\b",
    r"\bwhat day is it\b",
    r"\bwhere.?s (my|the)\b",
    r"\bi.?m confused\b",
    r"\bwhat year\b",
    r"\bi.?m frightened\b",
]

EMOTION_KEYWORDS = {
    "anxious":   ["scared", "afraid", "worried", "fear", "panic", "lost", "help"],
    "sad":       ["sad", "lonely", "miss", "crying", "upset", "hurt", "gone"],
    "happy":     ["happy", "nice", "good", "lovely", "beautiful", "thank", "wonderful"],
    "confused":  ["confused", "don't understand", "don't know", "forget", "remember"],
    "calm":      ["okay", "fine", "alright", "yes", "sure", "good"],
}

def detect_emotion(text: str) -> str:
    t = text.lower()
    scores = {emotion: 0 for emotion in EMOTION_KEYWORDS}
    for emotion, keywords in EMOTION_KEYWORDS.items():
        for kw in keywords:
            if kw in t:
                scores[emotion] += 1
    # Return highest scoring emotion, default to neutral
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "neutral"

def estimate_cognitive_load(text: str) -> float:
    """
    Heuristic cognitive load score 0.0–1.0
    High load = short sentences, repetition, confusion markers, fragmented speech
    """
    score = 0.0
    word_count = len(text.split())

    # Very short utterances suggest high load
    if word_count < 5:
        score += 0.3
    elif word_count < 10:
        score += 0.15

    # Confusion markers
    t = text.lower()
    for pattern in CONFUSION_PATTERNS:
        if re.search(pattern, t):
            score += 0.2
            break

    # Repetition (same word appears 3+ times)
    words = t.split()
    word_freq = {}
    for w in words:
        word_freq[w] = word_freq.get(w, 0) + 1
    if any(v >= 3 for v in word_freq.values()):
        score += 0.15

    # Question words (disorientation signal)
    if any(q in t for q in ["where", "who", "what", "when", "why"]):
        score += 0.1

    return min(score, 1.0)


# ── DataCollector ─────────────────────────────────────────────────────────────

class DataCollector:
    def __init__(self):
        self._init_db()
        self._current_sessions = {}  # patient_id → session_id

    def _init_db(self):
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS session_turns (
                id                   TEXT PRIMARY KEY,
                session_id           TEXT NOT NULL,
                patient_id           TEXT NOT NULL,
                turn_number          INTEGER NOT NULL,
                timestamp            TEXT NOT NULL,
                user_input           TEXT NOT NULL,
                ai_response          TEXT NOT NULL,
                input_mode           TEXT NOT NULL,    -- text | voice
                emotion_tag          TEXT NOT NULL,
                confusion_detected   INTEGER NOT NULL,  -- 0 | 1
                cognitive_load       REAL NOT NULL,
                response_helpful     INTEGER,           -- NULL | 0 | 1 (caregiver feedback)
                exported             INTEGER DEFAULT 0  -- whether included in fine-tune export
            )
        """)
        conn.commit()
        conn.close()

    def _get_or_create_session(self, patient_id: str) -> str:
        """
        Sessions reset after 2 hours of inactivity.
        Each session becomes one 'conversation' in the fine-tuning dataset.
        """
        now = datetime.utcnow()
        if patient_id in self._current_sessions:
            session = self._current_sessions[patient_id]
            last = datetime.fromisoformat(session["last_active"])
            if (now - last).seconds < 7200:  # 2-hour timeout
                session["last_active"] = now.isoformat()
                return session["id"]

        session_id = str(uuid.uuid4())
        self._current_sessions[patient_id] = {
            "id":          session_id,
            "last_active": now.isoformat(),
            "turn_count":  0,
        }
        return session_id

    def log_turn(
        self,
        patient_id: str,
        user_input: str,
        ai_response: str,
        input_mode: str = "text",
        confusion_detected: bool = False,
    ) -> str:
        session_id = self._get_or_create_session(patient_id)
        self._current_sessions[patient_id]["turn_count"] += 1
        turn_number = self._current_sessions[patient_id]["turn_count"]

        turn_id = str(uuid.uuid4())
        emotion  = detect_emotion(user_input)
        cog_load = estimate_cognitive_load(user_input)

        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            INSERT INTO session_turns
            (id, session_id, patient_id, turn_number, timestamp,
             user_input, ai_response, input_mode, emotion_tag,
             confusion_detected, cognitive_load)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            turn_id, session_id, patient_id, turn_number,
            datetime.utcnow().isoformat(),
            user_input, ai_response, input_mode,
            emotion, int(confusion_detected), cog_load,
        ))
        conn.commit()
        conn.close()

        return turn_id

    def update_feedback(self, session_id: str, turn_id: str, helpful: bool):
        """Caregiver marks a response as helpful or not — filters fine-tuning data."""
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "UPDATE session_turns SET response_helpful=? WHERE id=?",
            (int(helpful), turn_id),
        )
        conn.commit()
        conn.close()

    def export_jsonl(self, patient_id: str, system_prompt: str) -> list[str]:
        """
        Export all sessions for a patient as JSONL lines in ChatML format.
        Rules:
          - Only include turns where response_helpful is NULL or 1 (exclude explicit dislikes)
          - Group turns by session_id → each session = one JSONL conversation
          - Minimum 2 turns per session (single-turn sessions are noise)
        """
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("""
            SELECT session_id, user_input, ai_response, emotion_tag,
                   confusion_detected, cognitive_load, response_helpful
            FROM session_turns
            WHERE patient_id = ?
              AND (response_helpful IS NULL OR response_helpful = 1)
            ORDER BY session_id, turn_number
        """, (patient_id,)).fetchall()
        conn.close()

        # Group by session
        sessions: dict[str, list] = {}
        for row in rows:
            sid = row[0]
            sessions.setdefault(sid, []).append(row)

        lines = []
        for sid, turns in sessions.items():
            if len(turns) < 2:
                continue  # Skip single-turn sessions

            messages = [{"role": "system", "content": system_prompt}]
            for turn in turns:
                _, user_in, ai_resp, emotion, confusion, cog_load, _ = turn

                # Add metadata comment to user turn for richer fine-tuning signal
                # (models learn to handle emotional context)
                messages.append({"role": "user",      "content": user_in})
                messages.append({"role": "assistant", "content": ai_resp})

            lines.append(json.dumps({"messages": messages}, ensure_ascii=False))

        return lines

    def get_session_stats(self, patient_id: str) -> dict:
        """Returns summary statistics useful for caregiver reports."""
        conn = sqlite3.connect(DB_PATH)
        stats = conn.execute("""
            SELECT
                COUNT(*)                         as total_turns,
                COUNT(DISTINCT session_id)       as total_sessions,
                AVG(cognitive_load)              as avg_cognitive_load,
                SUM(confusion_detected)          as confusion_events,
                COUNT(CASE WHEN emotion_tag='anxious' THEN 1 END) as anxious_count,
                COUNT(CASE WHEN emotion_tag='sad'     THEN 1 END) as sad_count,
                COUNT(CASE WHEN emotion_tag='happy'   THEN 1 END) as happy_count,
                MIN(timestamp)                   as first_session,
                MAX(timestamp)                   as last_session
            FROM session_turns
            WHERE patient_id = ?
        """, (patient_id,)).fetchone()
        conn.close()

        return {
            "total_turns":        stats[0],
            "total_sessions":     stats[1],
            "avg_cognitive_load": round(stats[2] or 0, 2),
            "confusion_events":   stats[3],
            "emotion_breakdown": {
                "anxious": stats[4],
                "sad":     stats[5],
                "happy":   stats[6],
            },
            "first_session": stats[7],
            "last_session":  stats[8],
        }
