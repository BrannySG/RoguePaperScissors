import { createLibrary } from '../cards/library.ts';
import type { Command } from '../core/commands.ts';
import type { GameEvent } from '../core/events.ts';
import { hashState } from '../core/hash.ts';
import {
  createEngine,
  createFight,
  legalPlays,
  reduce,
  type Engine,
} from '../core/reduce.ts';
import { ruleSetFingerprint, type RuleSet } from '../core/ruleset.ts';
import type { GameState, PlayerId } from '../core/state.ts';
import { viewFor, type FightView } from '../core/view.ts';
import type { MatchListener, MatchRecord, Referee, RoundHash } from './referee.ts';

/**
 * Resolves Clashes in-process. The GameState is private: callers get redacted
 * views only, so a hidden Hand cannot leak to the renderer or to the bot, which
 * would otherwise quietly defeat hidden mode.
 */
export class LocalReferee implements Referee {
  readonly ruleSet: RuleSet;

  #state: GameState;
  #engine: Engine;
  #listeners = new Set<MatchListener>();
  #commands: Command[] = [];
  #roundHashes: RoundHash[] = [];
  #seed: number;

  constructor(seed: number, ruleSet: RuleSet) {
    this.ruleSet = ruleSet;
    this.#seed = seed;
    this.#engine = createEngine(ruleSet, createLibrary(ruleSet));

    const opening = createFight(seed, this.#engine);
    this.#state = opening.state;
    this.#roundHashes.push({ round: 0, hash: hashState(opening.state) });
  }

  view(viewer: PlayerId): FightView {
    return viewFor(this.#state, viewer, this.ruleSet);
  }

  legalPlays(viewer: PlayerId): readonly string[] {
    return legalPlays(this.#state, viewer);
  }

  commit(player: PlayerId, cardId: string): void {
    this.#dispatch({ kind: 'commit', player, cardId });
  }

  draft(player: PlayerId, cardId: string | null, discard: string | null): void {
    this.#dispatch({ kind: 'draftPick', player, cardId, discard });
  }

  timeout(): void {
    this.#dispatch({ kind: 'timeout' });
  }

  advance(): void {
    this.#dispatch({ kind: 'advance' });
  }

  subscribe(listener: MatchListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  record(): MatchRecord {
    return {
      version: 1,
      seed: this.#seed,
      ruleSet: this.ruleSet,
      ruleSetFingerprint: ruleSetFingerprint(this.ruleSet),
      commands: [...this.#commands],
      roundHashes: [...this.#roundHashes],
    };
  }

  #dispatch(command: Command): void {
    const before = this.#state;
    const { state, events } = reduce(before, command, this.#engine);

    // Rejected commands leave state untouched and are kept out of the
    // recording, so a replay never has to reason about no-ops.
    if (state === before && events.length === 0) return;

    this.#state = state;
    this.#commands.push(command);

    for (const event of events) {
      if (event.kind === 'roundEnded' || event.kind === 'fightEnded') {
        this.#roundHashes.push({ round: state.round, hash: hashState(state) });
      }
    }

    this.#emit(events);
  }

  #emit(events: readonly GameEvent[]): void {
    for (const listener of [...this.#listeners]) listener(events);
  }
}
