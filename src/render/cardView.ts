import { Container, Graphics, Text } from 'pixi.js';
import type { CardDef, CardType } from '../core/cards.ts';
import { COUNTERS } from '../core/triangle.ts';
import {
  body,
  BLOOD,
  CARD,
  INK,
  MUTED,
  PAPER,
  STROKE,
  STROKE_THIN,
  STUN,
  title,
  wrapped,
} from './theme.ts';

export interface CardSize {
  width: number;
  height: number;
  radius: number;
}

const TYPE_GLYPH: Record<CardType, string> = { rock: 'R', paper: 'P', scissors: 'S' };
export const TYPE_LABEL: Record<CardType, string> = {
  rock: 'ROCK',
  paper: 'PAPER',
  scissors: 'SCISSORS',
};

export interface CardViewOptions {
  size?: CardSize;
  faceDown?: boolean;
}

/**
 * One card. Flat vector shapes plus the inked font; the hand-drawn restlessness
 * comes from the Boil passing over the whole sheet rather than from anything
 * sketched here - see docs/adr/0005.
 */
export class CardView extends Container {
  readonly card: CardDef | null;
  readonly size: CardSize;

  #veil: Graphics;
  #lockLabel: Text;
  #outline: Graphics;

  constructor(card: CardDef | null, options: CardViewOptions = {}) {
    super();

    this.card = card;
    this.size = options.size ?? CARD;
    const { width, height, radius } = this.size;
    const scale = width / CARD.width;

    this.#outline = new Graphics()
      .roundRect(0, 0, width, height, radius)
      .fill(PAPER)
      .stroke({ width: STROKE, color: INK });
    this.addChild(this.#outline);

    if (options.faceDown || card === null) {
      this.#buildBack(width, height, scale);
    } else {
      this.#buildFace(card, width, height, scale);
    }

    this.#veil = new Graphics()
      .roundRect(0, 0, width, height, radius)
      .fill({ color: PAPER, alpha: 0.72 });
    this.#veil.visible = false;
    this.addChild(this.#veil);

    this.#lockLabel = new Text({ text: '', style: title(52 * scale, MUTED) });
    this.#lockLabel.anchor.set(0.5);
    this.#lockLabel.position.set(width / 2, height / 2);
    this.#lockLabel.visible = false;
    this.addChild(this.#lockLabel);

    // Pixi defaults to passive, so nothing is clickable until asked.
    this.eventMode = 'static';
    this.cursor = 'pointer';
  }

  #buildBack(width: number, height: number, scale: number): void {
    const pad = 16 * scale;
    this.addChild(
      new Graphics()
        .roundRect(pad, pad, width - pad * 2, height - pad * 2, 8 * scale)
        .stroke({ width: STROKE_THIN, color: INK }),
    );

    const mark = new Text({ text: '?', style: title(96 * scale, INK) });
    mark.anchor.set(0.5);
    mark.position.set(width / 2, height / 2);
    this.addChild(mark);
  }

  #buildFace(card: CardDef, width: number, height: number, scale: number): void {
    const pad = 14 * scale;
    const artHeight = height * 0.42;

    this.addChild(
      new Graphics()
        .roundRect(pad, pad, width - pad * 2, artHeight, 8 * scale)
        .stroke({ width: STROKE_THIN, color: INK }),
    );

    const glyph = new Text({
      text: TYPE_GLYPH[card.type],
      style: title(artHeight * 0.62, INK),
    });
    glyph.anchor.set(0.5);
    glyph.position.set(width / 2, pad + artHeight / 2);
    this.addChild(glyph);

    // Printed from the triangle rather than authored, so every card states the
    // matchup it wins on and no card text has to repeat it.
    const type = new Text({
      text: `${TYPE_LABEL[card.type]} BEATS ${TYPE_LABEL[COUNTERS[card.type]]}`,
      style: body(12 * scale, '700'),
    });
    type.anchor.set(0.5, 0);
    type.position.set(width / 2, pad + artHeight + 6 * scale);
    this.addChild(type);

    const name = new Text({ text: card.name.toUpperCase(), style: title(22 * scale) });
    name.anchor.set(0.5, 0);
    name.position.set(width / 2, pad + artHeight + 24 * scale);
    this.addChild(name);

    const text = new Text({
      text: card.text,
      style: wrapped(14 * scale, width - pad * 3),
    });
    text.anchor.set(0.5, 0);
    text.position.set(width / 2, pad + artHeight + 56 * scale);
    this.addChild(text);

    if (card.tags.length > 0) {
      const tags = new Text({
        text: card.tags.join(' / ').toUpperCase(),
        style: body(11 * scale, '700', MUTED),
      });
      tags.anchor.set(0.5, 1);
      tags.position.set(width / 2, height - 10 * scale);
      this.addChild(tags);
    }
  }

  /** Greyed for Cooldown, orange for a Stun inflicted by the opponent. */
  setLock(rounds: number, kind: 'cooldown' | 'stun'): void {
    const locked = rounds > 0;
    this.#veil.visible = locked;
    this.#lockLabel.visible = locked;
    this.#lockLabel.text = locked ? String(rounds) : '';
    this.#lockLabel.style.fill = kind === 'stun' ? STUN : MUTED;
    this.alpha = locked ? 0.85 : 1;
    this.cursor = locked ? 'default' : 'pointer';
  }

  setSelected(selected: boolean): void {
    this.#outline
      .clear()
      .roundRect(0, 0, this.size.width, this.size.height, this.size.radius)
      .fill(PAPER)
      .stroke({ width: selected ? STROKE + 3 : STROKE, color: selected ? BLOOD : INK });
  }
}
