import { Container } from 'pixi.js';
import type { CardDef } from '../core/cards.ts';
import { CardView, type CardSize } from './cardView.ts';
import { fanLayout, type FanOptions } from './fan.ts';
import { HOVER_LIFT, HOVER_SCALE } from './layout.ts';

/**
 * Cards are built oversized and scaled down, so hover can enlarge them back
 * toward native resolution instead of magnifying an already-rasterised
 * texture. Pixi Text softens when scaled up past the size it was rendered at.
 */
const SUPERSAMPLE = 1.6;

export interface HandEntry {
  key: string;
  card: CardDef | null;
  faceDown: boolean;
  lockRounds: number;
  lockKind: 'cooldown' | 'stun';
  playable: boolean;
}

export interface HandViewOptions {
  size: CardSize;
  fan: FanOptions;
  interactive: boolean;
  onPick?: (index: number) => void;
}

export class HandView extends Container {
  #options: HandViewOptions;
  #entries: HandEntry[] = [];
  #views: CardView[] = [];
  #signature = '';
  #hovered = -1;
  #selected = -1;

  constructor(options: HandViewOptions) {
    super();
    this.#options = options;
  }

  get entries(): readonly HandEntry[] {
    return this.#entries;
  }

  setEntries(entries: HandEntry[]): void {
    const signature = entries
      .map((e) => `${e.key}:${e.faceDown}:${e.lockRounds}:${e.lockKind}:${e.playable}`)
      .join('|');

    if (signature === this.#signature) return;
    this.#signature = signature;
    this.#entries = entries;
    this.#rebuild();
  }

  setSelected(index: number): void {
    if (this.#selected === index) return;
    this.#selected = index;
    this.#views.forEach((view, i) => view.setSelected(i === index));
    this.#layout();
  }

  get selected(): number {
    return this.#selected;
  }

  #rebuild(): void {
    for (const view of this.#views) view.destroy({ children: true });
    this.#views = [];
    this.removeChildren();

    const { size, interactive } = this.#options;
    const big: CardSize = {
      width: size.width * SUPERSAMPLE,
      height: size.height * SUPERSAMPLE,
      radius: size.radius * SUPERSAMPLE,
    };

    this.#entries.forEach((entry, index) => {
      const view = new CardView(entry.card, { size: big, faceDown: entry.faceDown });
      view.scale.set(1 / SUPERSAMPLE);
      view.pivot.set(big.width / 2, big.height / 2);
      view.setLock(entry.lockRounds, entry.lockKind);

      if (interactive && entry.playable && entry.lockRounds === 0) {
        view.on('pointerover', () => {
          this.#hovered = index;
          this.#layout();
        });
        view.on('pointerout', () => {
          if (this.#hovered === index) this.#hovered = -1;
          this.#layout();
        });
        view.on('pointertap', () => this.#options.onPick?.(index));
      } else {
        view.eventMode = 'none';
        view.cursor = 'default';
      }

      this.#views.push(view);
      this.addChild(view);
    });

    // A stale hover index would keep a card of a previous Round raised.
    this.#selected = -1;
    this.#hovered = -1;
    this.#layout();
  }

  #layout(): void {
    const fan = this.#options.fan;
    const slots = fanLayout(this.#views.length, fan);

    this.#views.forEach((view, index) => {
      const slot = slots[index]!;
      const lifted = index === this.#hovered || index === this.#selected;
      const lift = lifted ? HOVER_LIFT * fan.facing : 0;

      view.position.set(slot.x, slot.y - lift);
      view.rotation = slot.rotation;
      view.scale.set((lifted ? HOVER_SCALE : 1) / SUPERSAMPLE);
      view.zIndex = lifted ? 100 : index;
    });

    this.sortableChildren = true;
    this.sortChildren();
  }
}
