import { cardMatches, type CardDef, type CardLibrary, type Effect } from './cards.ts';
import type { GameEvent } from './events.ts';
import { nextInt } from './rng.ts';
import type { RuleSet } from './ruleset.ts';
import {
  other,
  READY_COOLDOWNS,
  updatePlayer,
  type GameState,
  type PlayerId,
} from './state.ts';

export interface EffectContext {
  library: CardLibrary;
  ruleSet: RuleSet;
}

/**
 * Sums the matching Echoes of one combatant and reveals any that contributed.
 * An Echo is revealed the moment it first changes an outcome, not when it is
 * installed - see CONTEXT.md.
 */
function drawOnEchoes(
  state: GameState,
  owner: PlayerId,
  kind: 'damageBonus' | 'damageReduction',
  against: CardDef,
  ruleSet: RuleSet,
  events: GameEvent[],
): { total: number; state: GameState } {
  let total = 0;
  let revealedAny = false;

  const echoes = state.players[owner].echoes.map((echo) => {
    if (echo.modifier.kind !== kind) return echo;
    if (echo.modifier.amount === 0) return echo;
    if (!cardMatches(against, echo.modifier.filter)) return echo;

    total += echo.modifier.amount;

    if (!echo.revealed && ruleSet.echoReveal === 'onFirstFire') {
      revealedAny = true;
      events.push({
        kind: 'echoRevealed',
        player: owner,
        instanceId: echo.instanceId,
        label: echo.label,
      });
      return { ...echo, revealed: true };
    }

    return echo;
  });

  return { total, state: revealedAny ? updatePlayer(state, owner, { echoes }) : state };
}

/** Echo-adjusted cooldown length for whoever is being locked. */
export function cooldownLengthFor(
  state: GameState,
  owner: PlayerId,
  baseRounds: number,
): number {
  const delta = state.players[owner].echoes.reduce(
    (sum, echo) => (echo.modifier.kind === 'cooldownDelta' ? sum + echo.modifier.amount : sum),
    0,
  );
  return Math.max(0, baseRounds + delta);
}

export function draftOptionsFor(
  state: GameState,
  owner: PlayerId,
  ruleSet: RuleSet,
): number {
  const opponentHp = state.players[other(owner)].hp;
  const behind = state.players[owner].hp < opponentHp ? ruleSet.draftBonusWhenBehind : 0;

  const delta = state.players[owner].echoes.reduce(
    (sum, echo) =>
      echo.modifier.kind === 'draftOptionsDelta' ? sum + echo.modifier.amount : sum,
    0,
  );

  return Math.max(1, ruleSet.draftOptions + behind + delta);
}

export function dealDamage(
  state: GameState,
  source: PlayerId,
  target: PlayerId,
  sourceCard: CardDef,
  baseAmount: number,
  ruleSet: RuleSet,
  events: GameEvent[],
): GameState {
  if (baseAmount <= 0) return state;

  const bonus = drawOnEchoes(state, source, 'damageBonus', sourceCard, ruleSet, events);
  const reduction = drawOnEchoes(
    bonus.state,
    target,
    'damageReduction',
    sourceCard,
    ruleSet,
    events,
  );

  const raw = Math.max(0, baseAmount + bonus.total);
  const landed = Math.max(0, raw - reduction.total);

  const next = updatePlayer(reduction.state, target, {
    hp: Math.max(0, reduction.state.players[target].hp - landed),
  });

  events.push({
    kind: 'damaged',
    source,
    target,
    amount: landed,
    prevented: raw - landed,
  });

  return next;
}

function addCards(
  state: GameState,
  owner: PlayerId,
  cardId: string,
  count: number,
  ruleSet: RuleSet,
  events: GameEvent[],
): GameState {
  const hand = state.players[owner].hand;
  const room = Math.max(0, ruleSet.handCap - hand.length);
  const added = Math.min(room, count);

  if (added === 0 && count === 0) return state;

  const cardIds = Array.from({ length: added }, () => cardId);
  events.push({ kind: 'cardsAdded', player: owner, cardIds, fizzled: count - added });

  if (added === 0) return state;
  return updatePlayer(state, owner, { hand: [...hand, ...cardIds] });
}

function discardCards(
  state: GameState,
  owner: PlayerId,
  count: number,
  events: GameEvent[],
): GameState {
  const hand = [...state.players[owner].hand];
  const removed: string[] = [];
  let rng = state.rng;

  for (let i = 0; i < count && hand.length > 0; i++) {
    const [index, next] = nextInt(rng, 'combat', 0, hand.length - 1);
    rng = next;
    removed.push(...hand.splice(index, 1));
  }

  if (removed.length === 0) return { ...state, rng };

  events.push({ kind: 'cardsDiscarded', player: owner, cardIds: removed });
  return updatePlayer({ ...state, rng }, owner, { hand });
}

export function setCooldown(
  state: GameState,
  owner: PlayerId,
  type: import('./cards.ts').CardType,
  rounds: number,
  source: 'play' | 'stun',
  events: GameEvent[],
): GameState {
  const current = state.players[owner].cooldowns;
  // A shorter lock must never shorten a longer one already in place.
  const value = Math.max(current[type], rounds);
  if (value === current[type]) return state;

  events.push({ kind: 'cooldownSet', player: owner, type, rounds: value, source });
  return updatePlayer(state, owner, { cooldowns: { ...current, [type]: value } });
}

export function applyEffect(
  state: GameState,
  actor: PlayerId,
  actorCard: CardDef,
  effect: Effect,
  ctx: EffectContext,
  events: GameEvent[],
): GameState {
  const target = other(actor);

  switch (effect.kind) {
    case 'damage':
      return dealDamage(state, actor, target, actorCard, effect.amount, ctx.ruleSet, events);

    case 'damageSelf': {
      const hp = Math.max(0, state.players[actor].hp - effect.amount);
      events.push({
        kind: 'damaged',
        source: actor,
        target: actor,
        amount: effect.amount,
        prevented: 0,
      });
      return updatePlayer(state, actor, { hp });
    }

    case 'heal': {
      const before = state.players[actor].hp;
      const hp = Math.min(ctx.ruleSet.startingHp, before + effect.amount);
      if (hp === before) return state;
      events.push({ kind: 'healed', player: actor, amount: hp - before });
      return updatePlayer(state, actor, { hp });
    }

    case 'addCard':
      return addCards(
        state,
        effect.to === 'self' ? actor : target,
        effect.cardId,
        effect.count,
        ctx.ruleSet,
        events,
      );

    case 'discard':
      return discardCards(
        state,
        effect.from === 'self' ? actor : target,
        effect.count,
        events,
      );

    case 'cooldown': {
      const owner = effect.target === 'self' ? actor : target;
      const rounds = cooldownLengthFor(state, owner, effect.rounds);
      return setCooldown(state, owner, effect.type, rounds, 'stun', events);
    }

    case 'clearCooldowns':
      events.push({ kind: 'cooldownsCleared', player: actor });
      return updatePlayer(state, actor, { cooldowns: READY_COOLDOWNS });

    case 'echo': {
      const instanceId = `echo${state.instanceCounter}`;
      const revealed = ctx.ruleSet.echoReveal === 'always';

      events.push({ kind: 'echoInstalled', player: actor, instanceId, label: effect.label });
      if (revealed) {
        events.push({
          kind: 'echoRevealed',
          player: actor,
          instanceId,
          label: effect.label,
        });
      }

      const withEcho = updatePlayer(state, actor, {
        echoes: [
          ...state.players[actor].echoes,
          {
            instanceId,
            sourceCardId: actorCard.id,
            label: effect.label,
            modifier: effect.modifier,
            revealed,
          },
        ],
      });

      return { ...withEcho, instanceCounter: state.instanceCounter + 1 };
    }
  }
}
