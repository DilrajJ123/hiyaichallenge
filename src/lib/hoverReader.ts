import type { ReaderSettings } from '../../shared/settings.js';
import { describeAtPoint, describeFocused, readingTarget } from './describeElement.js';

export interface SpeechOutput {
  speak(text: string): void;
  stop(): void;
}

export function createHoverReader(root: Document, output: SpeechOutput, initial: ReaderSettings) {
  let settings = initial;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let pendingKind: 'pointer' | 'focus' | undefined;
  let lastSpoken = '';
  let activeTarget: Element | null = null;
  let activeDescription = '';
  let disposed = false;
  const cancelPending = () => {
    clearTimeout(pending);
    pending = undefined;
    pendingKind = undefined;
  };
  const selectTarget = (element: Element) => {
    // Track the element as well as its words: two buttons may have the same label.
    const target = readingTarget(element);
    if (activeTarget !== target) {
      activeTarget = target;
      activeDescription = '';
    }
    return target;
  };
  const speak = (target: Element, text: string) => {
    if (
      disposed ||
      root.hidden ||
      !root.documentElement.contains(target) ||
      activeTarget !== target
    )
      return;
    if (!text) {
      activeDescription = '';
      return;
    }
    if (text === activeDescription) return;
    activeDescription = text;
    lastSpoken = text;
    output.speak(text);
  };
  const pointerMove = (event: PointerEvent) => {
    if (disposed || !(event.target instanceof Element) || event.pointerType === 'touch') return;
    // Restart the delay while the pointer moves; only read after it settles.
    cancelPending();
    const target = selectTarget(event.target);
    const x = event.clientX;
    const y = event.clientY;
    pendingKind = 'pointer';
    pending = setTimeout(() => {
      pending = undefined;
      pendingKind = undefined;
      speak(target, describeAtPoint(target, x, y, settings.textMode));
    }, settings.delay);
  };
  const focusIn = (event: FocusEvent) => {
    if (disposed || !settings.readOnFocus || !(event.target instanceof Element)) return;
    cancelPending();
    const target = selectTarget(event.target);
    pendingKind = 'focus';
    pending = setTimeout(() => {
      pending = undefined;
      pendingKind = undefined;
      speak(target, describeFocused(target));
    }, 80);
  };
  const focusOut = (event: FocusEvent) => {
    if (!settings.readOnFocus || !(event.target instanceof Element)) return;
    if (pendingKind === 'focus') cancelPending();
    if (activeTarget === readingTarget(event.target)) {
      activeTarget = null;
      activeDescription = '';
    }
  };
  const stop = () => {
    if (disposed) return;
    cancelPending();
    activeTarget = null;
    activeDescription = '';
    output.stop();
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') stop();
  };
  const visibility = () => {
    if (root.hidden) stop();
  };
  root.addEventListener('pointermove', pointerMove, { passive: true });
  root.addEventListener('focusin', focusIn);
  root.addEventListener('focusout', focusOut);
  root.addEventListener('keydown', keyDown);
  root.addEventListener('visibilitychange', visibility);
  root.documentElement.addEventListener('pointerleave', stop);
  return {
    stop,
    repeat: () => {
      if (disposed || root.hidden) return;
      cancelPending();
      if (lastSpoken) output.speak(lastSpoken);
    },
    update: (next: ReaderSettings) => {
      if (disposed) return;
      settings = next;
      cancelPending();
      activeDescription = '';
    },
    dispose: () => {
      if (disposed) return;
      stop();
      disposed = true;
      lastSpoken = '';
      root.removeEventListener('pointermove', pointerMove);
      root.removeEventListener('focusin', focusIn);
      root.removeEventListener('focusout', focusOut);
      root.removeEventListener('keydown', keyDown);
      root.removeEventListener('visibilitychange', visibility);
      root.documentElement.removeEventListener('pointerleave', stop);
    },
  };
}
