import { useEffect, useState } from 'react';
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
  async function request(message: object) {
    setBusy(true);
    try {
      const result: ExtensionState = await chrome.runtime.sendMessage(message);
      if (!result.settings)
        setState((previous) => ({
          ...previous,
          error: result.error || 'Could not connect to this page.',
        }));
      else setState(result);
    } catch {
      setState((previous) => ({ ...previous, error: 'Reload the extension and try again.' }));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void request({ type: 'GET_STATE' });
  }, []);
  useEffect(() => {
    const stop = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void chrome.runtime.sendMessage({ type: 'STOP' });
    };
    window.addEventListener('keydown', stop);
    return () => window.removeEventListener('keydown', stop);
  }, []);
  return (
    <main className="popup-root">
      <div className="popup-brand">
        <Waves size={23} aria-hidden="true" />
        <span>pagevoice.</span>
      </div>
      <ReaderControls
        enabled={state.enabled}
        settings={state.settings}
        available={state.available}
        error={state.error}
        busy={busy}
        onToggle={() => void request({ type: 'SET_ENABLED', enabled: !state.enabled })}
        onSettings={(settings) => void request({ type: 'SET_SETTINGS', settings })}
        onStop={() => void chrome.runtime.sendMessage({ type: 'STOP' })}
        onRepeat={() => void request({ type: 'REPEAT' })}
      />
      <p className="popup-help">
        Once enabled, close this popup and hover over the page. Reading turns off when the page
        reloads or navigates.
      </p>
      <p className="popup-shortcut">
        Stop from anywhere: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
      </p>
    </main>
  );
}
