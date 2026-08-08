import type { CardDef, CardLibrary, CardType } from '../core/cards.ts';
import type { RuleSet } from '../core/ruleset.ts';
import { buildCores } from './cores.ts';
import { TRICKS } from './tricks.ts';

export const CORE_IDS: readonly CardType[] = ['rock', 'paper', 'scissors'];

export function createLibrary(ruleSet: RuleSet): CardLibrary {
  const library = new Map<string, CardDef>();
  for (const card of [...buildCores(ruleSet), ...TRICKS]) {
    if (library.has(card.id)) throw new Error(`Duplicate card id: ${card.id}`);
    library.set(card.id, card);
  }
  return library;
}

export function cardById(library: CardLibrary, id: string): CardDef {
  const card = library.get(id);
  if (card === undefined) throw new Error(`Unknown card id: ${id}`);
  return card;
}

/** The pool draft offers are rolled from. Excludes Cores and spawned-only cards. */
export function draftPool(library: CardLibrary): CardDef[] {
  return [...library.values()].filter(
    (card) => card.category === 'trick' && card.draftWeight > 0,
  );
}

/**
 * Catches the failure mode cards-first resolution invites: a card referencing
 * an id that does not exist, so its effect silently does nothing forever.
 */
export function validateLibrary(library: CardLibrary): string[] {
  const problems: string[] = [];

  for (const card of library.values()) {
    if (card.category === 'core' && !CORE_IDS.includes(card.id as CardType)) {
      problems.push(`Core ${card.id} must be identified by its Type`);
    }

    for (const rule of card.rules) {
      for (const effect of rule.then) {
        if (effect.kind === 'addCard' && !library.has(effect.cardId)) {
          problems.push(`${card.id} adds unknown card "${effect.cardId}"`);
        }
        if (effect.kind === 'addCard' && effect.count <= 0) {
          problems.push(`${card.id} adds a non-positive count`);
        }
      }
    }
  }

  return problems;
}
