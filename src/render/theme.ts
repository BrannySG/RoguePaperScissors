import type { TextStyleOptions } from 'pixi.js';
import { FONT_BODY, FONT_DISPLAY } from './fonts.ts';

export const PAPER = 0xffffff;
export const INK = 0x111111;
export const BLOOD = 0xe23b30;
export const ECHO = 0x1f9d4d;
export const MUTED = 0xb4b4b4;
export const STUN = 0xd9822b;

/** Thick, even linework is what carries the hand-inked look without artwork. */
export const STROKE = 5;
export const STROKE_THIN = 3;

export const CARD = { width: 210, height: 300, radius: 14 } as const;
export const CARD_SMALL = { width: 150, height: 214, radius: 10 } as const;

export const title = (size: number, fill = INK): TextStyleOptions => ({
  fontFamily: FONT_DISPLAY,
  fontSize: size,
  fill,
});

export const body = (
  size: number,
  weight: TextStyleOptions['fontWeight'] = '600',
  fill = INK,
): TextStyleOptions => ({
  fontFamily: FONT_BODY,
  fontSize: size,
  fontWeight: weight,
  fill,
});

export const wrapped = (
  size: number,
  width: number,
  fill = INK,
): TextStyleOptions => ({
  ...body(size, '600', fill),
  wordWrap: true,
  wordWrapWidth: width,
  align: 'center',
  lineHeight: size * 1.15,
});
