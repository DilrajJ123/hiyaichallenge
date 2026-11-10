import { createHoverReader } from '../../src/lib/hoverReader.js';
import { normaliseSettings, type ReaderSettings } from '../../shared/settings.js';

const scope = globalThis as typeof globalThis & { __pageVoiceInstalled?: boolean };
if (!scope.__pageVoiceInstalled) {
  scope.__pageVoiceInstalled = true;
  let reader: ReturnType<typeof createHoverReader> | undefined;
  const send = (message: object) => {
    void chrome.runtime.sendMessage(message).catch(() => {});
  };
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message?.type === 'PING') {
      respond({ ready: true });
      return false;
    }
    if (message?.type === 'SET_READER') {
      reader?.dispose();
      reader = undefined;
      if (message.enabled) {
        const settings = normaliseSettings(message.settings as Partial<ReaderSettings>);
        reader = createHoverReader(
          document,
          {
            speak: (text) => send({ type: 'SPEAK', text }),
            stop: () => send({ type: 'STOP' }),
          },
          settings,
        );
      }
      respond({ ready: true });
    }
    if (message?.type === 'REPEAT') {
      reader?.repeat();
      respond({ ready: true });
    }
    return false;
  });
}
