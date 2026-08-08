import { Container, Text } from 'pixi.js';
import { INK, title } from './theme.ts';

interface Message {
  text: string;
  color: number;
  durationMs: number;
}

/**
 * Transient centre-screen callouts: Sudden Death, an Echo firing for the first
 * time, the final result. Queued so two announcements never stack on top of
 * each other.
 */
export class Banner extends Container {
  #label = new Text({ text: '', style: title(64, INK) });
  #queue: Message[] = [];
  #current: Message | null = null;
  #elapsed = 0;

  constructor() {
    super();
    this.#label.anchor.set(0.5);
    this.addChild(this.#label);
    this.visible = false;
  }

  show(text: string, color: number = INK, durationMs = 1600): void {
    this.#queue.push({ text, color, durationMs });
  }

  clear(): void {
    this.#queue = [];
    this.#current = null;
    this.visible = false;
  }

  update(deltaMs: number): void {
    if (this.#current === null) {
      const next = this.#queue.shift();
      if (next === undefined) {
        this.visible = false;
        return;
      }

      this.#current = next;
      this.#elapsed = 0;
      this.#label.text = next.text;
      this.#label.style.fill = next.color;
      this.visible = true;
    }

    this.#elapsed += deltaMs;
    const progress = this.#elapsed / this.#current.durationMs;

    if (progress >= 1) {
      this.#current = null;
      this.alpha = 1;
      return;
    }

    // Rises slightly and fades over the back half of its life.
    this.alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
    this.#label.y = -progress * 24;
  }
}
