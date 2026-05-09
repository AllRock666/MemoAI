/**
 * settings.js — Persistent settings store using AsyncStorage
 * Module-level state + listener pattern for live updates across screens
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLanguage } from './i18n';

const KEYS = {
  LANGUAGE:    'memoai_language',
  PATIENT_ID:  'memoai_patient_id',
  BACKEND_URL: 'memoai_backend_url',
};

const defaults = {
  language:   'en',
  patientId:  'demo',
  backendUrl: 'http://localhost:8080',
};

let state = { ...defaults };
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn({ ...state }));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

export function getSettings() {
  return { ...state };
}

export async function loadSettings() {
  try {
    const [lang, pid, url] = await Promise.all([
      AsyncStorage.getItem(KEYS.LANGUAGE),
      AsyncStorage.getItem(KEYS.PATIENT_ID),
      AsyncStorage.getItem(KEYS.BACKEND_URL),
    ]);
    if (lang) state.language   = lang;
    if (pid)  state.patientId  = pid;
    if (url)  state.backendUrl = url;
    setLanguage(state.language);
    notify();
  } catch (e) {
    console.warn('[settings] loadSettings error:', e);
  }
}

export async function saveSettings({ language, patientId, backendUrl }) {
  try {
    state = { language, patientId, backendUrl };
    await Promise.all([
      AsyncStorage.setItem(KEYS.LANGUAGE,    language),
      AsyncStorage.setItem(KEYS.PATIENT_ID,  patientId),
      AsyncStorage.setItem(KEYS.BACKEND_URL, backendUrl),
    ]);
    setLanguage(language);
    notify();
  } catch (e) {
    console.warn('[settings] saveSettings error:', e);
  }
}
