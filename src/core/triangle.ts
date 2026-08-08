import type { CardDef, CardType } from './cards.ts';
import type { PlayerId } from './state.ts';

/**
 * The one relation the engine owns outright. It names the Winner of a Clash and
 * takes no part in what that Winner then does — see docs/adr/0004.
 */
export const COUNTERS: Readonly<Record<CardType, CardType>> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export function counters(type: CardType, against: CardType): boolean {
  return COUNTERS[type] === against;
}

export type ClashOutcome =
  | { kind: 'decided'; winner: PlayerId }
  | { kind: 'stalemate' }
  | { kind: 'noPlay' };

/**
 * A committed card facing nothing wins unopposed: there is no Type present to
 * Counter it. Reachable once enough Stun effects stack.
 */
export function clashOutcome(
  cards: readonly [CardDef | null, CardDef | null],
): ClashOutcome {
  const [self, foe] = cards;

  if (self === null && foe === null) return { kind: 'noPlay' };
  if (foe === null) return { kind: 'decided', winner: 0 };
  if (self === null) return { kind: 'decided', winner: 1 };

  if (self.type === foe.type) return { kind: 'stalemate' };
  return { kind: 'decided', winner: counters(self.type, foe.type) ? 0 : 1 };
}
