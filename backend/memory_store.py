"""
memory_store.py — ChromaDB wrapper for MemoAI
Collections:
  {patient_id}_memories  → text memories, events, notes, photo descriptions
  {patient_id}_people    → known people (family, caregivers, friends)
"""

import os
import uuid
from datetime import datetime
from typing import Optional

import chromadb
from chromadb.config import Settings


class MemoryStore:
    def __init__(self):
        host = os.getenv("CHROMA_HOST", "localhost")
        port = int(os.getenv("CHROMA_PORT", "8000"))
        try:
            self.client = chromadb.HttpClient(
                host=host,
                port=port,
                settings=Settings(anonymized_telemetry=False),
            )
        except Exception:
            # Fallback to in-process for local dev without Docker
            print("[ChromaDB] HttpClient failed — using in-memory fallback")
            self.client = chromadb.Client()

    def ping(self) -> bool:
        try:
            self.client.heartbeat()
            return True
        except Exception:
            return False

    # ── Memory collections ────────────────────────────────────────────────

    def _mem_collection(self, patient_id: str):
        return self.client.get_or_create_collection(
            name=f"{patient_id}_memories",
            metadata={"hnsw:space": "cosine"},
        )

    def _people_collection(self, patient_id: str):
        return self.client.get_or_create_collection(
            name=f"{patient_id}_people",
            metadata={"hnsw:space": "cosine"},
        )

    # ── Memories ─────────────────────────────────────────────────────────

    def add_memory(self, patient_id: str, content: str, metadata: dict = None):
        col  = self._mem_collection(patient_id)
        meta = metadata or {}
        meta.setdefault("created", datetime.utcnow().isoformat())
        meta.setdefault("type",    "note")
        col.add(
            ids=[str(uuid.uuid4())],
            documents=[content],
            metadatas=[meta],
        )

    def search_memories(self, patient_id: str, query: str, n_results: int = 10) -> list[str]:
        col = self._mem_collection(patient_id)
        try:
            count = col.count()
            if count == 0:
                return []
            results = col.query(
                query_texts=[query],
                n_results=min(n_results, count),
            )
            return results["documents"][0] if results["documents"] else []
        except Exception as e:
            print(f"[MemoryStore] search error: {e}")
            return []

    # ── People ────────────────────────────────────────────────────────────

    def add_person(self, patient_id: str, person: dict):
        """
        person dict: {name, relation, age?, city?, notes?, last_visit?}
        Deduplicate by name — update if already exists.
        """
        col  = self._people_collection(patient_id)
        name = person.get("name", "").strip()
        if not name:
            return

        # Check for existing entry
        try:
            existing = col.get(where={"name": name})
            if existing["ids"]:
                # Update
                col.update(
                    ids=existing["ids"],
                    documents=[name],
                    metadatas=[{**existing["metadatas"][0], **person}],
                )
                return
        except Exception:
            pass

        col.add(
            ids=[str(uuid.uuid4())],
            documents=[name],
            metadatas=[{
                "name":       name,
                "relation":   person.get("relation", ""),
                "age":        str(person.get("age", "")),
                "city":       person.get("city", ""),
                "notes":      person.get("notes", ""),
                "last_visit": person.get("last_visit", ""),
                "created":    datetime.utcnow().isoformat(),
            }],
        )

    def get_people(self, patient_id: str) -> list[dict]:
        col = self._people_collection(patient_id)
        try:
            results = col.get()
            return results.get("metadatas", [])
        except Exception:
            return []

    # ── Patient Profile ───────────────────────────────────────────────────

    def get_patient_profile(self, patient_id: str) -> dict:
        """
        Build a lightweight profile for system-prompt injection.
        Includes: name, people summary, recent context.
        """
        people = self.get_people(patient_id)
        recent = self.search_memories(patient_id, "recent important events", n_results=5)

        people_lines = []
        for p in people[:10]:
            line = f"- {p.get('name', '?')} ({p.get('relation', 'known person')})"
            if p.get("age"):
                line += f", age {p['age']}"
            if p.get("city"):
                line += f", lives in {p['city']}"
            if p.get("notes"):
                line += f". {p['notes']}"
            people_lines.append(line)

        # Use first "person" type memory as patient name hint
        name = patient_id  # fallback
        try:
            name_results = self.search_memories(patient_id, "patient name is", n_results=1)
            if name_results and "patient name" in name_results[0].lower():
                # Extract name from memory like "Patient name is Ramesh Sharma"
                parts = name_results[0].lower().split("patient name is")
                if len(parts) > 1:
                    name = parts[1].strip().split()[0].title()
        except Exception:
            pass

        return {
            "name":            name,
            "people_summary":  "\n".join(people_lines) if people_lines else "No family members recorded yet.",
            "recent_context":  "\n".join(f"- {m}" for m in recent) if recent else "No recent context.",
        }
