import { CARD_TYPES, type CardDef, type CardType } from '../core/cards.ts';
import type { RuleSet } from '../core/ruleset.ts';

const NAME: Record<CardType, string> = {
  rock: 'Rock',
  paper: 'Paper',
  scissors: 'Scissors',
};

/**
 * Cores are generated rather than authored so that `coreDamage` is a genuine
 * RuleSet lever. Their ids are their Types, since each combatant owns exactly
 * one Core of each Type.
 *
 * Their rules are unconditional: the triangle has already decided a Core only
 * resolves when it Countered the other card. See docs/adr/0004.
 */
export function buildCores(ruleSet: RuleSet): CardDef[] {
  return CARD_TYPES.map((type) => ({
    id: type,
    name: NAME[type],
    category: 'core' as const,
    type,
    tags: [],
    text: `${ruleSet.coreDamage} damage.`,
    rules: [
      {
        when: { kind: 'always' as const },
        then: [{ kind: 'damage' as const, amount: ruleSet.coreDamage }],
      },
    ],
    draftWeight: 0,
    priority: 0,
  }));
}
