import { Container, Text } from 'pixi.js';
import { body, BLOOD, INK, MUTED, title } from './theme.ts';

/**
 * The loudest thing on screen. The mockup makes the timer the largest object
 * by a wide margin, which is the game stating that it is a nerve game rather
 * than a thinking game.
 */
export class Countdown extends Container {
  #number = new Text({ text: '', style: title(300) });
  #label = new Text({ text: '', style: body(30, '800', MUTED) });

  constructor() {
    super();

    this.#number.anchor.set(0.5);
    this.#label.anchor.set(0.5);
    this.#label.position.set(0, -150);

    this.addChild(this.#number, this.#label);
  }

  set(secondsRemaining: number | null, label: string): void {
    if (secondsRemaining === null) {
      this.visible = false;
      return;
    }

    this.visible = true;
    const seconds = Math.max(0, Math.ceil(secondsRemaining));
    this.#number.text = String(seconds);
    this.#number.style.fill = seconds <= 3 ? BLOOD : INK;
    this.#label.text = label;
  }
}
