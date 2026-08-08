import type { CardDef, CardRule, Condition } from './cards.ts';

export interface Combatant {
  hp: number;
  /**
   * null when a combatant had nothing legal to play. Reachable once enough
   * Stun effects stack, so conditions must tolerate an absent opposing card
   * rather than assume one.
   */
  card: CardDef | null;
}

/**
 * The snapshot a Clash is judged against. Taken once, before any effect
 * applies, so the Winner's Conditions read the state as it stood at the reveal.
 */
export interface ClashSnapshot {
  round: number;
  self: Combatant;
  opponent: Combatant;
}

export function evaluate(condition: Condition, snapshot: ClashSnapshot): boolean {
  const opposing = snapshot.opponent.card;

  switch (condition.kind) {
    case 'always':
      return true;

    case 'opponentType':
      return opposing !== null && condition.types.includes(opposing.type);

    case 'opponentTag':
      return opposing !== null && condition.tags.some((tag) => opposing.tags.includes(tag));

    case 'opponentCategory':
      return opposing !== null && opposing.category === condition.category;

    case 'selfHpAtOrBelow':
      return snapshot.self.hp <= condition.hp;

    case 'opponentHpAtOrBelow':
      return snapshot.opponent.hp <= condition.hp;

    case 'roundAtLeast':
      return snapshot.round >= condition.round;

    case 'all':
      return condition.of.every((inner) => evaluate(inner, snapshot));

    case 'any':
      return condition.of.some((inner) => evaluate(inner, snapshot));
  }
}

/** The rules of `card` whose Conditions match. Empty means No Effect. */
export function firingRules(card: CardDef, snapshot: ClashSnapshot): readonly CardRule[] {
  return card.rules.filter((rule) => evaluate(rule.when, snapshot));
}
