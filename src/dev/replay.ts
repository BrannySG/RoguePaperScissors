import { createLibrary } from '../cards/library.ts';
import { hashState } from '../core/hash.ts';
import { createEngine, createFight, reduce } from '../core/reduce.ts';
import { ruleSetFingerprint } from '../core/ruleset.ts';
import type { MatchRecord, RoundHash } from '../referee/referee.ts';

export interface ReplayResult {
  ok: boolean;
  /** The first Round whose hash differs, or null when the replay matched. */
  divergedAtRound: number | null;
  expected: string | null;
  actual: string | null;
  roundsChecked: number;
}

/**
 * Re-runs a recording and compares per-Round hashes. This is the tripwire for
 * accidental non-determinism in `core/` - a stray `Date.now()` added months
 * from now fails here and names the exact Round it first mattered.
 */
export function verifyRecord(record: MatchRecord): ReplayResult {
  if (ruleSetFingerprint(record.ruleSet) !== record.ruleSetFingerprint) {
    throw new Error('Recording does not match the RuleSet it claims to use');
  }

  const engine = createEngine(record.ruleSet, createLibrary(record.ruleSet));
  let state = createFight(record.seed, engine).state;

  const replayed: RoundHash[] = [{ round: 0, hash: hashState(state) }];

  for (const command of record.commands) {
    const step = reduce(state, command, engine);
    state = step.state;

    for (const event of step.events) {
      if (event.kind === 'roundEnded' || event.kind === 'fightEnded') {
        replayed.push({ round: state.round, hash: hashState(state) });
      }
    }
  }

  const length = Math.max(replayed.length, record.roundHashes.length);

  for (let i = 0; i < length; i++) {
    const mine = replayed[i];
    const theirs = record.roundHashes[i];

    if (mine?.hash !== theirs?.hash) {
      return {
        ok: false,
        divergedAtRound: theirs?.round ?? mine?.round ?? i,
        expected: theirs?.hash ?? null,
        actual: mine?.hash ?? null,
        roundsChecked: i,
      };
    }
  }

  return {
    ok: true,
    divergedAtRound: null,
    expected: null,
    actual: null,
    roundsChecked: replayed.length,
  };
}

export function encodeRecord(record: MatchRecord): string {
  return JSON.stringify(record, null, 2);
}

export function decodeRecord(text: string): MatchRecord {
  const parsed = JSON.parse(text) as MatchRecord;
  if (parsed.version !== 1) throw new Error(`Unsupported record version`);
  return parsed;
}
