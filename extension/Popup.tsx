import { useCallback, useEffect, useRef, useState } from 'react';
import { Waves } from 'lucide-react';
import { ReaderControls } from '../src/components/ReaderControls.js';
import { defaultSettings, type ExtensionState } from '../shared/settings.js';

export function Popup() {
  const [state, setState] = useState<ExtensionState>({
    enabled: false,
    available: false,
    settings: defaultSettings,
  });
  const [busy, setBusy] = useState(true);
  const mounted = useRef(false);
  const version = useRef(0);
  const pendingAction = useRef<number | null>(null);
  const pendingRefresh = useRef<number | null>(null);
  const refreshQueued = useRef(false);

  const request = useCallback(async (message: object, foreground = true): Promise<void> => {
    if (!mounted.current) return;
    // Storage updates can arrive during an action. Refresh afterwards so an older
    // state response cannot overwrite the user's most recent change.
    if (!foreground && (pendingAction.current !== null || pendingRefresh.current !== null)) {
      refreshQueued.current = true;
      return;
    }
    const id = ++version.current;
    if (foreground) {
      pendingAction.current = id;
      setBusy(true);
    } else pendingRefresh.current = id;
    try {
      const result: ExtensionState | undefined = await chrome.runtime.sendMessage(message);
      if (!mounted.current || id !== version.current) return;
      if (!result?.settings)
        setState((previous) => ({
          ...previous,
          error: result?.error || 'Could not connect to this page.',
        }));
      else setState(result);
    } catch {
      if (mounted.current && id === version.current)
        setState((previous) => ({ ...previous, error: 'Reload the extension and try again.' }));
    } finally {
      if (foreground && pendingAction.current === id) {
        pendingAction.current = null;
        if (mounted.current) setBusy(false);
      }
      if (!foreground && pendingRefresh.current === id) pendingRefresh.current = null;
      if (
        mounted.current &&
        pendingAction.current === null &&
        pendingRefresh.current === null &&
        refreshQueued.current
      ) {
        refreshQueued.current = false;
        void request({ type: 'GET_STATE' }, false);
      }
    }
  }, []);

  const stop = useCallback(() => {
    void chrome.runtime.sendMessage({ type: 'STOP' }).catch(() => {
      if (mounted.current)
        setState((previous) => ({ ...previous, error: 'Reload the extension and try again.' }));
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const relevant =
        (area === 'local' && 'settings' in changes) ||
        (area === 'session' && Object.keys(changes).some((key) => /^(enabled|error):/.test(key)));
      if (relevant) void request({ type: 'GET_STATE' }, false);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
    };
    chrome.storage.onChanged.addListener(changed);
    window.addEventListener('keydown', keyDown);
    void request({ type: 'GET_STATE' });
    return () => {
      mounted.current = false;
      version.current++;
      pendingAction.current = null;
      pendingRefresh.current = null;
      refreshQueued.current = false;
      chrome.storage.onChanged.removeListener(changed);
      window.removeEventListener('keydown', keyDown);
    };
  }, [request, stop]);

  return (
    <main className="popup-root">
      <div className="popup-brand">
        <Waves size={23} aria-hidden="true" />
        <span>pagevoice.</span>
      </div>
      <ReaderControls
        compact
        enabled={state.enabled}
        settings={state.settings}
        available={state.available || busy}
        error={state.error}
        busy={busy}
        onToggle={() => void request({ type: 'SET_ENABLED', enabled: !state.enabled })}
        onSettings={(settings) => void request({ type: 'SET_SETTINGS', settings })}
        onStop={stop}
        onRepeat={() => void request({ type: 'REPEAT' })}
      />
      <p className="popup-help">
        Close this popup and hover over the page. Reading turns off when the page reloads or
        navigates.
      </p>
      <p className="popup-shortcut">
        Stop while Chrome is focused: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
      </p>
    </main>
  );
}
