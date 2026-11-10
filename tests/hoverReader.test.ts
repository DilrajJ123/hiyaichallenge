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
const hoverElement = (target: Element) =>
  target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 10 }));
const hover = (index: number) => hoverElement(document.querySelectorAll('button')[index]);

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
  it('announces different controls even when their labels are identical', () => {
    document.body.innerHTML = '<button>Save</button><button>Save</button>';
    hover(0);
    vi.advanceTimersByTime(350);
    hover(1);
    vi.advanceTimersByTime(350);
    expect(output.speak.mock.calls).toEqual([['Save. Button.'], ['Save. Button.']]);
  });
  it('treats a button and its nested icon as the same target', () => {
    document.body.innerHTML =
      '<button aria-label="Search"><svg aria-hidden="true"><path /></svg><span>Search</span></button>';
    hoverElement(document.querySelector('path')!);
    vi.advanceTimersByTime(350);
    hoverElement(document.querySelector('span')!);
    vi.advanceTimersByTime(350);
    hover(0);
    vi.advanceTimersByTime(350);
    expect(output.speak.mock.calls).toEqual([['Search. Button.']]);
  });
  it('does not repeat when moving from a field label onto the field', () => {
    document.body.innerHTML = '<label for="search">Search</label><input id="search">';
    hoverElement(document.querySelector('label')!);
    vi.advanceTimersByTime(350);
    hoverElement(document.querySelector('input')!);
    vi.advanceTimersByTime(350);
    expect(output.speak.mock.calls).toEqual([['Search. Text field.']]);
  });
  it('reads a target again after moving away and returning without waiting elsewhere', () => {
    hover(0);
    vi.advanceTimersByTime(350);
    hoverElement(document.body);
    vi.advanceTimersByTime(50);
    hover(0);
    vi.advanceTimersByTime(350);
    expect(output.speak.mock.calls).toEqual([['First. Button.'], ['First. Button.']]);
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
  it('allows the same target to be read after Stop and a new movement', () => {
    hover(0);
    vi.advanceTimersByTime(350);
    reader.stop();
    hover(0);
    vi.advanceTimersByTime(350);
    expect(output.speak.mock.calls).toEqual([['First. Button.'], ['First. Button.']]);
  });
  it('repeats the last reading and cancels a pending different target', () => {
    hover(0);
    vi.advanceTimersByTime(350);
    hover(1);
    reader.repeat();
    vi.advanceTimersByTime(350);
    expect(output.speak.mock.calls).toEqual([['First. Button.'], ['First. Button.']]);
  });
  it('does not speak a hovered target removed before the delay ends', () => {
    hover(0);
    document.querySelector('button')!.remove();
    vi.advanceTimersByTime(350);
    expect(output.speak).not.toHaveBeenCalled();
  });
  it('cancels a focus announcement when focus leaves before the delay ends', () => {
    const button = document.querySelector('button')!;
    button.focus();
    button.blur();
    vi.advanceTimersByTime(80);
    expect(output.speak).not.toHaveBeenCalled();
  });
  it('cleans up listeners when disabled', () => {
    reader.dispose();
    hover(0);
    vi.advanceTimersByTime(500);
    expect(output.speak).not.toHaveBeenCalled();
  });
  it('keeps a disposed reader silent even if old controls call its methods', () => {
    hover(0);
    vi.advanceTimersByTime(350);
    reader.dispose();
    output.speak.mockClear();
    output.stop.mockClear();
    reader.repeat();
    reader.update({ ...defaultSettings, rate: 1.5 });
    reader.stop();
    reader.dispose();
    hover(1);
    vi.advanceTimersByTime(350);
    expect(output.speak).not.toHaveBeenCalled();
    expect(output.stop).not.toHaveBeenCalled();
  });
});
