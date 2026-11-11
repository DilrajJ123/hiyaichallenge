import { Power, RotateCcw, ShieldCheck, Square, Volume2 } from 'lucide-react';
import type { ReaderSettings } from '../../shared/settings.js';

interface ReaderControlsProps {
  enabled: boolean;
  settings: ReaderSettings;
  busy?: boolean;
  compact?: boolean;
  available?: boolean;
  error?: string;
  onToggle(): void;
  onSettings(settings: ReaderSettings): void;
  onStop(): void;
  onRepeat(): void;
}

export function ReaderControls({
  enabled,
  settings,
  busy = false,
  compact = false,
  available = true,
  error,
  onToggle,
  onSettings,
  onStop,
  onRepeat,
}: ReaderControlsProps) {
  // Native disabling during a save drops keyboard focus; guard actions instead.
  const changeSettings = (next: ReaderSettings) => {
    if (!busy) onSettings(next);
  };
  const preferences = (
    <>
      <div className="settings-grid">
        <label htmlFor="reading-speed">
          Reading speed
          <select
            id="reading-speed"
            value={settings.rate}
            aria-disabled={busy}
            onChange={(event) => changeSettings({ ...settings, rate: Number(event.target.value) })}
          >
            <option value="0.8">Slower · 0.8×</option>
            <option value="1">Normal · 1×</option>
            <option value="1.25">Faster · 1.25×</option>
            <option value="1.5">Fast · 1.5×</option>
          </select>
        </label>
        <label htmlFor="text-mode">
          When hovering text
          <select
            id="text-mode"
            value={settings.textMode}
            aria-disabled={busy}
            onChange={(event) =>
              changeSettings({
                ...settings,
                textMode: event.target.value as ReaderSettings['textMode'],
              })
            }
          >
            <option value="sentence">Read the sentence</option>
            <option value="word">Read the word</option>
          </select>
        </label>
        <label htmlFor="hover-delay">
          Hover delay
          <select
            id="hover-delay"
            value={settings.delay}
            aria-disabled={busy}
            onChange={(event) => changeSettings({ ...settings, delay: Number(event.target.value) })}
          >
            <option value="200">Quick · 0.2 seconds</option>
            <option value="350">Balanced · 0.35 seconds</option>
            <option value="700">Steady · 0.7 seconds</option>
          </select>
        </label>
      </div>
      <label className="focus-setting">
        <input
          type="checkbox"
          checked={settings.readOnFocus}
          aria-disabled={busy}
          onChange={(event) => changeSettings({ ...settings, readOnFocus: event.target.checked })}
        />
        Also read keyboard focus
      </label>
      <p className="setting-help">
        Use Tab to hear controls. Turn this off if your screen reader already announces them.
      </p>
    </>
  );
  return (
    <section className="reader-controls" aria-labelledby="controls-title" data-pagevoice-ignore>
      <div className="controls-heading">
        <div className="icon-tile">
          <Volume2 size={23} aria-hidden="true" />
        </div>
        <div>
          <h2 id="controls-title">Hover to hear</h2>
          <p>You point. PageVoice reads.</p>
        </div>
      </div>
      <button
        className={`enable-button ${enabled ? 'is-enabled' : ''}`}
        type="button"
        aria-pressed={enabled}
        aria-disabled={busy || !available}
        onClick={() => {
          if (!busy) onToggle();
        }}
        disabled={!available}
      >
        <Power size={19} aria-hidden="true" />
        {busy ? 'Please wait…' : enabled ? 'Turn off reading' : 'Turn on reading'}
      </button>
      <p className="control-status" role="status">
        {enabled ? 'On — move over text or a button to hear it.' : 'Off — nothing is being read.'}
      </p>
      {!available && (
        <p className="error-note">
          Open a regular website to use PageVoice. Browser settings and other protected pages cannot
          be read.
        </p>
      )}
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      {compact ? (
        <details className="reading-preferences">
          <summary>Reading preferences</summary>
          {preferences}
        </details>
      ) : (
        preferences
      )}
      <div className="playback-buttons">
        <button type="button" onClick={onStop}>
          <Square size={15} aria-hidden="true" />
          Stop <kbd>Esc</kbd>
        </button>
        <button
          type="button"
          aria-disabled={busy || !enabled}
          onClick={() => {
            if (!busy) onRepeat();
          }}
          disabled={!enabled}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Repeat last
        </button>
      </div>
      <p className="privacy-note">
        <ShieldCheck size={16} aria-hidden="true" />
        Local speech. No account. No page uploads.
      </p>
    </section>
  );
}
