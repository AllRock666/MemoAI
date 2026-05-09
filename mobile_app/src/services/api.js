/**
 * api.js — MemoAI API Service Layer
 * All calls to the FastAPI backend (port 8080)
 * Backend URL and patient ID are read from settings store at runtime
 */
import { getSettings } from '../utils/settings';

export const DEFAULT_BASE  = 'http://localhost:8080';
export const DEMO_PATIENT  = 'demo';

function getBase() {
  return getSettings().backendUrl || DEFAULT_BASE;
}

export function getPatientId() {
  return getSettings().patientId || DEMO_PATIENT;
}

async function request(path, options = {}) {
  const base = getBase();
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[API] ${path}`, err.message);
    throw err;
  }
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function healthCheck() {
  return request('/health');
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function sendChat(patientId, message) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ patient_id: patientId, message }),
  });
}

// ── Voice ─────────────────────────────────────────────────────────────────────

export async function sendVoice(patientId, audioUri) {
  const base = getBase();
  const form = new FormData();
  form.append('patient_id', patientId);
  form.append('audio', { uri: audioUri, name: 'audio.m4a', type: 'audio/m4a' });
  try {
    const res = await fetch(`${base}/voice?patient_id=${patientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: form,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[API] /voice', err.message);
    throw err;
  }
}

// ── Upload Photo ──────────────────────────────────────────────────────────────

export async function uploadPhoto(patientId, imageUri, caregiverNote = '') {
  const base = getBase();
  const form = new FormData();
  form.append('patient_id',     patientId);
  form.append('caregiver_note', caregiverNote);
  form.append('photo', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' });
  try {
    const res = await fetch(
      `${base}/upload-photo?patient_id=${patientId}&caregiver_note=${encodeURIComponent(caregiverNote)}`,
      { method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: form }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[API] /upload-photo', err.message);
    throw err;
  }
}

// ── Add Memory ────────────────────────────────────────────────────────────────

export async function addMemory(patientId, content, memoryType = 'note') {
  return request('/add-memory', {
    method: 'POST',
    body: JSON.stringify({ patient_id: patientId, content, memory_type: memoryType }),
  });
}

// ── People ────────────────────────────────────────────────────────────────────

export async function getPeople(patientId) {
  return request(`/people/${patientId}`);
}

// ── Memories ──────────────────────────────────────────────────────────────────

export async function getMemories(patientId, query = 'recent') {
  return request(`/memories/${patientId}?q=${encodeURIComponent(query)}`);
}

// ── Anomaly Check ─────────────────────────────────────────────────────────────

export async function runAnomalyCheck(patientId, recentMessages) {
  const base = getBase();
  try {
    const res = await fetch(`${base}/anomaly-check?patient_id=${patientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recentMessages),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[API] /anomaly-check', err.message);
    throw err;
  }
}

// ── Session Stats (for Dashboard) ────────────────────────────────────────────

export async function getSessionStats(patientId) {
  return request(`/session-stats/${patientId}`);
}

// ── Caregiver Feedback ────────────────────────────────────────────────────────

export async function submitFeedback(sessionId, turnId, helpful) {
  return request('/feedback', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, turn_id: turnId, helpful }),
  });
}
