import { Container, Text } from 'pixi.js';
import type { CardDef } from '../core/cards.ts';
import { CardView } from './cardView.ts';
import { body, CARD, INK, MUTED, title } from './theme.ts';

const SUPERSAMPLE = 1.5;
const SPREAD = 230;

export interface ClashSide {
  card: CardDef | null;
  /** Result line beneath the card: damage taken, or a Whiff. */
  result: string;
  resultColor: number;
}

/** The reveal. Both cards are shown together, never one before the other. */
export class ClashView extends Container {
  #slots: Array<{ holder: Container; caption: Text; result: Text }> = [];

  constructor() {
    super();

    for (const [index, caption] of ['YOU', 'OPPONENT'].entries()) {
      const holder = new Container();
      holder.x = index === 0 ? -SPREAD : SPREAD;

      const captionText = new Text({ text: caption, style: body(22, '800', MUTED) });
      captionText.anchor.set(0.5, 1);
      captionText.position.set(holder.x, -CARD.height / 2 - 22);

      const resultText = new Text({ text: '', style: title(46, INK) });
      resultText.anchor.set(0.5, 0);
      resultText.position.set(holder.x, CARD.height / 2 + 18);

      this.addChild(holder, captionText, resultText);
      this.#slots.push({ holder, caption: captionText, result: resultText });
    }

    this.visible = false;
  }

  show(self: ClashSide, opponent: ClashSide): void {
    this.visible = true;

    for (const [index, side] of [self, opponent].entries()) {
      const slot = this.#slots[index]!;
      slot.holder.removeChildren().forEach((child) => child.destroy({ children: true }));

      slot.result.text = side.result;
      slot.result.style.fill = side.resultColor;

      if (side.card === null) {
        const nothing = new Text({ text: 'NO PLAY', style: title(34, MUTED) });
        nothing.anchor.set(0.5);
        slot.holder.addChild(nothing);
        continue;
      }

      const view = new CardView(side.card, {
        size: {
          width: CARD.width * SUPERSAMPLE,
          height: CARD.height * SUPERSAMPLE,
          radius: CARD.radius * SUPERSAMPLE,
        },
      });
      view.eventMode = 'none';
      view.scale.set(1 / SUPERSAMPLE);
      view.pivot.set((CARD.width * SUPERSAMPLE) / 2, (CARD.height * SUPERSAMPLE) / 2);
      slot.holder.addChild(view);
    }
  }

  hide(): void {
    this.visible = false;
  }
}
