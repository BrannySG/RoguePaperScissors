/** The player's own presentation choices. Nothing here touches how a Fight plays. */
export interface Prefs {
  muted: boolean;
  /** Music level, 0 to 1. */
  music: number;
  /** Cue level, 0 to 1. The old fixed master gain was 0.5, so that is the default. */
  sfx: number;
  /** Whether lines Boil. */
  boil: boolean;
}

const STORAGE_KEY = 'rps.prefs';

/**
 * Computed rather than constant: a player who has asked their system for less
 * motion should not have to find the Boil switch to be rid of it.
 */
export function defaultPrefs(): Prefs {
  return { muted: false, music: 0.3, sfx: 0.5, boil: !prefersReducedMotion() };
}

export function loadPrefs(): Prefs {
  const defaults = defaultPrefs();
  const raw = read();
  if (raw === null) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      muted: bool(parsed.muted, defaults.muted),
      music: clamp(parsed.music, defaults.music),
      sfx: clamp(parsed.sfx, defaults.sfx),
      // Absent from every blob written before the Boil existed, so this is the
      // branch most players take on their first load after it ships.
      boil: bool(parsed.boil, defaults.boil),
    };
  } catch {
    return defaults;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable or full; Prefs are not worth failing a boot over.
  }
}

/**
 * The single owner of the stored blob. Subsystems read and write their own field
 * through here rather than each holding a copy, because two copies means the
 * next write from either one silently reverts the other's.
 */
export class PrefsStore {
  #prefs: Prefs = loadPrefs();

  get muted(): boolean {
    return this.#prefs.muted;
  }

  set muted(value: boolean) {
    this.#patch({ muted: value });
  }

  get music(): number {
    return this.#prefs.music;
  }

  set music(value: number) {
    this.#patch({ music: clamp(value, this.#prefs.music) });
  }

  get sfx(): number {
    return this.#prefs.sfx;
  }

  set sfx(value: number) {
    this.#patch({ sfx: clamp(value, this.#prefs.sfx) });
  }

  get boil(): boolean {
    return this.#prefs.boil;
  }

  set boil(value: boolean) {
    this.#patch({ boil: value });
  }

  #patch(part: Partial<Prefs>): void {
    this.#prefs = { ...this.#prefs, ...part };
    savePrefs(this.#prefs);
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clamp(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}
