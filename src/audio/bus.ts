import type { PrefsStore } from '../prefs.ts';

export type SoundCue =
  | 'hover'
  | 'commit'
  | 'tick'
  | 'tickUrgent'
  | 'reveal'
  | 'windup'
  | 'impact'
  | 'flop'
  | 'damage'
  | 'heal'
  | 'draft'
  | 'fightWon'
  | 'fightLost';

interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to?: number;
  durationMs: number;
  gain?: number;
  delayMs?: number;
}

interface NoiseOptions {
  durationMs: number;
  gain?: number;
  cutoffFrom?: number;
  cutoffTo?: number;
  delayMs?: number;
}

const NOISE_SECONDS = 0.6;

export type MusicTrack = 'menu' | 'fight';

const MUSIC_SOURCES: Record<MusicTrack, string> = {
  menu: '/audio/menu.ogg',
  fight: '/audio/fight.ogg',
};

/** Long enough to read as a handover rather than a cut, short enough to skip. */
export const MUSIC_FADE_MS = 1500;

interface PlayingTrack {
  track: MusicTrack;
  source: AudioBufferSourceNode;
  fade: GainNode;
}

/**
 * Cues are synthesised on the fly rather than loaded; only the two music tracks
 * are files. Browsers refuse to start an AudioContext before a gesture, so
 * nothing exists until `unlock` is called from a real click or keypress — a
 * track asked for before then is remembered and starts once the bus wakes up.
 *
 * The graph is master (mute) -> {music, sfx} (Prefs levels) -> per-track fade.
 */
export class AudioBus {
  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #musicGain: GainNode | null = null;
  #sfxGain: GainNode | null = null;
  #noiseBuffer: AudioBuffer | null = null;

  #prefs: PrefsStore;

  #buffers = new Map<MusicTrack, AudioBuffer>();
  #decoding = new Map<MusicTrack, Promise<AudioBuffer | null>>();
  #playing: PlayingTrack | null = null;
  #wanted: MusicTrack | null = null;

  constructor(prefs: PrefsStore) {
    this.#prefs = prefs;
  }

  unlock(): void {
    if (this.#ctx === null) {
      if (typeof AudioContext === 'undefined') return;

      const ctx = new AudioContext();

      const master = ctx.createGain();
      master.gain.value = this.#prefs.muted ? 0 : 1;
      master.connect(ctx.destination);

      const music = ctx.createGain();
      music.gain.value = this.#prefs.music;
      music.connect(master);

      const sfx = ctx.createGain();
      sfx.gain.value = this.#prefs.sfx;
      sfx.connect(master);

      this.#ctx = ctx;
      this.#master = master;
      this.#musicGain = music;
      this.#sfxGain = sfx;

      if (this.#wanted !== null) void this.#swap(this.#wanted, MUSIC_FADE_MS);
    }

    if (this.#ctx.state === 'suspended') void this.#ctx.resume();
  }

  get muted(): boolean {
    return this.#prefs.muted;
  }

  set muted(value: boolean) {
    this.#prefs.muted = value;
    if (this.#master !== null) this.#ramp(this.#master.gain, value ? 0 : 1);
  }

  get musicVolume(): number {
    return this.#prefs.music;
  }

  set musicVolume(value: number) {
    // Read back rather than reuse: the store owns the clamp.
    this.#prefs.music = value;
    if (this.#musicGain !== null) this.#ramp(this.#musicGain.gain, this.#prefs.music);
  }

  get sfxVolume(): number {
    return this.#prefs.sfx;
  }

  set sfxVolume(value: number) {
    this.#prefs.sfx = value;
    if (this.#sfxGain !== null) this.#ramp(this.#sfxGain.gain, this.#prefs.sfx);
  }

  /** Loops `track`, fading out whatever was playing. A no-op if it is already on. */
  playMusic(track: MusicTrack, fadeMs = MUSIC_FADE_MS): void {
    this.#wanted = track;
    if (this.#playing?.track === track) return;
    void this.#swap(track, fadeMs);
  }

  stopMusic(fadeMs = MUSIC_FADE_MS): void {
    this.#wanted = null;
    this.#fadeOutCurrent(fadeMs);
  }

  async #swap(track: MusicTrack, fadeMs: number): Promise<void> {
    const ctx = this.#ctx;
    const musicGain = this.#musicGain;
    if (ctx === null || musicGain === null) return;

    const buffer = await this.#buffer(track, ctx);
    // Decoding takes long enough that the player can have moved on again.
    if (buffer === null || this.#wanted !== track || this.#playing?.track === track) return;

    this.#fadeOutCurrent(fadeMs);

    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0.0001, ctx.currentTime);
    fade.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeMs / 1000);
    fade.connect(musicGain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(fade);
    source.start();

    this.#playing = { track, source, fade };
  }

  #fadeOutCurrent(fadeMs: number): void {
    const current = this.#playing;
    const ctx = this.#ctx;
    if (current === null || ctx === null) return;

    this.#playing = null;

    const seconds = fadeMs / 1000;
    const gain = current.fade.gain;
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setValueAtTime(gain.value, ctx.currentTime);
    gain.linearRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    current.source.stop(ctx.currentTime + seconds + 0.05);
  }

  async #buffer(track: MusicTrack, ctx: AudioContext): Promise<AudioBuffer | null> {
    const cached = this.#buffers.get(track);
    if (cached !== undefined) return cached;

    let pending = this.#decoding.get(track);
    if (pending === undefined) {
      pending = (async () => {
        try {
          const response = await fetch(MUSIC_SOURCES[track]);
          const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
          this.#buffers.set(track, decoded);
          return decoded;
        } catch {
          // A missing or undecodable track leaves the game silent, not broken.
          return null;
        }
      })();
      this.#decoding.set(track, pending);
    }

    return pending;
  }

  #ramp(param: AudioParam, value: number, seconds = 0.05): void {
    const ctx = this.#ctx;
    if (ctx === null) {
      param.value = value;
      return;
    }

    param.cancelScheduledValues(ctx.currentTime);
    param.setValueAtTime(param.value, ctx.currentTime);
    param.linearRampToValueAtTime(value, ctx.currentTime + seconds);
  }

  play(cue: SoundCue): void {
    if (this.#ctx === null || this.#prefs.muted) return;

    switch (cue) {
      case 'hover':
        this.#tone({ from: 620, durationMs: 45, gain: 0.04 });
        break;

      case 'commit':
        this.#tone({ type: 'square', from: 210, to: 90, durationMs: 110, gain: 0.1 });
        this.#noise({ durationMs: 60, gain: 0.14, cutoffFrom: 2600, cutoffTo: 700 });
        break;

      case 'tick':
        this.#tone({ from: 900, durationMs: 40, gain: 0.05 });
        break;

      case 'tickUrgent':
        this.#tone({ type: 'triangle', from: 1240, durationMs: 70, gain: 0.13 });
        break;

      case 'reveal':
        this.#noise({ durationMs: 180, gain: 0.16, cutoffFrom: 500, cutoffTo: 4200 });
        this.#tone({ type: 'triangle', from: 260, to: 540, durationMs: 190, gain: 0.08 });
        break;

      case 'windup':
        this.#noise({ durationMs: 300, gain: 0.11, cutoffFrom: 320, cutoffTo: 2400 });
        break;

      case 'impact':
        this.#noise({ durationMs: 260, gain: 0.42, cutoffFrom: 1800, cutoffTo: 260 });
        this.#tone({ type: 'sine', from: 110, to: 38, durationMs: 300, gain: 0.34 });
        this.#tone({ type: 'square', from: 320, to: 120, durationMs: 90, gain: 0.1 });
        break;

      case 'flop':
        this.#tone({ type: 'triangle', from: 300, to: 80, durationMs: 380, gain: 0.16 });
        this.#noise({ durationMs: 300, gain: 0.2, cutoffFrom: 900, cutoffTo: 200 });
        this.#tone({ type: 'sine', from: 150, to: 60, durationMs: 260, gain: 0.12, delayMs: 120 });
        break;

      case 'damage':
        this.#tone({ type: 'sawtooth', from: 480, to: 190, durationMs: 130, gain: 0.14 });
        break;

      case 'heal':
        this.#tone({ from: 520, to: 780, durationMs: 200, gain: 0.09 });
        break;

      case 'draft':
        this.#tone({ type: 'triangle', from: 420, durationMs: 90, gain: 0.08 });
        this.#tone({ type: 'triangle', from: 640, durationMs: 130, gain: 0.08, delayMs: 90 });
        break;

      case 'fightWon':
        for (const [index, note] of [440, 590, 780].entries()) {
          this.#tone({
            type: 'triangle',
            from: note,
            durationMs: 220,
            gain: 0.12,
            delayMs: index * 120,
          });
        }
        break;

      case 'fightLost':
        for (const [index, note] of [420, 330, 220].entries()) {
          this.#tone({
            type: 'triangle',
            from: note,
            durationMs: 280,
            gain: 0.12,
            delayMs: index * 150,
          });
        }
        break;
    }
  }

  #tone(options: ToneOptions): void {
    const ctx = this.#ctx;
    const out = this.#sfxGain;
    if (ctx === null || out === null) return;

    const start = ctx.currentTime + (options.delayMs ?? 0) / 1000;
    const seconds = options.durationMs / 1000;
    const peak = options.gain ?? 0.12;

    const osc = ctx.createOscillator();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(options.from, start);
    if (options.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), start + seconds);
    }

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(peak, start + Math.min(0.014, seconds * 0.35));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

    osc.connect(envelope);
    envelope.connect(out);
    osc.start(start);
    osc.stop(start + seconds + 0.03);
  }

  #noise(options: NoiseOptions): void {
    const ctx = this.#ctx;
    const out = this.#sfxGain;
    if (ctx === null || out === null) return;

    const start = ctx.currentTime + (options.delayMs ?? 0) / 1000;
    const seconds = options.durationMs / 1000;
    const peak = options.gain ?? 0.12;

    const source = ctx.createBufferSource();
    source.buffer = this.#whiteNoise(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(options.cutoffFrom ?? 2000, start);
    if (options.cutoffTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(60, options.cutoffTo),
        start + seconds,
      );
    }

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(peak, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(out);
    source.start(start);
    source.stop(start + seconds + 0.03);
  }

  #whiteNoise(ctx: AudioContext): AudioBuffer {
    if (this.#noiseBuffer !== null) return this.#noiseBuffer;

    const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;

    this.#noiseBuffer = buffer;
    return buffer;
  }
}