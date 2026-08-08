import {
  xoroshiro128plus,
  xoroshiro128plusFromState,
} from 'pure-rand/generator/xoroshiro128plus';
import { uniformInt } from 'pure-rand/distribution/uniformInt';

/**
 * Independent random streams. Consuming randomness in one stream must never
 * shift another, so that (for example) a card effect rolling a discard cannot
 * change which cards the opponent would have been offered.
 */
export const STREAMS = ['draftP0', 'draftP1', 'combat', 'bot'] as const;
export type StreamName = (typeof STREAMS)[number];

/**
 * Streams are stored as plain number arrays rather than live generator objects
 * so that the whole game state stays JSON-serializable and hashable. Each draw
 * rebuilds a generator, advances it, and stores the new state back.
 */
export type RngState = Readonly<Record<StreamName, readonly number[]>>;

/** Derives one well-separated stream per concern by jumping 2^64 steps each. */
export function seedStreams(seed: number): RngState {
  const generator = xoroshiro128plus(seed);
  const streams = {} as Record<StreamName, readonly number[]>;

  for (const name of STREAMS) {
    generator.jump();
    streams[name] = generator.getState();
  }

  return streams;
}

function draw(
  rng: RngState,
  stream: StreamName,
  min: number,
  max: number,
): [number, RngState] {
  const generator = xoroshiro128plusFromState(rng[stream]);
  const value = uniformInt(generator, min, max);
  return [value, { ...rng, [stream]: generator.getState() }];
}

/** Uniform integer in [min, max], both inclusive. */
export function nextInt(
  rng: RngState,
  stream: StreamName,
  min: number,
  max: number,
): [number, RngState] {
  if (max < min) throw new Error(`nextInt: empty range ${min}..${max}`);
  return draw(rng, stream, min, max);
}

export function pick<T>(
  rng: RngState,
  stream: StreamName,
  items: readonly T[],
): [T, RngState] {
  if (items.length === 0) throw new Error('pick: empty collection');
  const [index, next] = draw(rng, stream, 0, items.length - 1);
  return [items[index]!, next];
}

export function weightedPick<T>(
  rng: RngState,
  stream: StreamName,
  items: readonly T[],
  weightOf: (item: T) => number,
): [T, RngState] {
  if (items.length === 0) throw new Error('weightedPick: empty collection');

  const weights = items.map((item) => Math.max(0, Math.round(weightOf(item))));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return pick(rng, stream, items);

  const [roll, next] = draw(rng, stream, 1, total);

  let running = 0;
  for (let i = 0; i < items.length; i++) {
    running += weights[i]!;
    if (roll <= running) return [items[i]!, next];
  }

  return [items[items.length - 1]!, next];
}

/** Fisher-Yates, drawing from the given stream. */
export function shuffle<T>(
  rng: RngState,
  stream: StreamName,
  items: readonly T[],
): [T[], RngState] {
  const result = [...items];
  let cursor = rng;

  for (let i = result.length - 1; i > 0; i--) {
    const [j, next] = draw(cursor, stream, 0, i);
    cursor = next;
    [result[i], result[j]] = [result[j]!, result[i]!];
  }

  return [result, cursor];
}

/** Picks up to `count` distinct items, weighted. Used for draft offers. */
export function weightedSample<T>(
  rng: RngState,
  stream: StreamName,
  items: readonly T[],
  count: number,
  weightOf: (item: T) => number,
): [T[], RngState] {
  const remaining = [...items];
  const chosen: T[] = [];
  let cursor = rng;

  while (chosen.length < count && remaining.length > 0) {
    const [item, next] = weightedPick(cursor, stream, remaining, weightOf);
    cursor = next;
    chosen.push(item);
    remaining.splice(remaining.indexOf(item), 1);
  }

  return [chosen, cursor];
}
