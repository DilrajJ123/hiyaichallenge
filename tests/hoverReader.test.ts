// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHoverReader } from '../src/lib/hoverReader.js';
import { defaultSettings } from '../shared/settings.js';

let reader: ReturnType<typeof createHoverReader>;
const output = { speak: vi.fn(), stop: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button>First</button><button>Second</button>';
  reader = createHoverReader(document, output, defaultSettings);
});
afterEach(() => {
  reader.dispose();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.clearAllMocks();
});
const hover = (index: number) =>
  document
    .querySelectorAll('button')
    [index].dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 10 }),
    );

describe('hover reader behaviour', () => {
  it('waits before speaking and reads the most recent target', () => {
    hover(0);
    vi.advanceTimersByTime(200);
    hover(1);
    vi.advanceTimersByTime(349);
    expect(output.speak).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(output.speak).toHaveBeenCalledWith('Second. Button.');
  });
  it('does not repeat the same description on every pointer movement', () => {
    hover(0);
    vi.advanceTimersByTime(350);
    hover(0);
    vi.advanceTimersByTime(350);
    expect(output.speak).toHaveBeenCalledTimes(1);
  });
  it('reads controls reached using keyboard focus', () => {
    document.querySelector('button')!.focus();
    vi.advanceTimersByTime(80);
    expect(output.speak).toHaveBeenCalledWith('First. Button.');
  });
  it('cancels pending speech on Escape', () => {
    hover(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(500);
    expect(output.speak).not.toHaveBeenCalled();
    expect(output.stop).toHaveBeenCalled();
  });
  it('cleans up listeners when disabled', () => {
    reader.dispose();
    hover(0);
    vi.advanceTimersByTime(500);
    expect(output.speak).not.toHaveBeenCalled();
  });
});
