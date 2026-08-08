import { describe, expect, it } from 'vitest';
import { CORE_IDS } from '../cards/library.ts';
import { DEFAULT_RULESET } from '../core/ruleset.ts';
import { fanLayout, type FanOptions } from './fan.ts';
import {
  HOVER_LIFT,
  HOVER_SCALE,
  MAX_FAN_CARDS,
  OPPONENT_FAN,
  PLAYER_FAN,
} from './layout.ts';
import { CARD, CARD_SMALL } from './theme.ts';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './viewport.ts';

/** Distance between the centres of neighbouring cards, at their tightest. */
function closestGap(fan: FanOptions, count: number): number {
  const slots = fanLayout(count, fan);

  return slots.slice(1).reduce((tightest, slot, index) => {
    const previous = slots[index]!;
    const gap = Math.hypot(slot.x - previous.x, slot.y - previous.y);
    return Math.min(tightest, gap);
  }, Infinity);
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Axis-aligned bounds of a rotated, possibly hover-scaled card. */
function boundsOf(
  slot: { x: number; y: number; rotation: number },
  size: { width: number; height: number },
  facing: 1 | -1,
  hovered: boolean,
): Box {
  const scale = hovered ? HOVER_SCALE : 1;
  const halfW = (size.width * scale) / 2;
  const halfH = (size.height * scale) / 2;

  const cos = Math.abs(Math.cos(slot.rotation));
  const sin = Math.abs(Math.sin(slot.rotation));

  const spanX = halfW * cos + halfH * sin;
  const spanY = halfH * cos + halfW * sin;

  const y = slot.y - (hovered ? HOVER_LIFT * facing : 0);

  return {
    left: slot.x - spanX,
    right: slot.x + spanX,
    top: y - spanY,
    bottom: y + spanY,
  };
}

function worstBounds(
  fan: FanOptions,
  size: { width: number; height: number },
  count: number,
): Box {
  const slots = fanLayout(count, fan);
  const boxes = slots.flatMap((slot) => [
    boundsOf(slot, size, fan.facing, false),
    boundsOf(slot, size, fan.facing, true),
  ]);

  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

describe('fan geometry', () => {
  it('spreads evenly and stays symmetrical about the centre', () => {
    const slots = fanLayout(5, PLAYER_FAN);
    const middle = slots[2]!;

    expect(middle.x).toBeCloseTo(PLAYER_FAN.centerX, 5);
    expect(middle.rotation).toBeCloseTo(0, 5);
    expect(slots[0]!.rotation).toBeCloseTo(-slots[4]!.rotation, 5);
    expect(slots[0]!.x - PLAYER_FAN.centerX).toBeCloseTo(
      PLAYER_FAN.centerX - slots[4]!.x,
      5,
    );
  });

  it('caps the total spread however many cards are held', () => {
    const wide = fanLayout(MAX_FAN_CARDS, PLAYER_FAN);
    const span = wide[wide.length - 1]!.rotation - wide[0]!.rotation;
    expect(span).toBeLessThanOrEqual(PLAYER_FAN.maxSpread + 1e-9);
  });

  it('places a single card exactly on the baseline', () => {
    const [only] = fanLayout(1, PLAYER_FAN);
    expect(only!.x).toBeCloseTo(PLAYER_FAN.centerX, 5);
    expect(only!.y).toBeCloseTo(PLAYER_FAN.baselineY, 5);
    expect(only!.rotation).toBeCloseTo(0, 5);
  });

  it('returns nothing for an empty Hand', () => {
    expect(fanLayout(0, PLAYER_FAN)).toEqual([]);
  });

  it('sizes the fan to a full Hand of Cores plus Tricks', () => {
    expect(MAX_FAN_CARDS).toBe(CORE_IDS.length + DEFAULT_RULESET.handCap);
  });

  it('leaves every card in a full Hand readable on its own', () => {
    // Cards overlap by design, but a card covered past its name and text cannot
    // be chosen under a countdown. Roughly three quarters has to stay visible.
    expect(closestGap(PLAYER_FAN, MAX_FAN_CARDS)).toBeGreaterThan(CARD.width * 0.75);
    expect(closestGap(OPPONENT_FAN, MAX_FAN_CARDS)).toBeGreaterThan(
      CARD_SMALL.width * 0.75,
    );
  });
});

describe('fans stay inside the frame', () => {
  // Guards the layout numbers that cannot be eyeballed in a unit test: a full
  // Hand plus a hovered card is the worst case for spilling off-screen.
  for (let count = 1; count <= MAX_FAN_CARDS; count++) {
    it(`fits the player's fan with ${count} card(s)`, () => {
      const box = worstBounds(PLAYER_FAN, CARD, count);

      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(VIRTUAL_WIDTH);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(VIRTUAL_HEIGHT);
    });

    it(`fits the opponent's fan with ${count} card(s)`, () => {
      const box = worstBounds(OPPONENT_FAN, CARD_SMALL, count);

      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(VIRTUAL_WIDTH);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(VIRTUAL_HEIGHT);
    });
  }

  it('keeps the two fans from colliding with each other', () => {
    const player = worstBounds(PLAYER_FAN, CARD, MAX_FAN_CARDS);
    const opponent = worstBounds(OPPONENT_FAN, CARD_SMALL, MAX_FAN_CARDS);

    const disjoint = player.top > opponent.bottom || player.left > opponent.right;
    expect(disjoint).toBe(true);
  });
});
