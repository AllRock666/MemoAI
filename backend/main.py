"""
MemoAI v2 — FastAPI Backend
Groq Edition: llama-3.1-70b + Whisper + LLaVA + ChromaDB

Key additions over v1:
  - /collect-data  → exports structured JSONL for patient-specific fine-tuning
  - data_collector → tags every turn with emotion, confusion, cognitive load
  - anomaly_detector → sliding-window analysis, not just keyword matching
"""

import os
import uuid
import json
import tempfile
import asyncio
from datetime import datetime
from typing import Optional, List

import httpx
from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from groq_client import GroqClient
from memory_store import MemoryStore
from data_collector import DataCollector
from anomaly_detector import AnomalyDetector

load_dotenv()

app = FastAPI(title="MemoAI Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ──────────────────────────────────────────────────────────────
groq   = GroqClient()
store  = MemoryStore()
logger = DataCollector()
anomaly = AnomalyDetector(groq)

N8N_BASE = os.getenv("N8N_BASE_URL", "http://localhost:5678/webhook")

# ── Pydantic Models ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    patient_id: str
    message: str

class MemoryRequest(BaseModel):
    patient_id: str
    content: str
    memory_type: str = "note"   # note | event | person | place

class FeedbackRequest(BaseModel):
    session_id: str
    turn_id: str
    helpful: bool   # caregiver marks whether response actually helped

# ── Helpers ──────────────────────────────────────────────────────────────────

async def fire_n8n(path: str, payload: dict):
    """Fire-and-forget webhook to n8n."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(f"{N8N_BASE}{path}", json=payload)
    except Exception as e:
        print(f"[n8n] {path} failed: {e}")

def patient_system_prompt(patient_id: str) -> str:
    """
    Build a warm, patient-specific system prompt using stored profile data.
    The profile is fetched from ChromaDB so it reflects actual stored memories.
    """
    profile = store.get_patient_profile(patient_id)
    name    = profile.get("name", "the patient")
    people  = profile.get("people_summary", "")
    context = profile.get("recent_context", "")

    return f"""You are MemoAI, a warm and patient memory companion for {name}, \
who has Alzheimer's disease.

Your role:
- Speak slowly, warmly, and in short sentences
- Use the patient's real name and family members' names whenever relevant
- Gently reorient the patient if they are confused — never argue, never correct harshly
- If the patient expresses fear or distress, offer comfort FIRST before information
- Keep answers to 2–3 sentences maximum

What you know about {name}:
{people}

Recent context from previous sessions:
{context}

IMPORTANT: You must NEVER make up family members or events. Only reference \
information you have been told. If unsure, say "I'm not sure, but I'm right here with you."
"""

# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    chroma_ok = store.ping()
    return {
        "status": "ok" if chroma_ok else "degraded",
        "llm":  "groq/llama-3.1-70b-versatile",
        "stt":  "groq/whisper-large-v3",
        "vision": "groq/llava-v1.5-7b",
        "vector_db": "chromadb",
        "chroma_connected": chroma_ok,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/chat")
async def chat(req: ChatRequest):
    """
    Text chat endpoint.
    1. Retrieve relevant memories from ChromaDB (RAG)
    2. Build patient-specific system prompt
    3. Call Groq 70B
    4. Log turn to DataCollector (for fine-tuning export)
    5. Fire n8n log webhook
    """
    patient_id = req.patient_id
    message    = req.message

    # 1. RAG — retrieve relevant memories
    memories = store.search_memories(patient_id, message, n_results=5)
    rag_context = "\n".join(f"- {m}" for m in memories) if memories else "(no relevant memories found)"

    system = patient_system_prompt(patient_id)
    system += f"\n\nRelevant memories for this conversation:\n{rag_context}"

    # 2. Call Groq
    reply = await groq.chat(system_prompt=system, user_message=message)

    # 3. Detect confusion in the user's message
    confusion = anomaly.quick_confusion_check(message)

    # 4. Log turn for data collection
    turn_id = logger.log_turn(
        patient_id=patient_id,
        user_input=message,
        ai_response=reply,
        input_mode="text",
        confusion_detected=confusion,
    )

    # 5. Background n8n webhook
    asyncio.create_task(fire_n8n("/log", {
        "patient_id": patient_id,
        "message":    message,
        "reply":      reply,
        "confusion":  confusion,
        "timestamp":  datetime.utcnow().isoformat(),
    }))

    return {
        "reply":    reply,
        "turn_id":  turn_id,
        "rag_hits": len(memories),
    }


@app.post("/voice")
async def voice(
    patient_id: str = Query(...),
    audio: UploadFile = File(...),
):
    """
    Voice pipeline:
    1. Save upload to temp file
    2. Groq Whisper STT → transcript
    3. Same RAG + 70B flow as /chat
    4. Log turn with input_mode='voice'
    """
    # Save audio temp file
    suffix = os.path.splitext(audio.filename or "audio.m4a")[1] or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        # 1. STT
        transcript = await groq.transcribe(tmp_path)
    finally:
        os.unlink(tmp_path)

    if not transcript:
        return {"transcript": "", "reply": "I'm sorry, I didn't catch that. Could you try again?"}

    # 2. RAG + LLM (reuse chat logic)
    memories = store.search_memories(patient_id, transcript, n_results=5)
    rag_context = "\n".join(f"- {m}" for m in memories) if memories else ""

    system = patient_system_prompt(patient_id)
    if rag_context:
        system += f"\n\nRelevant memories:\n{rag_context}"

    reply = await groq.chat(system_prompt=system, user_message=transcript)

    confusion = anomaly.quick_confusion_check(transcript)

    turn_id = logger.log_turn(
        patient_id=patient_id,
        user_input=transcript,
        ai_response=reply,
        input_mode="voice",
        confusion_detected=confusion,
    )

    asyncio.create_task(fire_n8n("/log", {
        "patient_id": patient_id,
        "transcript": transcript,
        "reply":      reply,
        "confusion":  confusion,
        "timestamp":  datetime.utcnow().isoformat(),
    }))

    return {
        "transcript": transcript,
        "reply":      reply,
        "turn_id":    turn_id,
    }


@app.post("/upload-photo")
async def upload_photo(
    patient_id: str = Query(...),
    caregiver_note: str = Query(default=""),
    photo: UploadFile = File(...),
):
    """
    Photo memory pipeline:
    1. Groq LLaVA → visual description
    2. Groq 70B → extract structured people + events
    3. Store everything in ChromaDB
    """
    data = await photo.read()
    import base64
    b64 = base64.b64encode(data).decode()

    # 1. Vision description
    description = await groq.describe_image(b64, caregiver_note)

    # 2. Extract structured people
    extraction_prompt = f"""From this photo description, extract any people mentioned.
Description: {description}
Caregiver note: {caregiver_note}

Return ONLY valid JSON in this exact format:
{{
  "people": [
    {{"name": "...", "relation": "...", "notes": "..."}}
  ],
  "event": "brief event description or empty string",
  "place": "place name or empty string"
}}"""

    raw = await groq.chat(
        system_prompt="You extract structured data from text. Return only valid JSON, no markdown.",
        user_message=extraction_prompt,
    )

    people_found = []
    event = ""
    place = ""
    try:
        # Strip markdown fences if present
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        parsed = json.loads(clean)
        people_found = parsed.get("people", [])
        event = parsed.get("event", "")
        place = parsed.get("place", "")
    except json.JSONDecodeError:
        pass

    # 3. Store memory
    memory_text = description
    if caregiver_note:
        memory_text += f" | Note: {caregiver_note}"

    store.add_memory(
        patient_id=patient_id,
        content=memory_text,
        metadata={
            "type":    "photo",
            "event":   event,
            "place":   place,
            "source":  "photo_upload",
            "created": datetime.utcnow().isoformat(),
        },
    )

    # Store each person
    for person in people_found:
        if person.get("name"):
            store.add_person(patient_id, person)

    asyncio.create_task(fire_n8n("/ingest", {
        "patient_id":   patient_id,
        "type":         "photo",
        "description":  description,
        "people_count": len(people_found),
        "timestamp":    datetime.utcnow().isoformat(),
    }))

    return {
        "description":  description,
        "people_found": people_found,
        "event":        event,
        "place":        place,
        "stored":       True,
    }


@app.post("/add-memory")
async def add_memory(req: MemoryRequest):
    """
    Manual memory entry — caregiver or patient can add a text memory.
    Supports types: note | event | person | place
    """
    store.add_memory(
        patient_id=req.patient_id,
        content=req.content,
        metadata={
            "type":    req.memory_type,
            "source":  "manual",
            "created": datetime.utcnow().isoformat(),
        },
    )

    asyncio.create_task(fire_n8n("/ingest", {
        "patient_id": req.patient_id,
        "type":       req.memory_type,
        "content":    req.content,
        "timestamp":  datetime.utcnow().isoformat(),
    }))

    return {"stored": True, "memory_type": req.memory_type}


@app.get("/people/{patient_id}")
async def get_people(patient_id: str):
    """Returns all known people for a patient."""
    people = store.get_people(patient_id)
    return {"people": people, "count": len(people)}


@app.get("/memories/{patient_id}")
async def get_memories(patient_id: str, q: str = Query(default="recent")):
    """
    Returns memories matching a query, or the most recent ones.
    """
    memories = store.search_memories(patient_id, q, n_results=20)
    return {"memories": memories, "query": q, "count": len(memories)}


@app.post("/anomaly-check")
async def anomaly_check(
    patient_id: str = Query(...),
    messages: List[str] = None,
):
    """
    Cognitive anomaly detection over recent messages.
    Uses sliding-window analysis + Groq 70B for nuanced scoring.
    Score: 1–10 (10 = fully oriented, 1 = severe distress/confusion)
    """
    if not messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    result = await anomaly.analyse(patient_id, messages)

    # Fire caregiver alert if score is critical
    if result["score"] is not None and result["score"] < 4:
        asyncio.create_task(fire_n8n("/log", {
            "patient_id": patient_id,
            "alert":      True,
            "score":      result["score"],
            "flags":      result["flags"],
            "summary":    result["summary"],
            "timestamp":  datetime.utcnow().isoformat(),
        }))

    return result


@app.get("/collect-data/{patient_id}")
async def collect_data(patient_id: str):
    """
    🆕 Export all logged sessions as a JSONL file for fine-tuning.
    Format: Alpaca / ChatML — ready to upload to Groq fine-tuning or HuggingFace.

    Each line:
    {"messages": [{"role":"system","content":"..."}, {"role":"user","content":"..."}, {"role":"assistant","content":"..."}]}
    """
    profile = store.get_patient_profile(patient_id)
    system_prompt = patient_system_prompt(patient_id)
    lines = logger.export_jsonl(patient_id, system_prompt)

    if not lines:
        raise HTTPException(status_code=404, detail="No session data found for this patient.")

    content = "\n".join(lines)

    return StreamingResponse(
        iter([content]),
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": f'attachment; filename="{patient_id}_finetune_{datetime.utcnow().strftime("%Y%m%d")}.jsonl"'
        },
    )


@app.post("/feedback")
async def caregiver_feedback(req: FeedbackRequest):
    """
    Caregiver marks a response as helpful or not.
    This updates the JSONL export so poor responses are excluded from fine-tuning.
    """
    logger.update_feedback(req.session_id, req.turn_id, req.helpful)
    return {"updated": True}
