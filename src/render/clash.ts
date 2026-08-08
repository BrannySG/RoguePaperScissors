import { Container, Graphics, Text } from 'pixi.js';
import type { CardDef } from '../core/cards.ts';
import type { PlayerId } from '../core/state.ts';
import { CardView, TYPE_LABEL } from './cardView.ts';
import { body, CARD, INK, MUTED, title } from './theme.ts';

const SUPERSAMPLE = 1.5;
const SPREAD = 250;

/**
 * The beat sheet, in milliseconds. `READ` is the whole point of the sequence:
 * both cards sit still and legible before anything moves, because a Clash the
 * player could not read is a Clash they cannot learn from.
 */
const READ_MS = 1200;
const WINDUP_MS = 420;
const STRIKE_MS = 170;
const KNOCKOUT_MS = 860;
const REPORT_MS = 1350;
const SHAKE_MS = 240;
const BURST_MS = 280;

export type ClashBeat = 'reveal' | 'windup' | 'impact' | 'report';

export interface ClashSide {
  card: CardDef | null;
  /** Rises off this side once the blow lands: damage taken, healing, or a note. */
  float: string;
  floatColor: number;
}

export interface ClashScript {
  sides: readonly [ClashSide, ClashSide];
  /** Whose card Countered the other's. null on a Stalemate or an empty Clash. */
  winner: PlayerId | null;
  stalemate: boolean;
}

interface Slot {
  holder: Container;
  caption: Text;
  float: Text;
  homeX: number;
}

interface Marks {
  windup: number;
  strike: number;
  knock: number;
  report: number;
  end: number;
}

interface Pose {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  alpha: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (t: number): number => t * t * (3 - 2 * t);
const easeIn = (t: number): number => t * t;
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** Progress through a phase, 0 when the phase has no length at all. */
const phase = (elapsed: number, start: number, length: number): number =>
  length <= 0 ? (elapsed >= start ? 1 : 0) : clamp01((elapsed - start) / length);

function starburst(): Graphics {
  const spikes = new Graphics();

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    spikes
      .moveTo(Math.cos(angle) * 18, Math.sin(angle) * 18)
      .lineTo(Math.cos(angle) * 74, Math.sin(angle) * 74)
      .stroke({ width: 9, color: INK });
  }

  return spikes;
}

function verdictFor(script: ClashScript): string {
  if (script.stalemate) return 'STALEMATE';
  if (script.winner === null) return 'NO PLAY';

  const won = script.sides[script.winner]!.card;
  const lost = script.sides[script.winner === 0 ? 1 : 0]!.card;
  if (won === null) return 'NO PLAY';
  if (lost === null) return `${TYPE_LABEL[won.type]} UNOPPOSED`;

  return `${TYPE_LABEL[won.type]} BEATS ${TYPE_LABEL[lost.type]}`;
}

/**
 * The reveal. Both cards arrive together and hold, then the Winner winds up and
 * knocks the Loser out of the frame; matching Types charge and both go down.
 */
export class ClashView extends Container {
  #stage = new Container();
  #cards = new Container();
  #effects = new Container();
  #labels = new Container();

  #slots: Slot[] = [];
  #verdict: Text;
  #burst = starburst();
  #onBeat: (beat: ClashBeat) => void;

  #script: ClashScript | null = null;
  #elapsed = 0;
  #marks: Marks = { windup: 0, strike: 0, knock: 0, report: 0, end: 0 };
  #announced = new Set<ClashBeat>();

  constructor(onBeat: (beat: ClashBeat) => void) {
    super();
    this.#onBeat = onBeat;

    this.#cards.sortableChildren = true;
    this.#stage.addChild(this.#cards, this.#effects, this.#labels);
    this.addChild(this.#stage);

    for (const [index, caption] of ['YOU', 'OPPONENT'].entries()) {
      const homeX = index === 0 ? -SPREAD : SPREAD;

      const holder = new Container();
      holder.x = homeX;

      const captionText = new Text({ text: caption, style: body(22, '800', MUTED) });
      captionText.anchor.set(0.5, 1);
      captionText.position.set(homeX, -CARD.height / 2 - 24);

      const floatText = new Text({ text: '', style: title(58, INK) });
      floatText.anchor.set(0.5);
      floatText.position.set(homeX, 0);

      this.#cards.addChild(holder);
      this.#labels.addChild(captionText, floatText);
      this.#slots.push({ holder, caption: captionText, float: floatText, homeX });
    }

    this.#burst.visible = false;
    this.#effects.addChild(this.#burst);

    this.#verdict = new Text({ text: '', style: title(50, INK) });
    this.#verdict.anchor.set(0.5);
    this.#verdict.position.set(0, -CARD.height / 2 - 100);
    this.#labels.addChild(this.#verdict);

    this.visible = false;
  }

  get playing(): boolean {
    return this.#script !== null;
  }

  play(script: ClashScript): void {
    const fought = script.winner !== null || script.stalemate;

    this.#script = script;
    this.#elapsed = 0;
    this.#announced.clear();
    // Nothing to animate when neither combatant could commit, so the sequence
    // collapses to the read pause and the report.
    const strike = READ_MS + WINDUP_MS;
    const knock = strike + STRIKE_MS;
    const report = fought ? knock + KNOCKOUT_MS : READ_MS;

    this.#marks = {
      windup: READ_MS,
      strike: fought ? strike : READ_MS,
      knock: fought ? knock : READ_MS,
      report,
      end: report + REPORT_MS,
    };

    this.visible = true;
    this.#burst.visible = false;
    // The blow lands where the Loser was standing; a Stalemate meets in the middle.
    this.#burst.x =
      script.winner === null ? 0 : this.#slots[script.winner === 0 ? 1 : 0]!.homeX;

    for (const [index, side] of script.sides.entries()) {
      const slot = this.#slots[index]!;
      for (const child of slot.holder.removeChildren()) child.destroy({ children: true });
      slot.holder.addChild(side.card === null ? this.#emptyLabel() : this.#face(side.card));
      slot.holder.zIndex = script.winner === index ? 2 : 1;

      slot.float.text = side.float;
      slot.float.style.fill = side.floatColor;
      // Numbers are the payload and want to be loud; a note is just a note.
      slot.float.style.fontSize = /^[-+]/.test(side.float) ? 58 : 34;
      slot.float.alpha = 0;
    }

    this.#verdict.text = verdictFor(script);
    this.#verdict.alpha = 0;
    this.#draw();
  }

  /** Returns true on the frame the sequence finishes. */
  update(deltaMs: number): boolean {
    if (this.#script === null) return false;

    this.#elapsed += deltaMs;
    this.#draw();

    if (this.#elapsed < this.#marks.end) return false;

    this.#script = null;
    this.visible = false;
    this.#stage.position.set(0, 0);
    return true;
  }

  #face(card: CardDef): CardView {
    const view = new CardView(card, {
      size: {
        width: CARD.width * SUPERSAMPLE,
        height: CARD.height * SUPERSAMPLE,
        radius: CARD.radius * SUPERSAMPLE,
      },
    });

    view.eventMode = 'none';
    view.scale.set(1 / SUPERSAMPLE);
    view.pivot.set((CARD.width * SUPERSAMPLE) / 2, (CARD.height * SUPERSAMPLE) / 2);
    return view;
  }

  #emptyLabel(): Text {
    const label = new Text({ text: 'NO PLAY', style: title(34, MUTED) });
    label.anchor.set(0.5);
    return label;
  }

  #announce(beat: ClashBeat, reached: boolean): void {
    if (!reached || this.#announced.has(beat)) return;
    this.#announced.add(beat);
    this.#onBeat(beat);
  }

  #draw(): void {
    const script = this.#script;
    if (script === null) return;

    const t = this.#elapsed;
    const marks = this.#marks;
    const fought = script.winner !== null || script.stalemate;

    this.#announce('reveal', true);
    this.#announce('windup', t >= marks.windup && fought);
    this.#announce('impact', t >= marks.knock && fought);
    this.#announce('report', t >= marks.report);

    // Cards slam in rather than appearing, so the reveal has a front edge.
    const arrival = smooth(phase(t, 0, 200));

    for (const index of [0, 1] as const) {
      const slot = this.#slots[index]!;
      const move = script.stalemate
        ? this.#stalemateMove(index, t)
        : this.#decidedMove(index, script.winner, t);

      slot.holder.position.set(slot.homeX + move.x, move.y);
      slot.holder.rotation = move.rotation;
      slot.holder.scale.set(move.scale * lerp(1.3, 1, arrival));
      slot.holder.alpha = move.alpha * arrival;
      slot.caption.alpha = arrival * (1 - clamp01((t - marks.report) / 300) * 0.6);

      const rise = smooth(phase(t, marks.report, 420));
      const fade = 1 - phase(t, marks.end - 320, 320);
      slot.float.alpha = slot.float.text === '' ? 0 : rise * fade;
      slot.float.y = lerp(10, -110, rise);
    }

    this.#verdict.alpha = smooth(phase(t, marks.knock, 260));

    const burst = phase(t, marks.knock, BURST_MS);
    this.#burst.visible = fought && burst > 0 && burst < 1;
    this.#burst.scale.set(lerp(0.35, 2.3, easeOut(burst)));
    this.#burst.alpha = 1 - burst;

    const shake = t - marks.knock;
    if (fought && shake >= 0 && shake < SHAKE_MS) {
      const decay = 1 - shake / SHAKE_MS;
      this.#stage.position.set(
        Math.sin(shake * 0.13) * 18 * decay,
        Math.cos(shake * 0.19) * 12 * decay,
      );
    } else {
      this.#stage.position.set(0, 0);
    }
  }

  /** The Winner pulls back, drives through the Loser, and settles home. */
  #decidedMove(index: PlayerId, winner: PlayerId | null, t: number): Pose {
    const still: Pose = { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 };
    if (winner === null) return still;

    const marks = this.#marks;
    const toward = winner === 0 ? 1 : -1;
    const reach = SPREAD * 2 - 120;

    if (index === winner) {
      const windup = smooth(phase(t, marks.windup, WINDUP_MS));
      const strike = easeIn(phase(t, marks.strike, STRIKE_MS));
      const recover = easeOut(phase(t, marks.knock, KNOCKOUT_MS * 0.5));

      const drawn = -toward * 90 * windup;
      const thrust = lerp(drawn, toward * reach, strike);

      return {
        x: lerp(thrust, 0, recover),
        y: 0,
        rotation: lerp(lerp(-toward * 0.12 * windup, toward * 0.2, strike), 0, recover),
        scale: lerp(1 + 0.06 * windup, 1, recover),
        alpha: 1,
      };
    }

    const fall = phase(t, marks.knock, KNOCKOUT_MS);
    if (fall === 0) return still;

    return {
      x: toward * 560 * easeOut(fall),
      y: -220 * fall + 700 * fall * fall,
      rotation: toward * 2.8 * fall,
      scale: 1,
      alpha: 1 - clamp01((fall - 0.55) / 0.45),
    };
  }

  /** Matching Types both commit to the swing and both end up on the floor. */
  #stalemateMove(index: PlayerId, t: number): Pose {
    const marks = this.#marks;
    const toward = index === 0 ? 1 : -1;

    const windup = smooth(phase(t, marks.windup, WINDUP_MS));
    const charge = easeIn(phase(t, marks.strike, STRIKE_MS));
    const flop = smooth(phase(t, marks.knock, KNOCKOUT_MS));

    const drawn = -toward * 70 * windup;
    const met = lerp(drawn, toward * (SPREAD - 105), charge);

    return {
      x: lerp(met, toward * (SPREAD - 165), flop),
      y: 200 * easeIn(flop),
      rotation: lerp(-toward * 0.1 * windup, toward * 1.5, flop),
      scale: lerp(1 + 0.05 * windup, 1, flop),
      alpha: 1 - 0.45 * flop,
    };
  }
}
