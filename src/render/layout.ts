import type { FanOptions } from './fan.ts';

/**
 * Every position in the game, in the fixed 1920x1080 authoring space. Kept in
 * one place so `fan.test.ts` can assert against the values actually shipped
 * rather than copies of them.
 */
export const PLAYER_FAN: FanOptions = {
  centerX: 1360,
  baselineY: 830,
  radius: 720,
  facing: 1,
  maxSpread: 0.62,
  perCard: 0.15,
};

export const OPPONENT_FAN: FanOptions = {
  centerX: 430,
  // The arc lifts the outer cards and their rotation widens the vertical span,
  // so the baseline has to sit well below the frame edge, not near it.
  baselineY: 165,
  radius: 620,
  facing: -1,
  maxSpread: 0.62,
  perCard: 0.13,
};

/** A hovered or committed card rises and grows; both affect its bounds. */
export const HOVER_LIFT = 34;
export const HOVER_SCALE = 1.1;

export const PLAYER_PLATE = { x: 70, y: 950 } as const;
export const OPPONENT_PLATE = { x: 1470, y: 80 } as const;
export const COUNTDOWN = { x: 960, y: 470 } as const;
export const CLASH = { x: 960, y: 500 } as const;
export const BANNER = { x: 960, y: 250 } as const;

/** 3 Cores plus a Hand at the default cap. */
export const MAX_FAN_CARDS = 8;
