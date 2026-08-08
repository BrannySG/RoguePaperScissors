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

/**
 * Every cue is synthesised on the fly rather than loaded, so the prototype
 * gains audio without gaining an asset pipeline. Browsers refuse to start an
 * AudioContext before a gesture, so nothing exists until `unlock` is called
 * from a real click or keypress and every cue is a no-op until then.
 */
export class AudioBus {
  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #noiseBuffer: AudioBuffer | null = null;
  #muted = false;

  unlock(): void {
    if (this.#ctx === null) {
      if (typeof AudioContext === 'undefined') return;

      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.#muted ? 0 : 0.5;
      master.connect(ctx.destination);

      this.#ctx = ctx;
      this.#master = master;
    }

    if (this.#ctx.state === 'suspended') void this.#ctx.resume();
  }

  get muted(): boolean {
    return this.#muted;
  }

  set muted(value: boolean) {
    this.#muted = value;
    if (this.#master !== null) this.#master.gain.value = value ? 0 : 0.5;
  }

  play(cue: SoundCue): void {
    if (this.#ctx === null || this.#muted) return;

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
    const master = this.#master;
    if (ctx === null || master === null) return;

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
    envelope.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.03);
  }

  #noise(options: NoiseOptions): void {
    const ctx = this.#ctx;
    const master = this.#master;
    if (ctx === null || master === null) return;

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
    envelope.connect(master);
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
