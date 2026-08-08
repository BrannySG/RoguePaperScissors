import type { CardDef, CardType } from '../core/cards.ts';
import type { RuleSet } from '../core/ruleset.ts';

const TRIANGLE: ReadonlyArray<{ type: CardType; counters: CardType; name: string }> = [
  { type: 'rock', counters: 'scissors', name: 'Rock' },
  { type: 'paper', counters: 'rock', name: 'Paper' },
  { type: 'scissors', counters: 'paper', name: 'Scissors' },
];

const LABEL: Record<CardType, string> = {
  rock: 'Rock',
  paper: 'Paper',
  scissors: 'Scissors',
};

/**
 * Cores are generated rather than authored so that `coreDamage` is a genuine
 * RuleSet lever. Their ids are their Types, since each combatant owns exactly
 * one Core of each Type.
 */
export function buildCores(ruleSet: RuleSet): CardDef[] {
  return TRIANGLE.map(({ type, counters, name }) => ({
    id: type,
    name,
    category: 'core' as const,
    type,
    tags: [],
    text: `Counters ${LABEL[counters]}. ${ruleSet.coreDamage} damage.`,
    rules: [
      {
        when: { kind: 'opponentType' as const, types: [counters] },
        then: [{ kind: 'damage' as const, amount: ruleSet.coreDamage }],
      },
    ],
    draftWeight: 0,
    priority: 0,
  }));
}
