import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultSettings, type ReaderSettings } from '../../shared/settings.js';
import { createHoverReader } from '../lib/hoverReader.js';

const welcome = 'Hover reading is on. Move over the sample text or a button.';
const playbackError =
  'Audio could not start. Turn reading off and on, and check your sound output.';

export function usePreviewReader() {
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [lastRead, setLastRead] = useState('Move over the sample below to hear what is there.');
  const [error, setError] = useState('');
  const enabledRef = useRef(false);
  const readerRef = useRef<ReturnType<typeof createHoverReader> | null>(null);
  const settingsRef = useRef(settings);
  const lastSpokenRef = useRef('');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelVoiceWaitRef = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  settingsRef.current = settings;

  const stopSpeech = useCallback(() => {
    generation.current++;
    cancelVoiceWaitRef.current?.();
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabledRef.current) return;
      stopSpeech();
      lastSpokenRef.current = text;
      setLastRead(text);
      setError('');
      const synthesis = window.speechSynthesis;
      if (!synthesis || typeof SpeechSynthesisUtterance === 'undefined') {
        setError('Speech is not available in this preview browser. Try the extension in Chrome.');
        return;
      }
      const id = generation.current;
      let timeout: ReturnType<typeof setTimeout>;
      const clearVoiceWait = () => {
        clearTimeout(timeout);
        synthesis.removeEventListener('voiceschanged', startWhenReady);
        if (cancelVoiceWaitRef.current === clearVoiceWait) cancelVoiceWaitRef.current = null;
      };
      const startWhenReady = () => {
        if (id !== generation.current || !enabledRef.current) return;
        const voices = synthesis.getVoices().filter((voice) => voice.localService === true);
        const voice =
          voices.find((item) => item.lang === 'en-GB') ||
          voices.find((item) => item.lang.startsWith('en')) ||
          voices[0];
        if (!voice) return;
        clearVoiceWait();
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = voice;
          utterance.lang = voice.lang;
          utterance.rate = settingsRef.current.rate;
          utterance.onend = () => {
            if (id === generation.current) utteranceRef.current = null;
          };
          utterance.onerror = (event) => {
            if (id !== generation.current) return;
            utteranceRef.current = null;
            if (event.error !== 'interrupted' && event.error !== 'canceled')
              setError(playbackError);
          };
          utteranceRef.current = utterance;
          synthesis.speak(utterance);
        } catch {
          utteranceRef.current = null;
          setError(playbackError);
        }
      };
      // Some browsers populate voices after the first user interaction. Keep only
      // this reading pending, and remove the listener on success, Stop or timeout.
      synthesis.addEventListener('voiceschanged', startWhenReady);
      cancelVoiceWaitRef.current = clearVoiceWait;
      timeout = setTimeout(() => {
        clearVoiceWait();
        if (id === generation.current && enabledRef.current)
          setError(
            'No local speech voice is available. Install an on-device voice in your operating system, then choose Repeat last or try the extension in Chrome.',
          );
      }, 2000);
      startWhenReady();
    },
    [stopSpeech],
  );

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => {
      enabledRef.current = false;
      stopSpeech();
    };
  }, [stopSpeech]);

  useEffect(() => {
    if (!enabled) return;
    const reader = createHoverReader(document, { speak, stop: stopSpeech }, settingsRef.current);
    readerRef.current = reader;
    return () => {
      reader.dispose();
      readerRef.current = null;
    };
  }, [enabled, speak, stopSpeech]);

  useEffect(() => readerRef.current?.update(settings), [settings]);

  const stop = useCallback(() => {
    if (readerRef.current) readerRef.current.stop();
    else stopSpeech();
  }, [stopSpeech]);

  const toggle = useCallback(() => {
    if (enabledRef.current) {
      enabledRef.current = false;
      stop();
      setEnabled(false);
      setError('');
    } else {
      enabledRef.current = true;
      setEnabled(true);
      speak(welcome);
    }
  }, [speak, stop]);

  const repeat = useCallback(() => {
    if (!enabledRef.current || !lastSpokenRef.current) return;
    stop();
    speak(lastSpokenRef.current);
  }, [speak, stop]);

  return { enabled, settings, setSettings, lastRead, error, toggle, stop, repeat };
}
