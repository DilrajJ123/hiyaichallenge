import type { ReaderSettings } from '../../shared/settings.js';
import { describeAtPoint, describeFocused } from './describeElement.js';

export interface SpeechOutput {
  speak(text: string): void;
  stop(): void;
}

export function createHoverReader(root: Document, output: SpeechOutput, initial: ReaderSettings) {
  let settings = initial;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let lastSpoken = '';
  let suppressed = false;
  const cancelPending = () => {
    clearTimeout(pending);
    pending = undefined;
  };
  const speak = (text: string) => {
    if (!text || text === lastSpoken || suppressed) return;
    lastSpoken = text;
    output.speak(text);
  };
  const pointerMove = (event: PointerEvent) => {
    if (!(event.target instanceof Element) || event.pointerType === 'touch') return;
    cancelPending();
    suppressed = false;
    const target = event.target;
    const x = event.clientX;
    const y = event.clientY;
    pending = setTimeout(
      () => speak(describeAtPoint(target, x, y, settings.textMode)),
      settings.delay,
    );
  };
  const focusIn = (event: FocusEvent) => {
    if (!settings.readOnFocus || !(event.target instanceof Element)) return;
    cancelPending();
    suppressed = false;
    const target = event.target;
    pending = setTimeout(() => speak(describeFocused(target)), 80);
  };
  const stop = () => {
    cancelPending();
    suppressed = true;
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
  root.addEventListener('keydown', keyDown);
  root.addEventListener('visibilitychange', visibility);
  root.documentElement.addEventListener('pointerleave', stop);
  return {
    stop,
    repeat: () => {
      cancelPending();
      if (lastSpoken) output.speak(lastSpoken);
    },
    update: (next: ReaderSettings) => {
      settings = next;
      cancelPending();
    },
    dispose: () => {
      stop();
      root.removeEventListener('pointermove', pointerMove);
      root.removeEventListener('focusin', focusIn);
      root.removeEventListener('keydown', keyDown);
      root.removeEventListener('visibilitychange', visibility);
      root.documentElement.removeEventListener('pointerleave', stop);
    },
  };
}
