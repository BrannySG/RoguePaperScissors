import type { FanOptions } from './fan.ts';

/**
 * Every position in the game, in the fixed 1920x1080 authoring space. Kept in
 * one place so `fan.test.ts` can assert against the values actually shipped
 * rather than copies of them.
 */
/**
 * The arc is wide and shallow rather than tight: a big radius spaces five cards
 * out along the curve without rotating the outer ones so far that their text
 * stops being readable.
 */
export const PLAYER_FAN: FanOptions = {
  centerX: 1360,
  baselineY: 830,
  radius: 950,
  facing: 1,
  maxSpread: 0.7,
  perCard: 0.175,
};

export const OPPONENT_FAN: FanOptions = {
  centerX: 430,
  // The arc lifts the outer cards and their rotation widens the vertical span,
  // so the baseline has to sit well below the frame edge, not near it.
  baselineY: 185,
  radius: 850,
  facing: -1,
  maxSpread: 0.6,
  perCard: 0.15,
};

/** A hovered or committed card rises and grows; both affect its bounds. */
export const HOVER_LIFT = 34;
export const HOVER_SCALE = 1.1;

export const PLAYER_PLATE = { x: 70, y: 950 } as const;
export const OPPONENT_PLATE = { x: 1470, y: 80 } as const;
export const COUNTDOWN = { x: 960, y: 470 } as const;
export const CLASH = { x: 960, y: 500 } as const;
/** Above the Clash verdict, which claims the band just under it. */
export const BANNER = { x: 960, y: 150 } as const;

/** A full Hand: 3 Cores plus Tricks at the default cap. */
export const MAX_FAN_CARDS = 5;
