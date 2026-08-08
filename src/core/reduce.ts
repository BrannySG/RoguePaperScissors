import { cardById, draftPool } from '../cards/library.ts';
import { CARD_TYPES, type CardDef, type CardLibrary, type CardType } from './cards.ts';
import type { Command } from './commands.ts';
import { firingRules, type ClashSnapshot } from './conditions.ts';
import { applyEffect, cooldownLengthFor, draftOptionsFor, setCooldown } from './effects.ts';
import type { GameEvent, Reduction } from './events.ts';
import { pick, seedStreams, weightedSample } from './rng.ts';
import type { RuleSet } from './ruleset.ts';
import {
  other,
  READY_COOLDOWNS,
  updatePlayer,
  type GameState,
  type PlayerId,
  type PlayerState,
} from './state.ts';

export interface Engine {
  library: CardLibrary;
  ruleSet: RuleSet;
  pool: readonly CardDef[];
}

export function createEngine(ruleSet: RuleSet, library: CardLibrary): Engine {
  return { library, ruleSet, pool: draftPool(library) };
}

function freshPlayer(id: PlayerId, ruleSet: RuleSet): PlayerState {
  return {
    id,
    hp: ruleSet.startingHp,
    hand: [],
    cooldowns: READY_COOLDOWNS,
    echoes: [],
    committed: null,
    draftOffer: null,
    draftTaken: false,
  };
}

export function createFight(seed: number, engine: Engine): Reduction {
  const { ruleSet } = engine;

  const state: GameState = {
    round: 1,
    phase: 'commit',
    players: [freshPlayer(0, ruleSet), freshPlayer(1, ruleSet)],
    rng: seedStreams(seed),
    outcome: null,
    instanceCounter: 0,
  };

  return {
    state,
    events: [{ kind: 'fightStarted', startingHp: ruleSet.startingHp }],
  };
}

/** Cores off Cooldown, then held Tricks. The only cards a commit may name. */
export function legalPlays(state: GameState, player: PlayerId): string[] {
  const self = state.players[player];
  const cores = CARD_TYPES.filter((type) => self.cooldowns[type] === 0);
  return [...cores, ...self.hand];
}

function readyCores(state: GameState, player: PlayerId): CardType[] {
  return CARD_TYPES.filter((type) => state.players[player].cooldowns[type] === 0);
}

/**
 * Timeout fallback. Never spends a Trick: burning a card the player had been
 * saving because they hesitated would feel far worse than a random Core.
 */
function autoCommit(state: GameState, player: PlayerId): [string | null, GameState] {
  const cores = readyCores(state, player);
  if (cores.length > 0) {
    const [type, rng] = pick(state.rng, 'combat', cores);
    return [type, { ...state, rng }];
  }

  const hand = state.players[player].hand;
  if (hand.length > 0) {
    const [cardId, rng] = pick(state.rng, 'combat', hand);
    return [cardId, { ...state, rng }];
  }

  return [null, state];
}

function tickCooldowns(state: GameState): GameState {
  let next = state;

  for (const id of [0, 1] as const) {
    const current = next.players[id].cooldowns;
    const ticked = {
      rock: Math.max(0, current.rock - 1),
      paper: Math.max(0, current.paper - 1),
      scissors: Math.max(0, current.scissors - 1),
    };
    next = updatePlayer(next, id, { cooldowns: ticked });
  }

  return next;
}

function consumeTrick(
  state: GameState,
  player: PlayerId,
  card: CardDef,
  events: GameEvent[],
): GameState {
  if (card.category !== 'trick') return state;

  const hand = [...state.players[player].hand];
  const index = hand.indexOf(card.id);
  if (index === -1) return state;

  hand.splice(index, 1);
  events.push({ kind: 'trickSpent', player, cardId: card.id });
  return updatePlayer(state, player, { hand });
}

function damageDealtBy(events: readonly GameEvent[], player: PlayerId): number {
  return events.reduce((sum, event) => {
    if (event.kind !== 'damaged') return sum;
    if (event.source !== player || event.target === player) return sum;
    return sum + event.amount;
  }, 0);
}

/** Who the `winner`/`loser` cooldown variants refer to: whoever dealt more. */
function coreCooldownTargets(
  ruleSet: RuleSet,
  clashEvents: readonly GameEvent[],
): PlayerId[] {
  switch (ruleSet.cooldownAppliesTo) {
    case 'none':
      return [];
    case 'both':
      return [0, 1];
    case 'winner':
    case 'loser': {
      const dealt: [number, number] = [
        damageDealtBy(clashEvents, 0),
        damageDealtBy(clashEvents, 1),
      ];
      if (dealt[0] === dealt[1]) return [0, 1];
      const leader: PlayerId = dealt[0] > dealt[1] ? 0 : 1;
      return [ruleSet.cooldownAppliesTo === 'winner' ? leader : other(leader)];
    }
  }
}

function resolveClash(state: GameState, engine: Engine): Reduction {
  const { library, ruleSet } = engine;
  const events: GameEvent[] = [];

  const committed = [state.players[0].committed, state.players[1].committed] as const;
  const cards: [CardDef | null, CardDef | null] = [
    committed[0] === null ? null : cardById(library, committed[0]),
    committed[1] === null ? null : cardById(library, committed[1]),
  ];

  events.push({
    kind: 'clashRevealed',
    round: state.round,
    cards: [committed[0] ?? '', committed[1] ?? ''],
  });

  let next = tickCooldowns(state);

  // Conditions are judged against this snapshot only, so nothing either card
  // does during resolution can change what the other card sees.
  const snapshotFor = (player: PlayerId): ClashSnapshot => ({
    round: state.round,
    self: { hp: state.players[player].hp, card: cards[player] },
    opponent: { hp: state.players[other(player)].hp, card: cards[other(player)] },
  });

  const firing = ([0, 1] as const).map((player) => {
    const card = cards[player];
    if (card === null) return [];
    return firingRules(card, snapshotFor(player));
  });

  for (const player of [0, 1] as const) {
    const card = cards[player];
    if (card !== null && firing[player]!.length === 0) {
      events.push({ kind: 'whiffed', player, cardId: card.id });
    }
  }

  // Spending happens before effects so that a Trick which adds cards has
  // already freed its own slot in Hand.
  for (const player of [0, 1] as const) {
    const card = cards[player];
    if (card !== null) next = consumeTrick(next, player, card, events);
  }

  const effectsStart = events.length;

  for (const player of [0, 1] as const) {
    const card = cards[player];
    if (card === null) continue;

    for (const rule of firing[player]!) {
      for (const effect of rule.then) {
        next = applyEffect(next, player, card, effect, { library, ruleSet }, events);
      }
    }
  }

  const clashEvents = events.slice(effectsStart);

  for (const player of coreCooldownTargets(ruleSet, clashEvents)) {
    const card = cards[player];
    if (card === null || card.category !== 'core') continue;
    const rounds = cooldownLengthFor(next, player, ruleSet.cooldownRounds);
    if (rounds > 0) {
      next = setCooldown(next, player, card.type, rounds, 'play', events);
    }
  }

  if (state.round >= ruleSet.suddenDeathRound) {
    const amount =
      ruleSet.suddenDeathBaseDamage +
      ruleSet.suddenDeathRamp * (state.round - ruleSet.suddenDeathRound);

    if (amount > 0) {
      events.push({ kind: 'suddenDeath', round: state.round, amount });
      for (const player of [0, 1] as const) {
        next = updatePlayer(next, player, {
          hp: Math.max(0, next.players[player].hp - amount),
        });
      }
    }
  }

  next = updatePlayer(next, 0, { committed: null });
  next = updatePlayer(next, 1, { committed: null });

  const down: boolean[] = [next.players[0].hp <= 0, next.players[1].hp <= 0];
  let outcome = next.outcome;

  if (down[0] && down[1]) outcome = { kind: 'draw' };
  else if (down[0]) outcome = { kind: 'winner', player: 1 };
  else if (down[1]) outcome = { kind: 'winner', player: 0 };

  if (outcome !== null) events.push({ kind: 'fightEnded', outcome });

  return { state: { ...next, phase: 'clash', outcome }, events };
}

function offerDrafts(state: GameState, engine: Engine): Reduction {
  const events: GameEvent[] = [];
  let next = state;

  for (const player of [0, 1] as const) {
    const count = draftOptionsFor(next, player, engine.ruleSet);
    const [offer, rng] = weightedSample(
      next.rng,
      player === 0 ? 'draftP0' : 'draftP1',
      engine.pool,
      count,
      (card) => card.draftWeight,
    );

    next = updatePlayer({ ...next, rng }, player, {
      draftOffer: offer.map((card) => card.id),
      draftTaken: false,
    });

    events.push({ kind: 'draftOffered', player, cardIds: offer.map((card) => card.id) });
  }

  return { state: { ...next, phase: 'draft' }, events };
}

function takeDraft(
  state: GameState,
  player: PlayerId,
  cardId: string | null,
  discard: string | null,
  ruleSet: RuleSet,
  auto: boolean,
  events: GameEvent[],
): GameState {
  const self = state.players[player];
  let hand = [...self.hand];
  let discarded: string | null = null;

  if (cardId !== null) {
    if (hand.length >= ruleSet.handCap) {
      const index = discard === null ? -1 : hand.indexOf(discard);
      if (index === -1) {
        // Taking into a full Hand without naming a valid replacement declines.
        cardId = null;
      } else {
        hand.splice(index, 1);
        discarded = discard;
      }
    }

    if (cardId !== null) hand = [...hand, cardId];
  }

  events.push({ kind: 'draftResolved', player, cardId, discarded, auto });

  return updatePlayer(state, player, { hand, draftTaken: true, draftOffer: self.draftOffer });
}

function autoDraft(
  state: GameState,
  player: PlayerId,
  ruleSet: RuleSet,
  events: GameEvent[],
): GameState {
  const self = state.players[player];
  const offer = self.draftOffer ?? [];

  // Declining beats binning something the player chose to keep.
  if (offer.length === 0 || self.hand.length >= ruleSet.handCap) {
    return takeDraft(state, player, null, null, ruleSet, true, events);
  }

  const [cardId, rng] = pick(state.rng, player === 0 ? 'draftP0' : 'draftP1', offer);
  return takeDraft({ ...state, rng }, player, cardId, null, ruleSet, true, events);
}

function advanceIfDraftComplete(state: GameState, events: GameEvent[]): GameState {
  if (!state.players[0].draftTaken || !state.players[1].draftTaken) return state;

  events.push({ kind: 'roundEnded', round: state.round });

  let next = state;
  for (const player of [0, 1] as const) {
    next = updatePlayer(next, player, { draftOffer: null, draftTaken: false });
  }

  return { ...next, round: state.round + 1, phase: 'commit' };
}

function leaveClash(state: GameState, engine: Engine): Reduction {
  if (state.outcome !== null) return { state: { ...state, phase: 'over' }, events: [] };
  return offerDrafts(state, engine);
}

export function reduce(state: GameState, command: Command, engine: Engine): Reduction {
  const { ruleSet } = engine;

  if (state.phase === 'over') return { state, events: [] };

  switch (command.kind) {
    case 'commit': {
      if (state.phase !== 'commit') return { state, events: [] };
      if (state.players[command.player].committed !== null) return { state, events: [] };
      if (!legalPlays(state, command.player).includes(command.cardId)) {
        return { state, events: [] };
      }

      const events: GameEvent[] = [
        { kind: 'committed', player: command.player, auto: false },
      ];
      let next = updatePlayer(state, command.player, { committed: command.cardId });

      if (next.players[0].committed !== null && next.players[1].committed !== null) {
        const clash = resolveClash(next, engine);
        return { state: clash.state, events: [...events, ...clash.events] };
      }

      return { state: next, events };
    }

    case 'draftPick': {
      if (state.phase !== 'draft') return { state, events: [] };
      const self = state.players[command.player];
      if (self.draftTaken) return { state, events: [] };
      if (command.cardId !== null && !(self.draftOffer ?? []).includes(command.cardId)) {
        return { state, events: [] };
      }

      const events: GameEvent[] = [];
      let next = takeDraft(
        state,
        command.player,
        command.cardId,
        command.discard,
        ruleSet,
        false,
        events,
      );
      next = advanceIfDraftComplete(next, events);

      return { state: next, events };
    }

    case 'advance': {
      if (state.phase !== 'clash') return { state, events: [] };
      return leaveClash(state, engine);
    }

    case 'timeout': {
      if (state.phase === 'clash') return leaveClash(state, engine);

      if (state.phase === 'commit') {
        const events: GameEvent[] = [];
        let next = state;

        for (const player of [0, 1] as const) {
          if (next.players[player].committed !== null) continue;
          const [cardId, withRng] = autoCommit(next, player);
          next = updatePlayer(withRng, player, { committed: cardId });
          events.push({ kind: 'committed', player, auto: true });
        }

        const clash = resolveClash(next, engine);
        return { state: clash.state, events: [...events, ...clash.events] };
      }

      const events: GameEvent[] = [];
      let next = state;

      for (const player of [0, 1] as const) {
        if (next.players[player].draftTaken) continue;
        next = autoDraft(next, player, ruleSet, events);
      }

      next = advanceIfDraftComplete(next, events);
      return { state: next, events };
    }
  }
}

/** Convenience for tests and sims: fold a list of commands over a state. */
export function reduceAll(
  state: GameState,
  commands: readonly Command[],
  engine: Engine,
): Reduction {
  let current = state;
  const events: GameEvent[] = [];

  for (const command of commands) {
    const step = reduce(current, command, engine);
    current = step.state;
    events.push(...step.events);
  }

  return { state: current, events };
}
