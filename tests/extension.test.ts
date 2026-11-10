import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0];
let session: Record<string, unknown>;
let voices: chrome.tts.TtsVoice[];
const speak = vi.fn();
const stop = vi.fn();
const tab = { id: 1, url: 'https://example.com' };
const event = () => ({ addListener: vi.fn() });

beforeEach(async () => {
  vi.resetModules();
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
        remove: vi.fn(async () => {}),
      },
    },
    tabs: {
      get: vi.fn(async () => tab),
      query: vi.fn(async () => [tab]),
      sendMessage: vi.fn(async () => ({ ready: true })),
      onActivated: event(),
      onRemoved: event(),
      onUpdated: event(),
    },
    scripting: { executeScript: vi.fn(async () => []) },
    action: { setBadgeText: vi.fn(async () => {}), setBadgeBackgroundColor: vi.fn(async () => {}) },
    commands: { onCommand: event() },
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
});
