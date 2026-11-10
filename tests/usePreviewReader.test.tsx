// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviewReader } from '../src/hooks/usePreviewReader.js';

class FakeUtterance {
  constructor(public text: string) {}
  voice: SpeechSynthesisVoice | null = null;
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
}

const localVoice = {
  voiceURI: 'local-english',
  name: 'Local English',
  lang: 'en-GB',
  localService: true,
  default: true,
} satisfies SpeechSynthesisVoice;
let voices: SpeechSynthesisVoice[];
let events: EventTarget;
const speak = vi.fn<(utterance: FakeUtterance) => void>();
const cancel = vi.fn();
const removeListener = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  voices = [localVoice];
  events = new EventTarget();
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voices,
    speak,
    cancel,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: removeListener.mockImplementation(events.removeEventListener.bind(events)),
  });
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const announceVoices = () => act(() => events.dispatchEvent(new Event('voiceschanged')));

describe('preview speech lifecycle (simulated browser speech)', () => {
  it('starts once when a local voice arrives after enabling', () => {
    voices = [];
    const { result } = renderHook(usePreviewReader);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(speak).not.toHaveBeenCalled();
    voices = [localVoice];
    announceVoices();
    announceVoices();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].voice).toBe(localVoice);
    expect(speak.mock.calls[0][0].text).toContain('Hover reading is on');
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.error).toBe('');
    expect(removeListener).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
  });

  it('reports unavailable local voices without choosing a remote voice', () => {
    voices = [{ ...localVoice, localService: false }];
    const { result } = renderHook(usePreviewReader);
    act(() => result.current.toggle());
    act(() => vi.advanceTimersByTime(2000));
    expect(speak).not.toHaveBeenCalled();
    expect(result.current.error).toContain('No local speech voice');
    voices = [localVoice];
    announceVoices();
    expect(speak).not.toHaveBeenCalled();
    act(() => result.current.repeat());
    expect(speak).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('');
  });

  it('Stop cancels a pending voice wait and prevents delayed playback', () => {
    voices = [];
    const { result } = renderHook(usePreviewReader);
    act(() => result.current.toggle());
    act(() => result.current.stop());
    voices = [localVoice];
    announceVoices();
    act(() => vi.advanceTimersByTime(2500));
    expect(speak).not.toHaveBeenCalled();
    expect(result.current.error).toBe('');
    expect(cancel).toHaveBeenCalled();
  });

  it('disabling prevents pending playback and Repeat', () => {
    voices = [];
    const { result } = renderHook(usePreviewReader);
    act(() => result.current.toggle());
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    voices = [localVoice];
    announceVoices();
    act(() => result.current.repeat());
    act(() => vi.advanceTimersByTime(2500));
    expect(speak).not.toHaveBeenCalled();
  });

  it('unmount cancels speech and unregisters the pending voice listener', () => {
    voices = [];
    const { result, unmount } = renderHook(usePreviewReader);
    act(() => result.current.toggle());
    const cancelCount = cancel.mock.calls.length;
    unmount();
    voices = [localVoice];
    announceVoices();
    act(() => vi.advanceTimersByTime(2500));
    expect(speak).not.toHaveBeenCalled();
    expect(cancel.mock.calls.length).toBeGreaterThan(cancelCount);
    expect(removeListener).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
  });

  it('repeats the welcome message and the last control at the latest speed', () => {
    const { result } = renderHook(usePreviewReader);
    act(() => result.current.toggle());
    const welcome = speak.mock.calls[0][0].text;
    act(() => result.current.setSettings({ ...result.current.settings, rate: 1.5 }));
    act(() => result.current.repeat());
    expect(speak.mock.calls[1][0]).toMatchObject({ text: welcome, rate: 1.5 });
    const button = document.createElement('button');
    button.textContent = 'Find events';
    document.body.append(button);
    act(() => {
      button.focus();
      vi.advanceTimersByTime(80);
    });
    expect(result.current.lastRead).toBe('Find events. Button.');
    act(() => result.current.stop());
    act(() => result.current.repeat());
    expect(speak.mock.calls.at(-1)![0]).toMatchObject({ text: 'Find events. Button.', rate: 1.5 });
  });

  it('ignores errors from an utterance that was stopped', () => {
    const { result } = renderHook(usePreviewReader);
    act(() => result.current.toggle());
    const utterance = speak.mock.calls[0][0];
    act(() => result.current.stop());
    act(() => utterance.onerror?.({ error: 'audio-busy' }));
    expect(result.current.error).toBe('');
  });

  it('replaces a pending reading when a newer target is announced', () => {
    voices = [];
    const { result } = renderHook(usePreviewReader);
    act(() => result.current.toggle());
    const button = document.createElement('button');
    button.textContent = 'Save';
    document.body.append(button);
    act(() => {
      button.focus();
      vi.advanceTimersByTime(80);
    });
    voices = [localVoice];
    announceVoices();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toBe('Save. Button.');
  });
});
