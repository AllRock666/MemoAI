# 🧠 MemoAI — Alzheimer's Memory Companion

> **A voice-first, AI-powered memory assistant for Alzheimer's patients, with real behavioural data collection, caregiver alerts, and a fine-tunable patient profile pipeline.**

---

## 🎯 What This Does (and Why It's Different)

Most AI assistants treat every user the same. MemoAI treats Alzheimer's care seriously:

- **Collects real patient interaction data** — every conversation, voice input, and confusion event is logged with timestamp, emotion, and cognitive load tags
- **Builds a personal memory graph** — people, places, and events the patient actually knows, not generic samples
- **Detects cognitive anomalies** — uses a sliding-window sentiment + confusion-detection pipeline, not just keyword matching
- **Feeds a fine-tuning pipeline** — structured JSONL exports from real sessions can be used to fine-tune a patient-specific LLM
- **Caregiver Telegram alerts** — real-time, score-gated alerts with full context
- **Multilingual** — English, Hindi, Marathi (the three languages most relevant to Indian elderly patients)

---

## 🏗 Architecture

```
Mobile App (Expo React Native)
    │
    │  REST (JSON + multipart)
    ▼
FastAPI Backend  (:8080)
    ├── /chat          → ChromaDB RAG → Groq llama-3.1-70b
    ├── /voice         → Groq Whisper STT → Groq 70B → Piper TTS
    ├── /upload-photo  → Groq LLaVA → people extraction → ChromaDB
    ├── /add-memory    → structured tagging → ChromaDB + JSONL log
    ├── /anomaly-check → sliding window → Groq 70B sentiment
    ├── /collect-data  → 🆕 raw session export for fine-tuning
    └── /health
         │
         │  fire-and-forget webhooks
         ▼
n8n Automation  (:5678)
    ├── /log     → anomaly score → Telegram if score < 4
    ├── /ingest  → memory ingestion events
    └── cron 8pm → daily summary → Telegram
         │
         ▼
ChromaDB  (:8000)   — patient memories, people graph, session logs
```

---

## 🧬 Real Patient Data Pipeline (Mentor's Key Requirement)

The mentor is right: **without real patient data, you get generic AI output**. MemoAI addresses this with a 3-stage pipeline:

### Stage 1 — Data Collection (Built Into the App)
Every interaction is structured and saved:
```json
{
  "session_id": "uuid",
  "patient_id": "demo",
  "timestamp": "2024-01-15T14:32:00Z",
  "turn": 12,
  "user_input": "I don't know where I am",
  "ai_response": "You're at home, in your living room...",
  "input_mode": "voice",
  "emotion_tag": "anxious",
  "confusion_detected": true,
  "response_helpful": null,   // filled by caregiver feedback
  "cognitive_load_estimate": 0.82
}
```

### Stage 2 — Export for Fine-Tuning
`GET /collect-data/{patient_id}` exports a JSONL file in Alpaca/ChatML format:
```jsonl
{"messages": [{"role": "system", "content": "You are a memory companion for <name>..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
```
This file is ready to upload to Groq/HuggingFace for fine-tuning.

### Stage 3 — Patient-Specific Model
Fine-tune `llama-3.1-8b` on the exported data → deploy as a personal model that:
- Knows the patient's family by name
- Matches the patient's speech patterns
- Calibrates confusion thresholds from real history

---

## 🚀 Quick Start (30 Minutes)

### Prerequisites
- Node.js 18+ and Expo CLI
- Python 3.11+
- Docker Desktop
- [Groq API key](https://console.groq.com) (free)
- Telegram bot token (optional, for alerts)

### 1. Clone and Configure
```bash
git clone <your-repo-url>
cd memoai
cp backend/.env.example backend/.env
# Edit backend/.env — paste your GROQ_API_KEY and TELEGRAM_BOT_TOKEN
```

### 2. Start Infrastructure
```bash
cd backend
docker-compose up -d   # ChromaDB + n8n
```

### 3. Start Backend
```bash
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --port 8080
```

### 4. Seed Demo Patient Data
```bash
cd backend
python seed_demo.py
```

### 5. Start Mobile App
```bash
cd mobile_app
npm install
# Edit src/utils/settings.js → set API_BASE to your machine's local IP (run `ipconfig` / `ifconfig`)
npx expo start
```

Scan the QR code with Expo Go on your phone.

---

## 📁 Project Structure

```
memoai/
├── README.md
├── mobile_app/
│   ├── App.js                      # Root — tab + stack navigator
│   ├── app.json                    # Expo config (permissions etc.)
│   ├── babel.config.js
│   ├── package.json
│   └── src/
│       ├── screens/
│       │   ├── ChatScreen.js       # Voice + text chat with patient
│       │   ├── MemoryScreen.js     # Browse + upload photo memories
│       │   ├── PeopleScreen.js     # Family / known-people graph
│       │   ├── AddMemoryScreen.js  # Manual memory entry
│       │   ├── SettingsScreen.js   # Backend URL, language, patient ID
│       │   └── CaregiverDashboard.js # System health + anomaly panel
│       ├── services/
│       │   └── api.js              # All API calls (typed, error-handled)
│       └── utils/
│           ├── theme.js            # Design tokens
│           ├── i18n.js             # EN / HI / MR translations
│           ├── settings.js         # AsyncStorage settings store
│           └── useTranslation.js   # React hook for live i18n
├── backend/
│   ├── main.py                     # FastAPI app — all routes
│   ├── data_collector.py           # 🆕 Session logger + JSONL exporter
│   ├── anomaly_detector.py         # 🆕 Sliding-window cognitive analysis
│   ├── memory_store.py             # ChromaDB wrapper
│   ├── groq_client.py              # Groq API wrapper (LLM + STT + Vision)
│   ├── openclaw_agent.py           # Function-calling agent
│   ├── seed_demo.py                # Seeds realistic Alzheimer's patient data
│   ├── requirements.txt
│   ├── docker-compose.yml
│   └── .env.example
└── docs/
    ├── FINE_TUNING.md              # How to export + fine-tune on patient data
    └── DATA_SCHEMA.md              # Full schema for collected data
```

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System status |
| POST | `/chat` | Text chat with RAG |
| POST | `/voice` | Voice → STT → LLM → TTS |
| POST | `/upload-photo` | Photo → LLaVA → ChromaDB |
| POST | `/add-memory` | Manual memory entry |
| GET | `/people/{id}` | Known people list |
| GET | `/memories/{id}` | Memory search |
| POST | `/anomaly-check` | Cognitive anomaly detection |
| GET | `/collect-data/{id}` | **Export session data for fine-tuning** |

---

## 🔑 Environment Variables

```env
# Required
GROQ_API_KEY=gsk_...

# Optional — for caregiver alerts
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Optional — n8n webhook base URL
N8N_BASE_URL=http://localhost:5678/webhook

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

---

## 📊 Demo Script (5 Minutes)

1. **Chat tab** → type *"Who is Priya?"*
   → Groq 70B answers with warm, patient-specific context in ~1.5s

2. **Voice** → hold mic → say *"I don't know where I am, I'm scared"*
   → Whisper transcribes → 70B responds gently → n8n fires Telegram alert

3. **Memories tab** → upload family photo → add caption *"Priya at Diwali 2019"*
   → LLaVA describes → 70B extracts people → People tab updates

4. **Caregiver Dashboard** → run anomaly check → see cognitive score + flags

5. **Export** → `GET /collect-data/demo` → download JSONL → *"This is what we'd use to fine-tune a patient-specific model"*

---

## 🔮 Roadmap (Post-Hackathon)

- [ ] Fine-tune llama-3.1-8b on exported patient JSONL data
- [ ] Wearable integration (heart rate as physiological confusion signal)
- [ ] Family app — separate caregiver view with timeline
- [ ] Offline mode — on-device model for network-free use
- [ ] MMSE score tracking over time (Mini-Mental State Examination)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo (React Native) |
| LLM | Groq llama-3.1-70b-versatile |
| STT | Groq whisper-large-v3 |
| Vision | Groq llava-v1.5-7b |
| Vector DB | ChromaDB |
| Backend | FastAPI (Python) |
| Automation | n8n |
| Alerts | Telegram Bot API |
| Data Export | JSONL (Alpaca format) |

---

## 👥 Team

Built at HackArena· May 2026

---

## 📄 License

MIT
