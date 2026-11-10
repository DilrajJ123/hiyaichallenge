import { useEffect, useRef, useState } from 'react';
import { defaultSettings, type ReaderSettings } from '../../shared/settings.js';
import { createHoverReader } from '../lib/hoverReader.js';

export function usePreviewReader() {
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [lastRead, setLastRead] = useState('Move over the sample below to hear what is there.');
  const [error, setError] = useState('');
  const readerRef = useRef<ReturnType<typeof createHoverReader> | null>(null);
  const settingsRef = useRef(settings);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const generation = useRef(0);
  settingsRef.current = settings;
  const stopSpeech = () => {
    generation.current++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    utteranceRef.current = null;
  };
  const speak = (text: string) => {
    stopSpeech();
    setLastRead(text);
    setError('');
    if (!('speechSynthesis' in window)) {
      setError('Speech is not available in this preview browser. Try the extension in Chrome.');
      return;
    }
    const voices = window.speechSynthesis.getVoices().filter((voice) => voice.localService);
    const voice =
      voices.find((item) => item.lang === 'en-GB') ||
      voices.find((item) => item.lang.startsWith('en')) ||
      voices[0];
    if (!voice) {
      setError(
        'No local voice is available yet. Try turning reading off and on, or use Chrome with an installed local speech voice.',
      );
      return;
    }
    const id = generation.current;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = settingsRef.current.rate;
    utterance.onerror = (event) => {
      if (id === generation.current && event.error !== 'interrupted' && event.error !== 'canceled')
        setError(
          'Audio could not start. Activate Turn off reading, then Turn on reading, and check your sound output.',
        );
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };
  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const reader = createHoverReader(document, { speak, stop: stopSpeech }, settingsRef.current);
    readerRef.current = reader;
    return () => {
      reader.dispose();
      readerRef.current = null;
    };
    // The listener lifetime follows the enabled state; settings are updated separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  useEffect(() => readerRef.current?.update(settings), [settings]);
  const toggle = () => {
    if (enabled) {
      readerRef.current?.dispose();
      setEnabled(false);
      setError('');
    } else {
      setEnabled(true);
      speak('Hover reading is on. Move over the sample text or a button.');
    }
  };
  return {
    enabled,
    settings,
    setSettings,
    lastRead,
    error,
    toggle,
    stop: () => readerRef.current?.stop(),
    repeat: () => readerRef.current?.repeat(),
  };
}
