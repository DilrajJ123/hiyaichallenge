// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../shared/settings.js';

let listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0];
const scope = globalThis as typeof globalThis & { __pageVoiceInstalled?: boolean };
const send = vi.fn(async () => ({ ok: true }));
const request = (message: object) => listener(message, { id: 'test-extension' }, () => {});
const hover = () =>
  document
    .querySelector('button')!
    .dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 10 }));

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  delete scope.__pageVoiceInstalled;
  document.body.innerHTML = '<button>Read me</button>';
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test-extension',
      sendMessage: send,
      onMessage: {
        addListener: (callback: typeof listener) => {
          listener = callback;
        },
      },
    },
  });
  await import('../extension/content/reader.js');
});

afterEach(() => {
  request({ type: 'SET_READER', enabled: false });
  delete scope.__pageVoiceInstalled;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('injected reader with the real hover engine', () => {
  it('stays silent until explicitly enabled', () => {
    hover();
    vi.advanceTimersByTime(1000);
    expect(send).not.toHaveBeenCalled();
  });
  it('cancels a queued reading when the popup sends Stop', () => {
    request({ type: 'SET_READER', enabled: true, settings: defaultSettings });
    hover();
    vi.advanceTimersByTime(200);
    request({ type: 'STOP_READER' });
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledWith({ type: 'STOP' });
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SPEAK' }));
  });
  it('can repeat the last item after a settings change', () => {
    request({ type: 'SET_READER', enabled: true, settings: defaultSettings });
    hover();
    vi.advanceTimersByTime(350);
    expect(send).toHaveBeenCalledWith({ type: 'SPEAK', text: 'Read me. Button.' });
    send.mockClear();
    request({ type: 'UPDATE_SETTINGS', settings: { ...defaultSettings, rate: 1.5 } });
    request({ type: 'REPEAT' });
    expect(send).toHaveBeenCalledWith({ type: 'SPEAK', text: 'Read me. Button.' });
  });
  it('cannot repeat or start another reading after being disabled', () => {
    request({ type: 'SET_READER', enabled: true, settings: defaultSettings });
    hover();
    vi.advanceTimersByTime(350);
    request({ type: 'SET_READER', enabled: false });
    send.mockClear();
    request({ type: 'REPEAT' });
    hover();
    vi.advanceTimersByTime(1000);
    expect(send).not.toHaveBeenCalled();
  });
});
