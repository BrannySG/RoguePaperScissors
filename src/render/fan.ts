export interface FanSlot {
  x: number;
  y: number;
  rotation: number;
}

export interface FanOptions {
  centerX: number;
  /** Where the middle card sits. The arc bows away from this line. */
  baselineY: number;
  radius: number;
  /** Total spread in radians, whatever the card count. */
  maxSpread: number;
  /** Spread per gap, until maxSpread caps it. */
  perCard: number;
  /** 1 for the player's fan along the bottom, -1 for the opponent's on top. */
  facing: 1 | -1;
}

/**
 * Positions along an arc. Computed directly rather than through a layout
 * engine: with a fixed virtual resolution, arc maths is simpler than arguing
 * flexbox into a curve. See docs/adr/0003.
 */
export function fanLayout(count: number, options: FanOptions): FanSlot[] {
  if (count <= 0) return [];

  const spread = Math.min(options.maxSpread, options.perCard * (count - 1));
  const step = count > 1 ? spread / (count - 1) : 0;
  const start = -spread / 2;
  const { centerX, baselineY, radius, facing } = options;

  return Array.from({ length: count }, (_, index) => {
    const angle = start + step * index;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    if (facing === 1) {
      return {
        x: centerX + radius * sin,
        y: baselineY + radius - radius * cos,
        rotation: angle,
      };
    }

    return {
      x: centerX - radius * sin,
      y: baselineY - radius + radius * cos,
      rotation: -angle,
    };
  });
}
