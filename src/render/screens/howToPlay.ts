import { Container, Graphics, Text } from 'pixi.js';
import { Button } from '../button.ts';
import { squiggle } from '../ink.ts';
import { MUTED, PAPER, title, wrapped } from '../theme.ts';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../viewport.ts';

const LINES = [
  'Every Round you COMMIT a card in secret under a countdown. Both cards CLASH at once, then you DRAFT a new one.',
  'Rock beats Scissors, Paper beats Rock, Scissors beats Paper. Two cards of the same type is a Stalemate and nothing happens.',
  'Your three Cores are permanent but go on Cooldown after you play them. Tricks are one-shot and are spent at the Clash either way.',
];

const CONTROLS = 'Click a card or press 1-5     R for a rematch     M to mute     ESC for the menu';

/** Everything a first-time player needs and nothing else. */
export class HowToPlayOverlay extends Container {
  constructor(onBack: () => void) {
    super();

    // Opaque, unlike the Draft: the menu behind it is the same weight of ink and
    // would read as a double exposure rather than depth.
    this.addChild(
      new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(PAPER),
    );

    const heading = new Text({ text: 'HOW TO PLAY', style: title(72) });
    heading.anchor.set(0.5);
    heading.position.set(VIRTUAL_WIDTH / 2, 170);

    const underline = squiggle(430, { amplitude: 6, waves: 5 });
    underline.position.set(VIRTUAL_WIDTH / 2 - 215, 228);

    this.addChild(heading, underline);

    LINES.forEach((line, index) => {
      const text = new Text({ text: line, style: wrapped(32, 1180) });
      text.anchor.set(0.5, 0);
      text.position.set(VIRTUAL_WIDTH / 2, 330 + index * 160);
      this.addChild(text);
    });

    const controls = new Text({ text: CONTROLS, style: wrapped(26, 1300, MUTED) });
    controls.anchor.set(0.5, 0);
    controls.position.set(VIRTUAL_WIDTH / 2, 810);
    this.addChild(controls);

    const back = new Button('BACK', 240, 74, onBack, { fontSize: 30 });
    back.position.set(VIRTUAL_WIDTH / 2, 950);
    this.addChild(back);
  }
}
