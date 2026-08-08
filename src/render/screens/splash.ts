import { Container, Text } from 'pixi.js';
import { squiggle } from '../ink.ts';
import { body, title } from '../theme.ts';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../viewport.ts';

export type SplashKind = 'studio' | 'credit';

/** The boot title cards. One at a time, no controls, straight to the Main Menu. */
export class SplashScreen extends Container {
  #card = new Container();

  show(text: string, kind: SplashKind): void {
    this.removeChild(this.#card);
    this.#card.destroy({ children: true });

    this.#card = new Container();
    this.#card.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);

    const label = new Text({
      text,
      style: kind === 'studio' ? title(104) : body(48, '600'),
    });
    label.anchor.set(0.5);
    this.#card.addChild(label);

    if (kind === 'studio') {
      const underline = squiggle(label.width + 60, { amplitude: 7, waves: 4 });
      underline.position.set(-(label.width + 60) / 2, label.height / 2 + 12);
      this.#card.addChild(underline);
    }

    this.addChild(this.#card);
  }
}
