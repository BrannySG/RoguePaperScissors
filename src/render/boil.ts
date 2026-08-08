import {
  BufferImageSource,
  DisplacementFilter,
  Rectangle,
  Sprite,
  Texture,
  type Application,
  type Container,
} from 'pixi.js';
import type { PrefsStore } from '../prefs.ts';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './viewport.ts';

/** Lattice resolution. Bilinear upscaling is what turns it into smooth noise. */
const CELLS = 512;
/**
 * Virtual pixels per cell, so roughly 120 wobbles span the 1920 frame.
 *
 * This is the number that decides whether the Boil reads as a line being redrawn
 * or as the picture sliding about. Anything smaller than a cell is displaced
 * near-uniformly and so moves bodily rather than bending, and at 80 - the first
 * value tried - that covered every glyph and every corner on screen. A few times
 * the 5px STROKE is about right: the width of a line still moves as one, which
 * keeps it clean, while its length picks up enough variation to look drawn.
 */
const CELL_SIZE = 16;
const MAP_SIZE = CELLS * CELL_SIZE;

/**
 * Peak-to-peak displacement in virtual pixels, so lines move half a pixel either
 * way. It reads as a shimmer along an edge rather than as travel, which is the
 * point - and it moves in step with CELL_SIZE, since it is the ratio between the
 * two that decides how ragged a line gets rather than either one alone.
 *
 * Also a ceiling worth keeping: pointer hit testing runs against the unwarped
 * display list, so where a button appears and where it can be clicked drift
 * apart by exactly this much.
 */
const AMPLITUDE = 1;

/**
 * 8fps. The held frame is the whole effect - advancing every render frame reads
 * as heat haze rather than as a hand redrawing the same shape.
 */
const BEAT_MS = 125;

/**
 * The Boil: every line shimmers as though redrawn by hand. One displacement pass
 * over the whole sheet, so nothing that draws has to know it exists.
 *
 * Warping the flat PAPER fill is invisible, which is why this reads as ink
 * moving rather than as the picture rippling - the only pixels where the offset
 * shows are the ones with ink on them. See docs/adr/0005.
 */
export class Boil {
  #app: Application;
  #root: Container;
  #prefs: PrefsStore;
  #filter: DisplacementFilter;
  #map: Sprite;
  #sinceBeat = BEAT_MS;

  constructor(app: Application, root: Container, prefs: PrefsStore) {
    this.#app = app;
    this.#root = root;
    this.#prefs = prefs;

    // The filter reads the sprite's worldTransform every frame, so it has to be
    // in the display list. Its constructor marks the sprite unrenderable for us.
    this.#map = new Sprite(noise());
    this.#map.scale.set(CELL_SIZE);
    root.addChild(this.#map);

    this.#filter = new DisplacementFilter({ sprite: this.#map, scale: AMPLITUDE });

    // Pinned rather than measured: the filter region is the sheet, not the
    // union of everything on it, and certainly not the oversized noise map.
    // Local coordinates - Pixi applies the container's worldTransform itself.
    root.filterArea = new Rectangle(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    this.#rescale();
    app.renderer.on('resize', this.#rescale);

    this.#advance();
    this.#apply();
  }

  get enabled(): boolean {
    return this.#prefs.boil;
  }

  set enabled(value: boolean) {
    if (value === this.#prefs.boil) return;
    this.#prefs.boil = value;
    this.#apply();
  }

  update(deltaMs: number): void {
    if (!this.#prefs.boil) return;

    this.#sinceBeat += deltaMs;
    if (this.#sinceBeat < BEAT_MS) return;

    this.#sinceBeat %= BEAT_MS;
    this.#advance();
  }

  destroy(): void {
    this.#app.renderer.off('resize', this.#rescale);
    this.#root.filters = [];
    this.#map.destroy();
  }

  /**
   * Jumps to a fresh part of the noise field. Unseeded on purpose: the frame only
   * ever sees a quarter of the map at once, so landing close enough to the last
   * offset to look like drift rather than a redraw is a rare beat.
   */
  #advance(): void {
    this.#map.position.set(-Math.random() * MAP_SIZE, -Math.random() * MAP_SIZE);
  }

  /**
   * The filter displaces by a count of render-target pixels, which is screen
   * size times devicePixelRatio. Left alone the Boil would fade out on large or
   * high-density displays, so the amplitude is converted from virtual pixels
   * every time the letterbox is laid out again.
   */
  #rescale = (): void => {
    this.#filter.scale.set(AMPLITUDE * this.#root.scale.x * this.#app.renderer.resolution);
  };

  /** An empty list drops the filter outright, so off costs nothing at all. */
  #apply(): void {
    this.#root.filters = this.#prefs.boil ? [this.#filter] : [];
  }
}

/**
 * A lattice of random offsets, smoothed into gentle gradients by the sampler
 * rather than by us. Generated instead of loaded: this is the only texture in
 * the game and it would be the only asset in the repo.
 */
function noise(): Texture {
  const pixels = new Uint8Array(CELLS * CELLS * 4);

  for (let i = 0; i < CELLS * CELLS; i++) {
    // Red displaces horizontally and green vertically; 128 is standing still.
    pixels[i * 4] = Math.floor(Math.random() * 256);
    pixels[i * 4 + 1] = Math.floor(Math.random() * 256);
    pixels[i * 4 + 2] = 128;
    pixels[i * 4 + 3] = 255;
  }

  return new Texture({
    source: new BufferImageSource({
      resource: pixels,
      width: CELLS,
      height: CELLS,
      // Stated rather than inferred, which would give BGRA and swap the axes.
      format: 'rgba8unorm',
      scaleMode: 'linear',
      addressMode: 'repeat',
    }),
  });
}
