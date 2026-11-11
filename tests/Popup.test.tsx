// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Popup } from '../extension/Popup.js';
import { defaultSettings, type ExtensionState } from '../shared/settings.js';

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;
let listeners: Set<StorageListener>;
let current: ExtensionState;
const sendMessage = vi.fn<(message: Record<string, unknown>) => Promise<unknown>>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  current = { enabled: false, available: true, settings: { ...defaultSettings } };
  listeners = new Set();
  sendMessage.mockImplementation(async (message) =>
    message.type === 'STOP' ? { ok: true } : current,
  );
  vi.stubGlobal('chrome', {
    runtime: { sendMessage },
    storage: {
      onChanged: {
        addListener: (listener: StorageListener) => listeners.add(listener),
        removeListener: (listener: StorageListener) => listeners.delete(listener),
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const storageChanged = async (
  changes: Record<string, chrome.storage.StorageChange>,
  area = 'session',
) => {
  await act(async () => {
    for (const listener of listeners) listener(changes, area);
  });
};
const renderReady = async () => {
  const view = render(<Popup />);
  await screen.findByRole('button', { name: 'Turn on reading' });
  return view;
};

describe('extension popup state (simulated Chrome APIs)', () => {
  it('shows and clears worker speech errors without making controls busy', async () => {
    await renderReady();
    const next = deferred<ExtensionState>();
    sendMessage.mockReturnValueOnce(next.promise);
    await storageChanged({ 'error:1': { newValue: 'Local voice unavailable' } });
    const toggle = screen.getByRole('button', { name: 'Turn on reading' });
    expect((toggle as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('Please wait…')).toBeNull();
    current = { ...current, error: 'Local voice unavailable' };
    await act(async () => next.resolve(current));
    expect(screen.getByRole('alert').textContent).toBe('Local voice unavailable');
    current = { ...current, error: '' };
    await storageChanged({ 'error:1': { oldValue: 'Local voice unavailable', newValue: '' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('updates enabled state and preferences while the popup remains open', async () => {
    await renderReady();
    current = { ...current, enabled: true };
    await storageChanged({ 'enabled:1': { newValue: true } });
    expect(screen.getByRole('button', { name: 'Turn off reading' })).toBeDefined();
    current = { ...current, settings: { ...current.settings, rate: 1.5 } };
    await storageChanged({ settings: { newValue: current.settings } }, 'local');
    expect((screen.getByLabelText('Reading speed') as HTMLSelectElement).value).toBe('1.5');
  });

  it('does not let a slow background refresh overwrite a newer user action', async () => {
    await renderReady();
    const stale = deferred<ExtensionState>();
    sendMessage.mockImplementation((message) =>
      message.type === 'GET_STATE' ? stale.promise : Promise.resolve({ ...current, enabled: true }),
    );
    await storageChanged({ 'error:1': { newValue: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn on reading' }));
    await screen.findByRole('button', { name: 'Turn off reading' });
    await act(async () => stale.resolve({ ...current, enabled: false }));
    expect(screen.getByRole('button', { name: 'Turn off reading' })).toBeDefined();
  });

  it('refreshes after a pending action when worker state changes during it', async () => {
    await renderReady();
    const action = deferred<ExtensionState>();
    sendMessage.mockImplementation((message) =>
      message.type === 'SET_ENABLED' ? action.promise : Promise.resolve(current),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Turn on reading' }));
    await storageChanged({ 'error:1': { newValue: 'Check your sound output' } });
    expect(sendMessage.mock.calls.filter(([message]) => message.type === 'GET_STATE')).toHaveLength(
      1,
    );
    current = { ...current, enabled: true, error: 'Check your sound output' };
    await act(async () => action.resolve({ ...current, error: '' }));
    expect(screen.getByRole('alert').textContent).toBe('Check your sound output');
    expect(screen.queryByText('Please wait…')).toBeNull();
  });

  it('keeps keyboard focus on the toggle while saving and ignores repeated activation', async () => {
    await renderReady();
    const action = deferred<ExtensionState>();
    sendMessage.mockReturnValueOnce(action.promise);
    const toggle = screen.getByRole('button', { name: 'Turn on reading' }) as HTMLButtonElement;
    toggle.focus();
    fireEvent.click(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(toggle.disabled).toBe(false);
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(toggle);
    expect(
      sendMessage.mock.calls.filter(([message]) => message.type === 'SET_ENABLED'),
    ).toHaveLength(1);
    await act(async () => action.resolve({ ...current, enabled: true }));
    expect(document.activeElement).toBe(toggle);
    expect(toggle.textContent).toBe('Turn off reading');
    expect(toggle.getAttribute('aria-disabled')).toBe('false');
  });

  it.each([
    ['Reading speed', 'rate', '1.5', 1.5],
    ['When hovering text', 'textMode', 'word', 'word'],
    ['Hover delay', 'delay', '700', 700],
  ] as const)(
    'preserves focus while saving %s and ignores further pending changes',
    async (label, key, value, saved) => {
      await renderReady();
      fireEvent.click(screen.getByText('Reading preferences'));
      const action = deferred<ExtensionState>();
      sendMessage.mockReturnValueOnce(action.promise);
      const control = screen.getByLabelText(label) as HTMLSelectElement;
      control.focus();
      fireEvent.change(control, { target: { value } });
      expect(document.activeElement).toBe(control);
      expect(control.disabled).toBe(false);
      expect(control.getAttribute('aria-disabled')).toBe('true');
      fireEvent.change(control, { target: { value: String(defaultSettings[key]) } });
      expect(
        sendMessage.mock.calls.filter(([message]) => message.type === 'SET_SETTINGS'),
      ).toHaveLength(1);
      expect(sendMessage).toHaveBeenLastCalledWith({
        type: 'SET_SETTINGS',
        settings: { ...defaultSettings, [key]: saved },
      });
      await act(async () =>
        action.resolve({ ...current, settings: { ...current.settings, [key]: saved } }),
      );
      expect(document.activeElement).toBe(control);
      expect(control.value).toBe(value);
      expect(control.getAttribute('aria-disabled')).toBe('false');
    },
  );

  it('preserves focus when changing keyboard reading and keeps Stop available while saving', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Reading preferences'));
    const action = deferred<ExtensionState>();
    sendMessage.mockReturnValueOnce(action.promise);
    const control = screen.getByLabelText('Also read keyboard focus') as HTMLInputElement;
    control.focus();
    fireEvent.click(control);
    expect(document.activeElement).toBe(control);
    expect(control.disabled).toBe(false);
    expect(control.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(control);
    expect(
      sendMessage.mock.calls.filter(([message]) => message.type === 'SET_SETTINGS'),
    ).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sendMessage).toHaveBeenLastCalledWith({ type: 'STOP' });
    await act(async () =>
      action.resolve({ ...current, settings: { ...current.settings, readOnFocus: false } }),
    );
    expect(document.activeElement).toBe(control);
    expect(control.checked).toBe(false);
    expect(control.getAttribute('aria-disabled')).toBe('false');
  });

  it('ignores unrelated storage changes', async () => {
    await renderReady();
    await storageChanged({ somethingElse: { newValue: true } });
    await storageChanged({ settings: { newValue: {} } }, 'sync');
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('removes storage and Escape listeners when the popup closes', async () => {
    const { unmount } = await renderReady();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sendMessage).toHaveBeenLastCalledWith({ type: 'STOP' });
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
    const count = sendMessage.mock.calls.length;
    fireEvent.keyDown(window, { key: 'Escape' });
    await storageChanged({ 'error:1': { newValue: 'Later error' } });
    expect(sendMessage).toHaveBeenCalledTimes(count);
  });

  it('keeps Stop and Repeat connected when preferences are collapsed', async () => {
    current = { ...current, enabled: true };
    render(<Popup />);
    await screen.findByRole('button', { name: 'Turn off reading' });
    fireEvent.click(screen.getByRole('button', { name: 'Stop Esc' }));
    expect(sendMessage).toHaveBeenLastCalledWith({ type: 'STOP' });
    fireEvent.click(screen.getByRole('button', { name: 'Repeat last' }));
    expect(sendMessage).toHaveBeenLastCalledWith({ type: 'REPEAT' });
    await act(async () => {});
  });
});
