import type { RuleSet } from './ruleset.ts';
import {
  other,
  type Cooldowns,
  type EchoInstance,
  type GameState,
  type Outcome,
  type Phase,
  type PlayerId,
} from './state.ts';

export interface EchoView {
  instanceId: string;
  label: string;
}

export interface SelfView {
  id: PlayerId;
  hp: number;
  hand: readonly string[];
  cooldowns: Cooldowns;
  /** Includes Echoes not yet revealed to the opponent. */
  echoes: readonly EchoView[];
  committed: string | null;
  draftOffer: readonly string[] | null;
  draftTaken: boolean;
}

export interface OpponentView {
  id: PlayerId;
  hp: number;
  /** Always known. Card identities are not, unless handVisibility is open. */
  handCount: number;
  hand: readonly string[] | null;
  cooldowns: Cooldowns;
  /** Revealed Echoes only. */
  echoes: readonly EchoView[];
  /** Whether they have locked in, never what they locked. */
  hasCommitted: boolean;
  draftTaken: boolean;
}

export interface FightView {
  round: number;
  phase: Phase;
  self: SelfView;
  opponent: OpponentView;
  outcome: Outcome | null;
  startingHp: number;
  handCap: number;
  /** The Round from which unavoidable damage begins. */
  suddenDeathRound: number;
}

const toEchoView = (echo: EchoInstance): EchoView => ({
  instanceId: echo.instanceId,
  label: echo.label,
});

/**
 * The only shape the renderer and the bot are ever handed. Hidden information
 * is dropped here rather than merely left unrendered, so it cannot leak through
 * the view layer or devtools. See docs/adr/0001.
 */
export function viewFor(
  state: GameState,
  viewer: PlayerId,
  ruleSet: RuleSet,
): FightView {
  const self = state.players[viewer];
  const foe = state.players[other(viewer)];
  const handIsOpen = ruleSet.handVisibility === 'open';

  return {
    round: state.round,
    phase: state.phase,
    startingHp: ruleSet.startingHp,
    handCap: ruleSet.handCap,
    suddenDeathRound: ruleSet.suddenDeathRound,
    outcome: state.outcome,
    self: {
      id: self.id,
      hp: self.hp,
      hand: self.hand,
      cooldowns: self.cooldowns,
      echoes: self.echoes.map(toEchoView),
      committed: self.committed,
      draftOffer: self.draftOffer,
      draftTaken: self.draftTaken,
    },
    opponent: {
      id: foe.id,
      hp: foe.hp,
      handCount: foe.hand.length,
      hand: handIsOpen ? foe.hand : null,
      cooldowns: foe.cooldowns,
      echoes: foe.echoes.filter((echo) => echo.revealed).map(toEchoView),
      hasCommitted: foe.committed !== null,
      draftTaken: foe.draftTaken,
    },
  };
}
