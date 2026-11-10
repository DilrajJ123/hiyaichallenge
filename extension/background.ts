import {
  defaultSettings,
  normaliseSettings,
  type ExtensionState,
  type ReaderSettings,
} from '../shared/settings.js';

const stateKey = (tabId: number) => `enabled:${tabId}`;
const errorKey = (tabId: number) => `error:${tabId}`;
let speechGeneration = 0;

async function settings(): Promise<ReaderSettings> {
  return normaliseSettings(
    (await chrome.storage.local.get('settings')).settings || defaultSettings,
  );
}

async function state(tabId: number): Promise<ExtensionState> {
  const tab = await chrome.tabs.get(tabId);
  const session = await chrome.storage.session.get([stateKey(tabId), errorKey(tabId)]);
  return {
    enabled: session[stateKey(tabId)] === true,
    available: /^https?:\/\//.test(tab.url || ''),
    settings: await settings(),
    error: session[errorKey(tabId)],
  };
}

function stopSpeech() {
  speechGeneration++;
  chrome.tts.stop();
}

async function setEnabled(tabId: number, enabled: boolean, preferences: ReaderSettings) {
  stopSpeech();
  if (enabled) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['reader.js'] });
    }
  }
  try {
    await chrome.storage.session.set({ [stateKey(tabId)]: enabled, [errorKey(tabId)]: '' });
    await chrome.tabs
      .sendMessage(tabId, { type: 'SET_READER', enabled, settings: preferences })
      .catch((error) => {
        if (enabled) throw error;
      });
    await chrome.action.setBadgeText({ tabId, text: enabled ? 'ON' : '' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#153e36' });
  } catch (error) {
    await chrome.storage.session.remove(stateKey(tabId));
    throw error;
  }
}

async function speak(tabId: number, text: string) {
  const generation = ++speechGeneration;
  const current = await state(tabId);
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!current.enabled || active?.id !== tabId || generation !== speechGeneration) return;
  const voices = await new Promise<chrome.tts.TtsVoice[]>((resolve) =>
    chrome.tts.getVoices(resolve),
  );
  // Explicitly select a local voice: never silently choose a remote speech engine.
  const local = voices.filter((voice) => voice.remote === false && voice.voiceName);
  const voice =
    local.find((item) => item.lang === 'en-GB') ||
    local.find((item) => item.lang?.startsWith('en')) ||
    local[0];
  if (generation !== speechGeneration) return;
  if (!voice) {
    await chrome.storage.session.set({
      [errorKey(tabId)]:
        'No local speech voice is available. Add an on-device voice in your operating system’s speech settings, then try again.',
    });
    await chrome.action.setBadgeText({ tabId, text: '!' });
    return;
  }
  chrome.tts.stop();
  const reportError = () => {
    if (generation !== speechGeneration) return;
    void chrome.storage.session.set({
      [errorKey(tabId)]:
        'Speech could not start. Check your sound output and installed local voices.',
    });
    void chrome.action.setBadgeText({ tabId, text: '!' });
  };
  chrome.tts.speak(
    text.slice(0, 800),
    {
      voiceName: voice.voiceName,
      lang: voice.lang,
      rate: current.settings.rate,
      enqueue: false,
      onEvent: (event) => {
        if (event.type === 'error') reportError();
      },
    },
    () => {
      if (chrome.runtime.lastError) reportError();
    },
  );
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === 'STOP') {
    stopSpeech();
    respond({ ok: true });
    return false;
  }
  if (
    message?.type === 'SPEAK' &&
    sender.tab?.id !== undefined &&
    typeof message.text === 'string'
  ) {
    void speak(sender.tab.id, message.text).catch(() => {});
    respond({ ok: true });
    return false;
  }
  if (sender.tab || !['GET_STATE', 'SET_ENABLED', 'SET_SETTINGS', 'REPEAT'].includes(message?.type))
    return false;
  void (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error('No active tab');
      if (message.type === 'SET_ENABLED')
        await setEnabled(tab.id, message.enabled === true, await settings());
      if (message.type === 'SET_SETTINGS') {
        const preferences = normaliseSettings(message.settings);
        await chrome.storage.local.set({ settings: preferences });
        if ((await state(tab.id)).enabled) await setEnabled(tab.id, true, preferences);
      }
      if (message.type === 'REPEAT') await chrome.tabs.sendMessage(tab.id, { type: 'REPEAT' });
      respond(await state(tab.id));
    } catch {
      respond({
        error:
          'This page cannot be read. Open a regular website, then enable PageVoice from its toolbar icon. Browser settings, the Web Store and some protected pages are unavailable.',
      });
    }
  })();
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'stop-reading') stopSpeech();
});
chrome.tabs.onActivated.addListener(() => stopSpeech());
chrome.tabs.onRemoved.addListener((tabId) => {
  stopSpeech();
  void chrome.storage.session.remove([stateKey(tabId), errorKey(tabId)]);
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') {
    stopSpeech();
    void chrome.storage.session.remove([stateKey(tabId), errorKey(tabId)]);
    void chrome.action.setBadgeText({ tabId, text: '' });
  }
});
