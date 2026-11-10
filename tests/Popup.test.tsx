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
