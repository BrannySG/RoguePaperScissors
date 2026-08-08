import type { CardType, EchoModifier } from './cards.ts';
import type { RngState } from './rng.ts';

export type PlayerId = 0 | 1;
export const PLAYER: PlayerId = 0;
export const OPPONENT: PlayerId = 1;

export function other(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

export type Phase = 'commit' | 'clash' | 'draft' | 'over';

export type Outcome = { kind: 'winner'; player: PlayerId } | { kind: 'draw' };

/** A lasting rule change left behind by a spent Trick. */
export interface EchoInstance {
  instanceId: string;
  sourceCardId: string;
  label: string;
  modifier: EchoModifier;
  /** Secret until the Round it first alters an outcome. */
  revealed: boolean;
}

export type Cooldowns = Readonly<Record<CardType, number>>;

export interface PlayerState {
  readonly id: PlayerId;
  readonly hp: number;
  /**
   * The Trick ids held. Cores complete the Hand the player sees but are
   * permanent, so they are tracked by Cooldown rather than listed here.
   */
  readonly hand: readonly string[];
  /** Rounds remaining per Core type; 0 means ready. */
  readonly cooldowns: Cooldowns;
  readonly echoes: readonly EchoInstance[];
  /**
   * The card locked this Round. Sealed: never expose this to the renderer for
   * a combatant other than the local viewer, or hidden mode leaks.
   */
  readonly committed: string | null;
  readonly draftOffer: readonly string[] | null;
  readonly draftTaken: boolean;
}

export interface GameState {
  readonly round: number;
  readonly phase: Phase;
  readonly players: readonly [PlayerState, PlayerState];
  readonly rng: RngState;
  readonly outcome: Outcome | null;
  /** Source of stable Echo instance ids without spending randomness. */
  readonly instanceCounter: number;
}

export const READY_COOLDOWNS: Cooldowns = { rock: 0, paper: 0, scissors: 0 };

export function playerAt(state: GameState, id: PlayerId): PlayerState {
  return state.players[id];
}

export function updatePlayer(
  state: GameState,
  id: PlayerId,
  change: Partial<Omit<PlayerState, 'id'>>,
): GameState {
  const players: [PlayerState, PlayerState] = [state.players[0], state.players[1]];
  players[id] = { ...players[id], ...change };
  return { ...state, players };
}

export function isCoreReady(player: PlayerState, type: CardType): boolean {
  return player.cooldowns[type] === 0;
}
