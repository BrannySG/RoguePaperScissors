import { nextInt, seedStreams, type RngState } from '../core/rng.ts';
import type { PlayerId } from '../core/state.ts';
import type { Referee } from '../referee/referee.ts';
import type { BotPolicy, Roll } from './policy.ts';

export interface BotDriverOptions {
  seed: number;
  /**
   * Human-feeling hesitation. An opponent that answers instantly removes all
   * pressure from the countdown, which is the loudest thing on screen.
   */
  minThinkMs: number;
  maxThinkMs: number;
}

/**
 * Wide enough to read as deliberation, but short of the Draft's 8s timer so
 * the bot is normally seen to act rather than to be timed out.
 */
export const DEFAULT_BOT_OPTIONS: Omit<BotDriverOptions, 'seed'> = {
  minThinkMs: 600,
  maxThinkMs: 5200,
};

/**
 * Drives a policy against a Referee. Lives outside `core/` because it owns
 * timers; the reducer never sees wall-clock time.
 */
export function attachBot(
  referee: Referee,
  player: PlayerId,
  policy: BotPolicy,
  options: BotDriverOptions,
): () => void {
  let rng: RngState = seedStreams(options.seed);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const roll: Roll = (maxExclusive) => {
    const [value, next] = nextInt(rng, 'bot', 0, Math.max(0, maxExclusive - 1));
    rng = next;
    return value;
  };

  const clear = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const act = (): void => {
    timer = null;
    if (stopped) return;

    // Re-read rather than closing over a view that may be several phases stale.
    const view = referee.view(player);

    if (view.phase === 'commit' && view.self.committed === null) {
      const cardId = policy.commit(view, roll);
      if (cardId !== null) referee.commit(player, cardId);
      return;
    }

    if (view.phase === 'draft' && !view.self.draftTaken) {
      const choice = policy.draft(view, roll);
      referee.draft(player, choice.cardId, choice.discard);
    }
  };

  const tick = (): void => {
    if (stopped) return;
    const view = referee.view(player);

    const owed =
      (view.phase === 'commit' && view.self.committed === null) ||
      (view.phase === 'draft' && !view.self.draftTaken);

    if (!owed) {
      clear();
      return;
    }

    if (timer !== null) return;

    const [delay, next] = nextInt(rng, 'bot', options.minThinkMs, options.maxThinkMs);
    rng = next;
    timer = setTimeout(act, delay);
  };

  const unsubscribe = referee.subscribe(tick);
  tick();

  return () => {
    stopped = true;
    clear();
    unsubscribe();
  };
}
