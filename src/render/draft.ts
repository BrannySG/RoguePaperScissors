import { Container, Graphics, Text } from 'pixi.js';
import { cardById } from '../cards/library.ts';
import type { CardLibrary } from '../core/cards.ts';
import { Button } from './button.ts';
import { CardView } from './cardView.ts';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './viewport.ts';
import { body, CARD, CARD_SMALL, MUTED, PAPER, title } from './theme.ts';

const SUPERSAMPLE = 1.4;

export interface DraftHandlers {
  onTake: (cardId: string, discard: string | null) => void;
  onSkip: () => void;
}

/**
 * The between-Clash offer. When the Hand is full a take becomes a replace, so
 * the overlay has a second step rather than silently declining.
 */
export class DraftView extends Container {
  #library: CardLibrary;
  #handlers: DraftHandlers;
  #heading: Text;
  #subheading: Text;
  #offerRow = new Container();
  #handRow = new Container();
  #pending: string | null = null;
  #offer: readonly string[] = [];
  #hand: readonly string[] = [];
  #handCap = 0;

  constructor(library: CardLibrary, handlers: DraftHandlers) {
    super();
    this.#library = library;
    this.#handlers = handlers;

    this.addChild(
      new Graphics()
        .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
        .fill({ color: PAPER, alpha: 0.95 }),
    );

    this.#heading = new Text({ text: '', style: title(64) });
    this.#heading.anchor.set(0.5);
    this.#heading.position.set(VIRTUAL_WIDTH / 2, 150);

    this.#subheading = new Text({ text: '', style: body(24, '700', MUTED) });
    this.#subheading.anchor.set(0.5);
    this.#subheading.position.set(VIRTUAL_WIDTH / 2, 208);

    this.addChild(this.#heading, this.#subheading, this.#offerRow, this.#handRow);

    const skip = new Button('SKIP', 220, 66, () => this.#handlers.onSkip());
    skip.position.set(VIRTUAL_WIDTH / 2, 960);
    this.addChild(skip);

    this.visible = false;
  }

  show(offer: readonly string[], hand: readonly string[], handCap: number): void {
    this.#offer = offer;
    this.#hand = hand;
    this.#handCap = handCap;
    this.#pending = null;
    this.visible = true;
    this.#render();
  }

  hide(): void {
    this.visible = false;
    this.#pending = null;
  }

  #render(): void {
    const full = this.#hand.length >= this.#handCap;
    const replacing = this.#pending !== null;

    this.#heading.text = replacing ? 'REPLACE WHICH?' : 'TAKE A CARD';
    this.#subheading.text = replacing
      ? `Taking ${cardById(this.#library, this.#pending!).name.toUpperCase()}`
      : full
        ? `Hand is full (${this.#hand.length}/${this.#handCap}) - taking will replace`
        : `Hand ${this.#hand.length}/${this.#handCap}`;

    this.#fill(this.#offerRow, this.#offer, CARD, 250, 470, (cardId) => {
      if (!full) {
        this.#handlers.onTake(cardId, null);
        return;
      }
      this.#pending = cardId;
      this.#render();
    });

    if (replacing) {
      this.#fill(this.#handRow, this.#hand, CARD_SMALL, 180, 790, (_, index) => {
        this.#handlers.onTake(this.#pending!, this.#hand[index]!);
      });
    } else {
      this.#clear(this.#handRow);
    }
  }

  #clear(row: Container): void {
    for (const child of row.removeChildren()) child.destroy({ children: true });
  }

  #fill(
    row: Container,
    cardIds: readonly string[],
    size: typeof CARD | typeof CARD_SMALL,
    spacing: number,
    y: number,
    onPick: (cardId: string, index: number) => void,
  ): void {
    this.#clear(row);

    const startX = VIRTUAL_WIDTH / 2 - ((cardIds.length - 1) * spacing) / 2;

    cardIds.forEach((cardId, index) => {
      const view = new CardView(cardById(this.#library, cardId), {
        size: {
          width: size.width * SUPERSAMPLE,
          height: size.height * SUPERSAMPLE,
          radius: size.radius * SUPERSAMPLE,
        },
      });

      view.scale.set(1 / SUPERSAMPLE);
      view.pivot.set((size.width * SUPERSAMPLE) / 2, (size.height * SUPERSAMPLE) / 2);
      view.position.set(startX + index * spacing, y);

      view.on('pointerover', () => {
        view.scale.set(1.08 / SUPERSAMPLE);
        view.setSelected(true);
      });
      view.on('pointerout', () => {
        view.scale.set(1 / SUPERSAMPLE);
        view.setSelected(false);
      });
      view.on('pointertap', () => onPick(cardId, index));

      row.addChild(view);
    });
  }
}
