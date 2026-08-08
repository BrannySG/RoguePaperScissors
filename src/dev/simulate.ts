import { randomPolicy, type BotPolicy, type Roll } from '../bot/policy.ts';
import { nextInt, seedStreams, type RngState } from '../core/rng.ts';
import type { RuleSet } from '../core/ruleset.ts';
import type { Outcome, PlayerId } from '../core/state.ts';
import { LocalReferee } from '../referee/local.ts';

export interface FightSummary {
  seed: number;
  rounds: number;
  outcome: Outcome;
  cardsPlayed: number;
  clashes: number;
  /** Clashes the triangle named a Winner in. */
  decided: number;
  stalemates: number;
  /** Clashes won on Type by a card whose Condition did not match. */
  noEffects: number;
  damage: number;
  tricksDrafted: number;
  reachedSuddenDeath: boolean;
  /** True when the loop hit its guard, which means a rule change stalled it. */
  abandoned: boolean;
}

const MAX_STEPS = 400;

/**
 * Plays one Fight with no renderer and no clock. Runs through the same
 * LocalReferee the game uses, so a policy here is subject to exactly the same
 * hidden-information rules as one driving the UI.
 */
export function simulateFight(
  seed: number,
  ruleSet: RuleSet,
  policies: readonly [BotPolicy, BotPolicy] = [randomPolicy, randomPolicy],
): FightSummary {
  const referee = new LocalReferee(seed, ruleSet);

  // Offset so policy randomness never mirrors the Fight's own streams.
  let rng: RngState = seedStreams(seed ^ 0x5151);
  const roll: Roll = (maxExclusive) => {
    const [value, next] = nextInt(rng, 'bot', 0, Math.max(0, maxExclusive - 1));
    rng = next;
    return value;
  };

  const summary = {
    cardsPlayed: 0,
    clashes: 0,
    decided: 0,
    stalemates: 0,
    noEffects: 0,
    damage: 0,
    tricksDrafted: 0,
    reachedSuddenDeath: false,
  };

  referee.subscribe((events) => {
    for (const event of events) {
      if (event.kind === 'clashRevealed') {
        summary.cardsPlayed += event.cards.filter((id) => id !== '').length;
        summary.clashes += 1;
        if (event.winner !== null) summary.decided += 1;
        if (event.stalemate) summary.stalemates += 1;
      } else if (event.kind === 'noEffect') {
        summary.noEffects += 1;
      } else if (event.kind === 'damaged') {
        summary.damage += event.amount;
      } else if (event.kind === 'draftResolved' && event.cardId !== null) {
        summary.tricksDrafted += 1;
      } else if (event.kind === 'suddenDeath') {
        summary.reachedSuddenDeath = true;
      }
    }
  });

  let steps = 0;
  let view = referee.view(0);

  while (view.outcome === null && steps++ < MAX_STEPS) {
    if (view.phase === 'commit') {
      for (const player of [0, 1] as const) {
        const own = referee.view(player);
        if (own.self.committed !== null) continue;
        const cardId = policies[player].commit(own, roll);
        if (cardId !== null) referee.commit(player, cardId);
      }
      // Nobody could move; let the phase expire rather than spin.
      if (referee.view(0).phase === 'commit') referee.timeout();
    } else if (view.phase === 'clash') {
      referee.advance();
    } else if (view.phase === 'draft') {
      for (const player of [0, 1] as const) {
        const own = referee.view(player);
        if (own.self.draftTaken) continue;
        const choice = policies[player].draft(own, roll);
        referee.draft(player, choice.cardId, choice.discard);
      }
      if (referee.view(0).phase === 'draft') referee.timeout();
    }

    view = referee.view(0);
  }

  return {
    seed,
    rounds: view.round,
    outcome: view.outcome ?? { kind: 'draw' },
    ...summary,
    abandoned: view.outcome === null,
  };
}

export interface BatchStats {
  fights: number;
  wins: [number, number];
  draws: number;
  abandoned: number;
  meanRounds: number;
  medianRounds: number;
  p90Rounds: number;
  /** Share of Clashes that ended in a Stalemate. */
  stalemateRate: number;
  /** Share of decided Clashes where winning the Type bought nothing. */
  noEffectRate: number;
  suddenDeathRate: number;
  meanDamagePerRound: number;
  meanTricksDrafted: number;
}

export function runBatch(
  fights: number,
  ruleSet: RuleSet,
  baseSeed = 1,
  policies: readonly [BotPolicy, BotPolicy] = [randomPolicy, randomPolicy],
): BatchStats {
  const results: FightSummary[] = [];
  for (let i = 0; i < fights; i++) {
    results.push(simulateFight(baseSeed + i, ruleSet, policies));
  }

  const rounds = results.map((r) => r.rounds).sort((a, b) => a - b);
  const at = (quantile: number): number =>
    rounds[Math.min(rounds.length - 1, Math.floor(rounds.length * quantile))] ?? 0;

  const total = <K extends keyof FightSummary>(key: K): number =>
    results.reduce((sum, r) => sum + (r[key] as number), 0);

  const wins: [number, number] = [0, 0];
  let draws = 0;
  for (const result of results) {
    if (result.outcome.kind === 'draw') draws += 1;
    else wins[result.outcome.player as PlayerId] += 1;
  }

  return {
    fights,
    wins,
    draws,
    abandoned: results.filter((r) => r.abandoned).length,
    meanRounds: total('rounds') / fights,
    medianRounds: at(0.5),
    p90Rounds: at(0.9),
    stalemateRate: total('stalemates') / Math.max(1, total('clashes')),
    noEffectRate: total('noEffects') / Math.max(1, total('decided')),
    suddenDeathRate: results.filter((r) => r.reachedSuddenDeath).length / fights,
    meanDamagePerRound: total('damage') / Math.max(1, total('rounds')),
    meanTricksDrafted: total('tricksDrafted') / fights,
  };
}
