"""
openclaw_agent.py — Function-Calling Agent (OpenClaw)
Runs on port 8090. Receives complex natural language requests
and routes them to the right tool via Groq function calling.

Tools available:
  - retrieve_memory(patient_id, query)
  - get_people(patient_id)
  - store_memory(patient_id, content, type)
  - trigger_alert(patient_id, reason, score)
  - get_session_stats(patient_id)
"""

import os
import json
import httpx
from fastapi import FastAPI
from pydantic import BaseModel
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="OpenClaw Agent", version="2.0.0")

GROQ_KEY      = os.getenv("GROQ_API_KEY")
BACKEND_BASE  = os.getenv("BACKEND_URL", "http://localhost:8080")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT  = os.getenv("TELEGRAM_CHAT_ID", "")

groq_client = AsyncGroq(api_key=GROQ_KEY)

# ── Tool definitions for Groq function calling ────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "retrieve_memory",
            "description": "Search the patient's memory store for relevant information",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string", "description": "The patient ID"},
                    "query":      {"type": "string", "description": "What to search for"},
                },
                "required": ["patient_id", "query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_people",
            "description": "Get all known people (family, friends) for a patient",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                },
                "required": ["patient_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "store_memory",
            "description": "Store a new memory or note for the patient",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id":   {"type": "string"},
                    "content":      {"type": "string", "description": "The memory content"},
                    "memory_type":  {"type": "string", "enum": ["note", "event", "person", "place"]},
                },
                "required": ["patient_id", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_alert",
            "description": "Send a Telegram alert to the caregiver",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                    "reason":     {"type": "string", "description": "Why the alert is being triggered"},
                    "score":      {"type": "number", "description": "Wellbeing score 1-10"},
                },
                "required": ["patient_id", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_session_stats",
            "description": "Get conversation statistics and trends for a patient",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                },
                "required": ["patient_id"],
            },
        },
    },
]


# ── Tool implementations ──────────────────────────────────────────────────────

async def _call_tool(name: str, args: dict) -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        if name == "retrieve_memory":
            pid   = args["patient_id"]
            query = args["query"]
            r = await client.get(f"{BACKEND_BASE}/memories/{pid}", params={"q": query})
            data = r.json()
            mems = data.get("memories", [])
            return "\n".join(f"- {m}" for m in mems) if mems else "No relevant memories found."

        elif name == "get_people":
            pid = args["patient_id"]
            r   = await client.get(f"{BACKEND_BASE}/people/{pid}")
            data = r.json()
            people = data.get("people", [])
            if not people:
                return "No people recorded yet."
            return "\n".join(
                f"- {p.get('name')} ({p.get('relation', 'unknown')})"
                for p in people
            )

        elif name == "store_memory":
            r = await client.post(f"{BACKEND_BASE}/add-memory", json={
                "patient_id":  args["patient_id"],
                "content":     args["content"],
                "memory_type": args.get("memory_type", "note"),
            })
            return "Memory stored successfully." if r.status_code == 200 else "Failed to store memory."

        elif name == "trigger_alert":
            if TELEGRAM_TOKEN and TELEGRAM_CHAT:
                score  = args.get("score", "?")
                reason = args["reason"]
                msg    = (
                    f"🚨 MemoAI Alert\n"
                    f"Patient: {args['patient_id']}\n"
                    f"Score: {score}/10\n"
                    f"Reason: {reason}"
                )
                await client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                    json={"chat_id": TELEGRAM_CHAT, "text": msg},
                )
                return f"Alert sent to caregiver. Score: {score}/10"
            return "Alert logged (Telegram not configured)."

        elif name == "get_session_stats":
            # Session stats come from data_collector via a dedicated endpoint
            # For now return basic info
            return f"Stats for patient {args['patient_id']} — use /collect-data for full export."

    return f"Unknown tool: {name}"


# ── Agent endpoint ────────────────────────────────────────────────────────────

class AgentRequest(BaseModel):
    patient_id: str
    instruction: str   # Natural language instruction from caregiver or system


@app.post("/agent")
async def run_agent(req: AgentRequest):
    """
    Main agent loop — Groq function calling with up to 5 rounds.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a clinical assistant agent for an Alzheimer's care app. "
                "Use the available tools to fulfil the instruction. "
                "Always call retrieve_memory before answering factual questions about the patient."
            ),
        },
        {
            "role": "user",
            "content": f"Patient: {req.patient_id}\nInstruction: {req.instruction}",
        },
    ]

    for _ in range(5):  # Max 5 tool-call rounds
        response = await groq_client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=500,
        )

        msg = response.choices[0].message

        if not msg.tool_calls:
            # Final answer
            return {
                "result":       msg.content,
                "patient_id":   req.patient_id,
                "instruction":  req.instruction,
            }

        # Process tool calls
        messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": [
            {
                "id":       tc.id,
                "type":     "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments},
            }
            for tc in msg.tool_calls
        ]})

        for tc in msg.tool_calls:
            args   = json.loads(tc.function.arguments)
            result = await _call_tool(tc.function.name, args)
            messages.append({
                "role":         "tool",
                "tool_call_id": tc.id,
                "content":      result,
            })

    return {"result": "Agent could not complete the task in 5 steps.", "patient_id": req.patient_id}


@app.get("/health")
async def health():
    return {"status": "ok", "agent": "openclaw", "model": "llama-3.1-70b-versatile"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
