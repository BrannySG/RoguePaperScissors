import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { INK, PAPER, title } from '../theme.ts';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../viewport.ts';

const DOT_INTERVAL_MS = 380;

/**
 * A sheet of paper that comes down over everything between screens, and the
 * only thing showing while a Fight is being built. Transitions await it, so it
 * doubles as the loading screen rather than there being a second one.
 */
export class Curtain extends Container {
  #mark = new Text({ text: '', style: title(44, INK) });

  #from = 1;
  #to = 1;
  #elapsed = 0;
  #duration = 0;
  #settle: (() => void) | null = null;

  #loading = false;
  #dots = 0;
  #dotElapsed = 0;

  constructor() {
    super();

    this.addChild(
      new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(PAPER),
    );

    this.#mark.anchor.set(0.5);
    this.#mark.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    this.#mark.visible = false;
    this.addChild(this.#mark);

    // Opaque paper has to swallow clicks aimed at whatever is behind it.
    this.hitArea = new Rectangle(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    this.eventMode = 'static';
    this.alpha = 1;
  }

  cover(durationMs: number): Promise<void> {
    return this.#tween(1, durationMs);
  }

  reveal(durationMs: number): Promise<void> {
    return this.#tween(0, durationMs);
  }

  setLoading(loading: boolean): void {
    this.#loading = loading;
    this.#dots = 0;
    this.#dotElapsed = 0;
    this.#mark.visible = loading;
    this.#mark.text = '.';
  }

  #tween(to: number, durationMs: number): Promise<void> {
    // A transition cut short mid-tween must not leave the previous await hanging.
    this.#settle?.();

    if (durationMs <= 0) {
      this.alpha = to;
      this.#apply();
      return Promise.resolve();
    }

    this.#from = this.alpha;
    this.#to = to;
    this.#elapsed = 0;
    this.#duration = durationMs;

    return new Promise<void>((resolve) => {
      this.#settle = () => {
        this.#settle = null;
        this.#duration = 0;
        resolve();
      };
    });
  }

  update(deltaMs: number): void {
    if (this.#loading) {
      this.#dotElapsed += deltaMs;
      if (this.#dotElapsed >= DOT_INTERVAL_MS) {
        this.#dotElapsed -= DOT_INTERVAL_MS;
        this.#dots = (this.#dots + 1) % 3;
        this.#mark.text = '.'.repeat(this.#dots + 1);
      }
    }

    if (this.#duration > 0) {
      this.#elapsed += deltaMs;
      const progress = Math.min(1, this.#elapsed / this.#duration);
      // Eased at both ends so the sheet feels drawn across rather than snapped.
      const eased = progress * progress * (3 - 2 * progress);
      this.alpha = this.#from + (this.#to - this.#from) * eased;

      if (progress >= 1) {
        this.alpha = this.#to;
        const settle = this.#settle;
        this.#settle = null;
        this.#duration = 0;
        settle?.();
      }
    }

    this.#apply();
  }

  #apply(): void {
    const solid = this.alpha > 0.001;
    this.visible = solid;
    this.eventMode = solid ? 'static' : 'none';
  }
}
