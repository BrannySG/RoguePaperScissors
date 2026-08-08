import { Container, Graphics, Text } from 'pixi.js';
import { INK, PAPER, STROKE, title } from './theme.ts';

/** Faded rather than recoloured, so a scratched-out label still reads under the ink. */
const INERT_ALPHA = 0.45;

export interface ButtonOptions {
  fontSize?: number;
  /** Drawn faded and inert: it still reports taps, it just does not invite them. */
  inert?: boolean;
}

export class Button extends Container {
  #background: Graphics;
  #label: Text;

  constructor(
    label: string,
    width: number,
    height: number,
    onTap: () => void,
    options: ButtonOptions = {},
  ) {
    super();

    this.#background = new Graphics()
      .roundRect(0, 0, width, height, 10)
      .fill(PAPER)
      .stroke({ width: STROKE, color: INK });

    this.#label = new Text({ text: label, style: title(options.fontSize ?? 26, INK) });
    this.#label.anchor.set(0.5);
    this.#label.position.set(width / 2, height / 2);

    this.addChild(this.#background, this.#label);
    this.pivot.set(width / 2, height / 2);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    if (options.inert === true) {
      this.alpha = INERT_ALPHA;
    } else {
      this.on('pointerover', () => (this.#background.tint = 0xeeeeee));
      this.on('pointerout', () => (this.#background.tint = 0xffffff));
    }
    this.on('pointertap', onTap);
  }

  setLabel(text: string): void {
    this.#label.text = text;
  }
}
