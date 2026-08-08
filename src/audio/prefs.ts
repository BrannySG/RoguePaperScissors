/** The player's own audio choices. Nothing here touches how a Fight plays. */
export interface Prefs {
  muted: boolean;
  /** Music level, 0 to 1. */
  music: number;
  /** Cue level, 0 to 1. The old fixed master gain was 0.5, so that is the default. */
  sfx: number;
}

export const DEFAULT_PREFS: Prefs = { muted: false, music: 0.3, sfx: 0.5 };

const STORAGE_KEY = 'rps.prefs';

export function loadPrefs(): Prefs {
  const raw = read();
  if (raw === null) return { ...DEFAULT_PREFS };

  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_PREFS.muted,
      music: clamp(parsed.music, DEFAULT_PREFS.music),
      sfx: clamp(parsed.sfx, DEFAULT_PREFS.sfx),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable or full; Prefs are not worth failing a boot over.
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function clamp(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}
