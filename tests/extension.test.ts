import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0];
let session: Record<string, unknown>;
let voices: chrome.tts.TtsVoice[];
let activeTab: number;
const speak = vi.fn();
const stop = vi.fn();
const tab = { id: 1, url: 'https://example.com' };
const event = <Args extends unknown[]>() => {
  let callback: (...args: Args) => void;
  return {
    addListener: vi.fn((listener: typeof callback) => {
      callback = listener;
    }),
    emit: (...args: Args) => callback(...args),
  };
};
const activated = event<Parameters<Parameters<typeof chrome.tabs.onActivated.addListener>[0]>>();
const removed = event<Parameters<Parameters<typeof chrome.tabs.onRemoved.addListener>[0]>>();
const updated = event<Parameters<Parameters<typeof chrome.tabs.onUpdated.addListener>[0]>>();
const command = event<[string]>();

beforeEach(async () => {
  vi.resetModules();
  activeTab = 1;
  session = { 'enabled:1': true };
  voices = [{ voiceName: 'Local English', lang: 'en-GB', remote: false }];
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test-extension',
      onMessage: {
        addListener: (callback: typeof listener) => {
          listener = callback;
        },
      },
    },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
      session: {
        get: vi.fn(async () => session),
        set: vi.fn(async (values: object) => Object.assign(session, values)),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete session[key];
        }),
      },
    },
    tabs: {
      get: vi.fn(async () => tab),
      query: vi.fn(async () => [{ ...tab, id: activeTab }]),
      sendMessage: vi.fn(async () => ({ ready: true })),
      onActivated: activated,
      onRemoved: removed,
      onUpdated: updated,
    },
    scripting: { executeScript: vi.fn(async () => []) },
    action: { setBadgeText: vi.fn(async () => {}), setBadgeBackgroundColor: vi.fn(async () => {}) },
    commands: { onCommand: command },
    tts: {
      stop,
      speak,
      getVoices: (callback: (result: chrome.tts.TtsVoice[]) => void) => callback(voices),
    },
  });
  await import('../extension/background.js');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function send(text: string) {
  listener(
    { type: 'SPEAK', text },
    { id: 'test-extension', tab: tab as chrome.tabs.Tab },
    () => {},
  );
}

describe('Chrome speech adapter (simulated Chrome APIs)', () => {
  it('speaks using an explicitly local voice', async () => {
    send('Search. Button.');
    await vi.waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(speak.mock.calls[0][0]).toBe('Search. Button.');
    expect(speak.mock.calls[0][1].voiceName).toBe('Local English');
  });
  it('keeps a local extension voice tied to its engine', async () => {
    voices[0].extensionId = 'local-speech-engine';
    send('Search. Button.');
    await vi.waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(speak.mock.calls[0][1].extensionId).toBe('local-speech-engine');
  });
  it('clears an earlier error when a local voice becomes available', async () => {
    session['error:1'] = 'No local speech voice is available.';
    send('Search. Button.');
    await vi.waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(session['error:1']).toBe('');
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 1, text: 'ON' });
  });
  it('refuses remote-only voices instead of uploading page text', async () => {
    voices = [{ voiceName: 'Cloud voice', lang: 'en-GB', remote: true }];
    send('Private page text');
    await vi.waitFor(() => expect(session['error:1']).toContain('No local speech voice'));
    expect(speak).not.toHaveBeenCalled();
  });
  it('does not speak when reading is disabled for the tab', async () => {
    session['enabled:1'] = false;
    send('Ignored');
    await vi.waitFor(() => expect(chrome.tabs.query).toHaveBeenCalled());
    expect(speak).not.toHaveBeenCalled();
  });
  it('ignores messages from a different extension', () => {
    listener(
      { type: 'SPEAK', text: 'Ignored' },
      { id: 'unrelated-extension', tab: tab as chrome.tabs.Tab },
      () => {},
    );
    expect(chrome.storage.session.get).not.toHaveBeenCalled();
  });
  it('discards a delayed utterance after Stop', async () => {
    let resolveVoices: ((result: chrome.tts.TtsVoice[]) => void) | undefined;
    chrome.tts.getVoices = vi.fn((callback) => {
      resolveVoices = callback;
    }) as unknown as typeof chrome.tts.getVoices;
    send('Do not speak this');
    await vi.waitFor(() => expect(resolveVoices).toBeDefined());
    listener({ type: 'STOP' }, { id: 'test-extension' }, () => {});
    resolveVoices!(voices);
    await Promise.resolve();
    expect(speak).not.toHaveBeenCalled();
  });
  it('forwards popup Stop to cancel the pending page timer', async () => {
    listener({ type: 'STOP' }, { id: 'test-extension' }, () => {});
    await vi.waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'STOP_READER' }),
    );
    expect(stop).toHaveBeenCalled();
  });
  it('does not bounce a page Stop message back to the page', () => {
    listener({ type: 'STOP' }, { id: 'test-extension', tab: tab as chrome.tabs.Tab }, () => {});
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('stops delayed speech on a tab switch and allows fresh speech after returning', async () => {
    let resolveVoices: ((result: chrome.tts.TtsVoice[]) => void) | undefined;
    chrome.tts.getVoices = vi.fn((callback) => {
      resolveVoices = callback;
    }) as unknown as typeof chrome.tts.getVoices;
    send('Old tab reading');
    await vi.waitFor(() => expect(resolveVoices).toBeDefined());
    activeTab = 2;
    activated.emit({ tabId: 2, windowId: 1 });
    expect(stop).toHaveBeenCalledOnce();
    resolveVoices!(voices);
    await Promise.resolve();
    expect(speak).not.toHaveBeenCalled();

    activeTab = 1;
    activated.emit({ tabId: 1, windowId: 1 });
    chrome.tts.getVoices = vi.fn((callback) =>
      callback(voices),
    ) as unknown as typeof chrome.tts.getVoices;
    send('Fresh reading');
    await vi.waitFor(() => expect(speak).toHaveBeenCalledOnce());
    expect(speak.mock.calls[0][0]).toBe('Fresh reading');
  });
  it.each([
    ['reload or navigation', () => updated.emit(1, { status: 'loading' }, tab as chrome.tabs.Tab)],
    ['tab closure', () => removed.emit(1, { windowId: 1, isWindowClosing: false })],
  ])('clears reading permission and cancels pending speech after %s', async (_name, leavePage) => {
    let resolveVoices: ((result: chrome.tts.TtsVoice[]) => void) | undefined;
    chrome.tts.getVoices = vi.fn((callback) => {
      resolveVoices = callback;
    }) as unknown as typeof chrome.tts.getVoices;
    send('Old page reading');
    await vi.waitFor(() => expect(resolveVoices).toBeDefined());
    leavePage();
    expect(stop).toHaveBeenCalledOnce();
    resolveVoices!(voices);
    await Promise.resolve();
    expect(speak).not.toHaveBeenCalled();

    const result = await new Promise((resolve) => {
      listener({ type: 'GET_STATE' }, { id: 'test-extension' }, resolve);
    });
    expect(result).toHaveProperty('enabled', false);
  });
  it('the stop shortcut cancels playback and the pending page reading', async () => {
    send('Current reading');
    await vi.waitFor(() => expect(speak).toHaveBeenCalledOnce());
    stop.mockClear();
    command.emit('stop-reading');
    await vi.waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'STOP_READER' }),
    );
    expect(stop).toHaveBeenCalledOnce();
  });
  it('updates settings without replacing the reader and losing Repeat', async () => {
    const result = await new Promise((resolve) => {
      listener(
        { type: 'SET_SETTINGS', settings: { rate: 1.5 } },
        { id: 'test-extension' },
        resolve,
      );
    });
    expect(result).toHaveProperty('enabled', true);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'UPDATE_SETTINGS',
      settings: { rate: 1.5, delay: 350, textMode: 'sentence', readOnFocus: true },
    });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });
  it('keeps previously enabled tabs in sync with global reading preferences', async () => {
    session['enabled:2'] = true;
    session['enabled:3'] = false;
    await new Promise((resolve) => {
      listener(
        { type: 'SET_SETTINGS', settings: { textMode: 'word' } },
        { id: 'test-extension' },
        resolve,
      );
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        type: 'UPDATE_SETTINGS',
        settings: expect.objectContaining({ textMode: 'word' }),
      }),
    );
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: 'UPDATE_SETTINGS',
        settings: expect.objectContaining({ textMode: 'word' }),
      }),
    );
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });
});
