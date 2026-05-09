/**
 * useTranslation.js — React hook for live i18n
 * Triggers re-render when language changes
 */
import { useState, useEffect } from 'react';
import { t as translate, onLanguageChange, getLanguage } from './i18n';

export default function useTranslation() {
  const [lang, setLang] = useState(getLanguage());

  useEffect(() => {
    const unsub = onLanguageChange(setLang);
    return unsub;
  }, []);

  // Reference `lang` to ensure re-render on language change
  return { t: translate, lang };
}
