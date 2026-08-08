import { CARD_TYPES } from '../core/cards.ts';
import type { FightView } from '../core/view.ts';

/** Returns an integer in [0, maxExclusive). */
export type Roll = (maxExclusive: number) => number;

export interface DraftChoice {
  cardId: string | null;
  discard: string | null;
}

export interface BotPolicy {
  readonly name: string;
  commit(view: FightView, roll: Roll): string | null;
  draft(view: FightView, roll: Roll): DraftChoice;
}

/**
 * Derived from the same redacted view a human gets, so a policy structurally
 * cannot read the opponent's hidden Hand.
 */
export function legalPlaysFromView(view: FightView): string[] {
  const cores = CARD_TYPES.filter((type) => view.self.cooldowns[type] === 0);
  return [...cores, ...view.self.hand];
}

/**
 * Uniform over legal plays. This is the control, not an opponent: it exists so
 * every balance question has a baseline to be measured against. It cannot
 * validate whether the game is fun, because there is no intent in it to read.
 */
export const randomPolicy: BotPolicy = {
  name: 'random',

  commit(view, roll) {
    const options = legalPlaysFromView(view);
    return options.length === 0 ? null : options[roll(options.length)]!;
  },

  draft(view, roll) {
    const offer = view.self.draftOffer ?? [];
    if (offer.length === 0) return { cardId: null, discard: null };

    const cardId = offer[roll(offer.length)]!;
    const hand = view.self.hand;

    // Replaces rather than declines when full, so sims exercise the discard
    // path instead of quietly never touching it.
    if (hand.length >= view.handCap && hand.length > 0) {
      return { cardId, discard: hand[roll(hand.length)]! };
    }

    return { cardId, discard: null };
  },
};
