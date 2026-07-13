"""
seed_demo.py — Seeds a realistic Alzheimer's patient profile

Run once after starting the backend:
  python seed_demo.py

This creates a demo patient (Ramesh Sharma, 74) with:
  - Family members in the people graph
  - Life history memories
  - Realistic sample session turns for testing fine-tuning export
"""

import asyncio
import httpx
import time

BASE = "http://localhost:8080"

# ── Patient Profile ──────────────────────────────────────────────────────────

PATIENT_ID = "demo"

MEMORIES = [
    # Identity
    "Patient name is Ramesh Sharma. He is 74 years old and lives in Pune, Maharashtra.",
    "Ramesh worked as a school teacher for 35 years at Bal Vikas School in Pune.",
    "Ramesh retired in 2015. He loves reading Marathi novels and listening to classical music.",
    "Ramesh's favourite food is his wife Sunita's dal baati. He always says nobody makes it like her.",
    "Ramesh has mild Alzheimer's disease diagnosed in 2022. He sometimes forgets where he is.",
    # Home
    "Ramesh lives at Flat 4B, Shivaji Nagar, Pune 411005. He has lived there for 30 years.",
    "His bedroom is on the left side of the flat. The bathroom is next to it.",
    # Daily routine
    "Ramesh's daily routine: wakes at 6am, drinks chai with Sunita, reads newspaper, lunch at 1pm, nap 2–3pm, evening walk in Nehru Park.",
    # Preferences
    "Ramesh prefers to be addressed as 'Rameshji' by doctors and caregivers. He finds it respectful.",
    "He does not like loud TV or too many people at once — it increases his confusion.",
]

PEOPLE = [
    {"name": "Sunita Sharma",   "relation": "wife",       "age": "70", "city": "Pune",    "notes": "Primary caregiver. Speaks Marathi and Hindi."},
    {"name": "Arjun Sharma",    "relation": "son",        "age": "45", "city": "Mumbai",  "notes": "Visits every weekend. Works in IT."},
    {"name": "Priya Sharma",    "relation": "daughter",   "age": "42", "city": "Pune",    "notes": "Lives nearby. Helps with hospital appointments."},
    {"name": "Riya Sharma",     "relation": "granddaughter", "age": "14", "city": "Pune", "notes": "Ramesh's favourite. She calls him 'Nana'."},
    {"name": "Dr. Mehta",       "relation": "doctor",     "age": "",   "city": "Pune",    "notes": "Neurologist at Ruby Hall Clinic. Appointment every 3 months."},
    {"name": "Suresh Patil",    "relation": "friend",     "age": "73", "city": "Pune",    "notes": "Old colleague from Bal Vikas School. Visits on Sundays."},
]

SAMPLE_SESSIONS = [
    # Session 1 — mild confusion
    [
        ("Where am I? I don't recognise this place.", "You're at home, Rameshji — your flat in Shivaji Nagar. You've lived here for 30 years. Sunita is right here with you."),
        ("Is Sunita here? I can't see her.", "Yes, Sunita is here. She just stepped into the kitchen to make your chai. She'll be right back."),
        ("Oh good. I was worried. Thank you.", "Of course. There is nothing to worry about. You are safe at home."),
    ],
    # Session 2 — asking about family
    [
        ("Who is that girl in the photo?", "That looks like it could be Riya, your granddaughter. She is 14 years old and she loves calling you Nana."),
        ("Riya! Yes, she is wonderful. When is she coming?", "I don't know exactly, but Priya visits regularly and often brings Riya along. Would you like to call her?"),
        ("Yes, I'd like to hear her voice.", "That's a lovely idea. Sunita can help you call her."),
    ],
    # Session 3 — distress
    [
        ("I'm scared. I don't know what's happening.", "I hear you, Rameshji. You are safe. You are at home in Pune. Take a slow breath with me."),
        ("I don't remember how I got here.", "You have been at home all day. Sunita was with you this morning for chai, and you read the newspaper. Everything is okay."),
        ("I read the newspaper?", "Yes, the Times of India. You do this every morning. It's part of your routine and it helps keep your mind sharp."),
        ("Okay. Thank you. I feel better now.", "I'm glad. You are surrounded by people who love you. You don't have to face anything alone."),
    ],
]


async def seed():
    async with httpx.AsyncClient(timeout=30, base_url=BASE) as client:

        # 1. Health check
        try:
            r = await client.get("/health")
            print(f"✅ Backend online: {r.json()['status']}")
        except Exception as e:
            print(f"❌ Backend not reachable: {e}")
            print("   Start the backend first: uvicorn main:app --port 8080")
            return

        # 2. Seed memories
        print("\n📝 Seeding memories...")
        for mem in MEMORIES:
            await client.post("/add-memory", json={
                "patient_id":  PATIENT_ID,
                "content":     mem,
                "memory_type": "note",
            })
            print(f"   + {mem[:60]}...")
            await asyncio.sleep(0.3)   # Respect Groq rate limits

        # 3. Seed people via photo upload (using text upload as proxy)
        print("\n👥 Seeding people...")
        for person in PEOPLE:
            # We add people via the memory store by calling add-memory with type=person
            # and then add them directly via the people endpoint
            await client.post("/add-memory", json={
                "patient_id":  PATIENT_ID,
                "content":     f"{person['name']} is Ramesh's {person['relation']}. {person.get('notes', '')}",
                "memory_type": "person",
            })
            print(f"   + {person['name']} ({person['relation']})")
            await asyncio.sleep(0.2)

        # 4. Seed sample session turns (for fine-tuning demo)
        print("\n💬 Seeding sample session turns...")
        for session_num, session in enumerate(SAMPLE_SESSIONS):
            for user_msg, ai_reply in session:
                await client.post("/chat", json={
                    "patient_id": PATIENT_ID,
                    "message":    user_msg,
                })
                print(f"   Session {session_num+1}: {user_msg[:50]}...")
                await asyncio.sleep(0.5)
            time.sleep(1)  # Small gap between sessions

        # 5. Verify
        print("\n🔍 Verification...")
        r = await client.get(f"/memories/{PATIENT_ID}", params={"q": "Ramesh home Pune"})
        mems = r.json().get("memories", [])
        print(f"   Memories stored: {len(mems)}")

        # 6. Test fine-tuning export
        r = await client.get(f"/collect-data/{PATIENT_ID}")
        lines = r.text.strip().split("\n") if r.text.strip() else []
        print(f"   Fine-tuning JSONL lines: {len(lines)}")

        print("\n✅ Demo patient seeded successfully!")
        print(f"\nDemo credentials:")
        print(f"  Patient ID: {PATIENT_ID}")
        print(f"  Backend:    {BASE}")
        print(f"\nExport fine-tuning data:")
        print(f"  curl {BASE}/collect-data/{PATIENT_ID} -o demo_finetune.jsonl")


if __name__ == "__main__":
    asyncio.run(seed())
