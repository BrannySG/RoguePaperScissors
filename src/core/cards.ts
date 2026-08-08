export type CardType = 'rock' | 'paper' | 'scissors';
export const CARD_TYPES: readonly CardType[] = ['rock', 'paper', 'scissors'];

export type CardCategory = 'core' | 'trick';

/** Matches cards by Type, Tag and/or category. All present clauses must hold. */
export interface CardFilter {
  types?: readonly CardType[];
  tags?: readonly string[];
  category?: CardCategory;
}

/**
 * What a card may ask about the Clash it just won. There is deliberately no
 * clause matching another card by id, and none that can see play history:
 * Types and Tags are the interface between cards.
 *
 * Only the Winner is ever asked, so a Condition on the opposing Type is already
 * implied by the asking card's own Type — see docs/adr/0004.
 */
export type Condition =
  | { kind: 'always' }
  | { kind: 'opponentType'; types: readonly CardType[] }
  | { kind: 'opponentTag'; tags: readonly string[] }
  | { kind: 'opponentCategory'; category: CardCategory }
  | { kind: 'selfHpAtOrBelow'; hp: number }
  | { kind: 'opponentHpAtOrBelow'; hp: number }
  | { kind: 'roundAtLeast'; round: number }
  | { kind: 'all'; of: readonly Condition[] }
  | { kind: 'any'; of: readonly Condition[] };

/** The four things a lasting Echo is allowed to change. */
export type EchoModifier =
  | { kind: 'damageBonus'; filter: CardFilter; amount: number }
  | { kind: 'damageReduction'; filter: CardFilter; amount: number }
  | { kind: 'cooldownDelta'; amount: number }
  | { kind: 'draftOptionsDelta'; amount: number };

export type Effect =
  | { kind: 'damage'; amount: number }
  | { kind: 'damageSelf'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'addCard'; cardId: string; count: number; to: 'self' | 'opponent' }
  | { kind: 'discard'; count: number; from: 'self' | 'opponent' }
  | { kind: 'cooldown'; target: 'self' | 'opponent'; type: CardType; rounds: number }
  | { kind: 'clearCooldowns' }
  | { kind: 'echo'; label: string; modifier: EchoModifier };

export interface CardRule {
  when: Condition;
  then: readonly Effect[];
}

export interface CardDef {
  id: string;
  name: string;
  category: CardCategory;
  /** Exactly one, always. Guarantees no card is unreachable by the triangle. */
  type: CardType;
  tags: readonly string[];
  /** Player-facing text. Authored, not generated, so it can stay terse. */
  text: string;
  rules: readonly CardRule[];
  /** Relative likelihood of being offered. 0 means never drafted directly. */
  draftWeight: number;
  /** Reserved for v2 initiative ordering. Always 0 for now. */
  priority: number;
}

export type CardLibrary = ReadonlyMap<string, CardDef>;

export function cardMatches(card: CardDef, filter: CardFilter): boolean {
  if (filter.category !== undefined && card.category !== filter.category) return false;
  if (filter.types !== undefined && !filter.types.includes(card.type)) return false;
  if (filter.tags !== undefined && !filter.tags.some((tag) => card.tags.includes(tag))) {
    return false;
  }
  return true;
}
