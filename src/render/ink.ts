import { Graphics } from 'pixi.js';
import { INK, STROKE } from './theme.ts';

export interface SquiggleOptions {
  amplitude?: number;
  waves?: number;
  color?: number;
  width?: number;
}

/**
 * A wobbling pen stroke. Everything here is drawn rather than illustrated, so
 * an underline or a crossing-out has to look like a hand rather than a rule.
 */
export function squiggle(length: number, options: SquiggleOptions = {}): Graphics {
  const amplitude = options.amplitude ?? 6;
  const waves = options.waves ?? 5;
  const steps = Math.max(24, Math.round(waves * 12));

  const line = new Graphics();
  line.moveTo(0, 0);

  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    // Tapering the ends keeps the stroke from starting and finishing mid-wobble.
    const taper = Math.sin(progress * Math.PI);
    const y = Math.sin(progress * waves * Math.PI * 2) * amplitude * taper;
    line.lineTo(progress * length, y);
  }

  line.stroke({
    width: options.width ?? STROKE,
    color: options.color ?? INK,
    cap: 'round',
    join: 'round',
  });

  return line;
}
