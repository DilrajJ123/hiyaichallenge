export interface ReaderSettings {
  rate: number;
  delay: number;
  textMode: 'sentence' | 'word';
  readOnFocus: boolean;
}

export const defaultSettings: ReaderSettings = {
  rate: 1,
  delay: 350,
  textMode: 'sentence',
  readOnFocus: true,
};

export function normaliseSettings(value: Partial<ReaderSettings> = {}): ReaderSettings {
  return {
    rate:
      typeof value.rate === 'number' && Number.isFinite(value.rate)
        ? Math.max(0.6, Math.min(2, value.rate))
        : 1,
    delay:
      typeof value.delay === 'number' && Number.isFinite(value.delay)
        ? Math.max(200, Math.min(1000, value.delay))
        : 350,
    textMode: value.textMode === 'word' ? 'word' : 'sentence',
    readOnFocus: value.readOnFocus !== false,
  };
}

export interface ExtensionState {
  enabled: boolean;
  available: boolean;
  settings: ReaderSettings;
  error?: string;
}
