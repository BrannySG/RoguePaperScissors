import { Container, Graphics, Text } from 'pixi.js';
import type { EchoView } from '../core/view.ts';
import { body, BLOOD, ECHO, INK, MUTED, PAPER, STROKE, STUN, title } from './theme.ts';

const BAR = { width: 380, height: 42, radius: 8 } as const;
const LINE = 26;

export interface PlateState {
  hp: number;
  maxHp: number;
  handCount: number;
  handCap: number;
  echoes: readonly EchoView[];
  /** Rendered near the bar, e.g. "SUDDEN DEATH" or "LOCKED IN". */
  notes: readonly string[];
}

/** Name, HP bar, Hand counter and the readout of revealed Echoes. */
export class CombatantPlate extends Container {
  #fill = new Graphics();
  #hpText: Text;
  #handText: Text;
  #echoText: Text;
  #noteText: Text;
  #align: 'left' | 'right';

  /**
   * `stack` is the direction the readout grows, and must point away from the
   * nearest screen edge. The player's plate sits at the bottom of a fixed
   * 1080-tall frame, so growing downward would run its Echo lines off-screen.
   */
  constructor(name: string, align: 'left' | 'right', stack: 'down' | 'up' = 'down') {
    super();
    this.#align = align;

    const anchorX = align === 'left' ? 0 : 1;
    const originX = align === 'left' ? 0 : BAR.width;
    const down = stack === 'down';

    this.addChild(this.#fill);
    this.addChild(
      new Graphics()
        .roundRect(0, 0, BAR.width, BAR.height, BAR.radius)
        .stroke({ width: STROKE, color: INK }),
    );

    this.#hpText = new Text({ text: '', style: body(20, '800') });
    this.#hpText.anchor.set(1, 0.5);
    this.#hpText.position.set(BAR.width - 14, BAR.height / 2);
    this.addChild(this.#hpText);

    // Downward stacks read name, bar, then details. Upward stacks reverse it so
    // the bar always stays closest to the screen edge.
    const nameY = -12;
    const detailStart = down ? BAR.height + 12 : nameY - 46;
    const step = down ? LINE : -LINE;
    const anchorY = down ? 0 : 1;

    const label = new Text({ text: name, style: title(38) });
    label.anchor.set(anchorX, 1);
    label.position.set(originX, nameY);
    this.addChild(label);

    this.#handText = new Text({ text: '', style: body(18, '700', MUTED) });
    this.#handText.anchor.set(anchorX, anchorY);
    this.#handText.position.set(originX, detailStart);
    this.addChild(this.#handText);

    this.#noteText = new Text({ text: '', style: body(17, '700', STUN) });
    this.#noteText.anchor.set(anchorX, anchorY);
    this.#noteText.position.set(originX, detailStart + step);
    this.addChild(this.#noteText);

    this.#echoText = new Text({ text: '', style: body(17, '700', ECHO) });
    this.#echoText.anchor.set(anchorX, anchorY);
    this.#echoText.position.set(originX, detailStart + step * 2);
    this.addChild(this.#echoText);
  }

  update(state: PlateState): void {
    const ratio = Math.max(0, Math.min(1, state.hp / Math.max(1, state.maxHp)));
    const width = BAR.width * ratio;

    this.#fill.clear();
    if (width > 1) {
      // Drains toward the screen edge so both bars empty outward.
      const x = this.#align === 'left' ? 0 : BAR.width - width;
      this.#fill.roundRect(x, 0, width, BAR.height, BAR.radius).fill(BLOOD);
    }

    this.#hpText.text = `${state.hp} HP`;
    this.#hpText.style.fill = ratio > 0.35 ? PAPER : INK;

    this.#handText.text = `HAND ${state.handCount}/${state.handCap}`;
    this.#noteText.text = state.notes.join('   ');
    this.#echoText.text = state.echoes.map((echo) => echo.label).join('\n');
  }
}
