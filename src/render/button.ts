import { Container, Graphics, Text } from 'pixi.js';
import { INK, PAPER, STROKE, title } from './theme.ts';

export class Button extends Container {
  #background: Graphics;

  constructor(label: string, width: number, height: number, onTap: () => void) {
    super();

    this.#background = new Graphics()
      .roundRect(0, 0, width, height, 10)
      .fill(PAPER)
      .stroke({ width: STROKE, color: INK });

    const text = new Text({ text: label, style: title(26) });
    text.anchor.set(0.5);
    text.position.set(width / 2, height / 2);

    this.addChild(this.#background, text);
    this.pivot.set(width / 2, height / 2);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerover', () => (this.#background.tint = 0xeeeeee));
    this.on('pointerout', () => (this.#background.tint = 0xffffff));
    this.on('pointertap', onTap);
  }
}
