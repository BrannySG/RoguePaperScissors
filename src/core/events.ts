import type { CardType } from './cards.ts';
import type { Outcome, PlayerId } from './state.ts';

/**
 * What actually happened. The state is the authority; the renderer animates
 * from this stream, so anything the player should see must be emitted here.
 */
export type GameEvent =
  | { kind: 'fightStarted'; startingHp: number }
  | { kind: 'committed'; player: PlayerId; auto: boolean }
  | {
      kind: 'clashRevealed';
      round: number;
      cards: readonly [string, string];
      /** Whose Type Countered the other's. null on a Stalemate or an empty Clash. */
      winner: PlayerId | null;
      stalemate: boolean;
    }
  /** The Winner's Condition did not match, so winning the Type bought nothing. */
  | { kind: 'noEffect'; player: PlayerId; cardId: string }
  | {
      kind: 'damaged';
      source: PlayerId;
      target: PlayerId;
      amount: number;
      /** Reduced by the target's Echoes before landing. */
      prevented: number;
    }
  | { kind: 'healed'; player: PlayerId; amount: number }
  | { kind: 'cardsAdded'; player: PlayerId; cardIds: readonly string[]; fizzled: number }
  | { kind: 'cardsDiscarded'; player: PlayerId; cardIds: readonly string[] }
  | {
      kind: 'cooldownSet';
      player: PlayerId;
      type: CardType;
      rounds: number;
      source: 'play' | 'stun';
    }
  | { kind: 'cooldownsCleared'; player: PlayerId }
  | { kind: 'trickSpent'; player: PlayerId; cardId: string }
  | { kind: 'echoInstalled'; player: PlayerId; instanceId: string; label: string }
  | { kind: 'echoRevealed'; player: PlayerId; instanceId: string; label: string }
  | { kind: 'suddenDeath'; round: number; amount: number }
  | { kind: 'draftOffered'; player: PlayerId; cardIds: readonly string[] }
  | {
      kind: 'draftResolved';
      player: PlayerId;
      cardId: string | null;
      discarded: string | null;
      auto: boolean;
    }
  | { kind: 'roundEnded'; round: number }
  | { kind: 'fightEnded'; outcome: Outcome };

export interface Reduction {
  state: import('./state.ts').GameState;
  events: readonly GameEvent[];
}
