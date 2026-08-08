import { Container, Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { INK, MUTED, PAPER, STROKE, STROKE_THIN } from './theme.ts';

const KNOB_RADIUS = 17;

/** A drawn track with an inked bead on it. Used only by the Prefs overlay. */
export class Slider extends Container {
  #width: number;
  #onChange: (value: number) => void;
  #track = new Graphics();
  #knob = new Graphics();
  #value: number;
  #dragging = false;

  constructor(width: number, value: number, onChange: (value: number) => void) {
    super();
    this.#width = width;
    this.#value = clamp01(value);
    this.#onChange = onChange;

    this.#knob
      .circle(0, 0, KNOB_RADIUS)
      .fill(PAPER)
      .stroke({ width: STROKE, color: INK });

    this.addChild(this.#track, this.#knob);
    this.#redraw();

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(
      -KNOB_RADIUS,
      -KNOB_RADIUS - 10,
      width + KNOB_RADIUS * 2,
      (KNOB_RADIUS + 10) * 2,
    );

    this.on('pointerdown', (event: FederatedPointerEvent) => {
      this.#dragging = true;
      this.#pick(event);
    });
    this.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (this.#dragging) this.#pick(event);
    });
    this.on('pointerup', () => (this.#dragging = false));
    this.on('pointerupoutside', () => (this.#dragging = false));
  }

  get value(): number {
    return this.#value;
  }

  set value(next: number) {
    this.#value = clamp01(next);
    this.#redraw();
  }

  #pick(event: FederatedPointerEvent): void {
    const local = this.toLocal(event.global);
    const next = clamp01(local.x / this.#width);
    if (next === this.#value) return;

    this.#value = next;
    this.#redraw();
    this.#onChange(next);
  }

  #redraw(): void {
    const filled = this.#width * this.#value;

    this.#track
      .clear()
      .moveTo(0, 0)
      .lineTo(this.#width, 0)
      .stroke({ width: STROKE_THIN, color: MUTED, cap: 'round' })
      .moveTo(0, 0)
      .lineTo(filled, 0)
      .stroke({ width: STROKE, color: INK, cap: 'round' });

    this.#knob.position.set(filled, 0);
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
