import type { Command } from '../core/commands.ts';
import type { GameEvent } from '../core/events.ts';
import type { RuleSet } from '../core/ruleset.ts';
import type { PlayerId } from '../core/state.ts';
import type { FightView } from '../core/view.ts';

export interface RoundHash {
  round: number;
  hash: string;
}

/** Everything needed to replay a Fight exactly. A few KB per Fight. */
export interface MatchRecord {
  version: 1;
  seed: number;
  ruleSet: RuleSet;
  /** Recordings are only valid against the rules they were played under. */
  ruleSetFingerprint: string;
  commands: readonly Command[];
  roundHashes: readonly RoundHash[];
}

export type MatchListener = (events: readonly GameEvent[]) => void;

/**
 * The multiplayer seam. Version one resolves locally; a networked
 * implementation swaps in behind this interface without the reducer, the bot
 * or the renderer changing. Note that no method hands back raw GameState:
 * callers only ever receive a redacted FightView.
 */
export interface Referee {
  readonly ruleSet: RuleSet;

  view(viewer: PlayerId): FightView;
  legalPlays(viewer: PlayerId): readonly string[];

  commit(player: PlayerId, cardId: string): void;
  draft(player: PlayerId, cardId: string | null, discard: string | null): void;
  /** Expires the current phase. Driven by the app's clock, never by the core. */
  timeout(): void;
  /** Leaves the Clash once the renderer has finished animating it. */
  advance(): void;

  subscribe(listener: MatchListener): () => void;
  record(): MatchRecord;
}
