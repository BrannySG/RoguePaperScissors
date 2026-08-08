import type { PlayerId } from './state.ts';

/**
 * Player intent entering the reducer. Wall-clock time never enters the core:
 * the countdown lives in the app layer and expires as an explicit `timeout`.
 */
export type Command =
  | { kind: 'commit'; player: PlayerId; cardId: string }
  /** Expires the current phase, filling in defaults for whoever hasn't acted. */
  | { kind: 'timeout' }
  /** Leaves the Clash. The renderer sends this when its animation finishes. */
  | { kind: 'advance' }
  | {
      kind: 'draftPick';
      player: PlayerId;
      /** null declines the offer. */
      cardId: string | null;
      /** Required when taking into a full Hand. */
      discard: string | null;
    };
