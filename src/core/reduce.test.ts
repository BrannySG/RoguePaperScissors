import { describe, expect, it } from 'vitest';
import { createLibrary, validateLibrary } from '../cards/library.ts';
import type { Command } from './commands.ts';
import type { GameEvent } from './events.ts';
import { createEngine, createFight, legalPlays, reduce, type Engine } from './reduce.ts';
import { makeRuleSet, type RuleSet } from './ruleset.ts';
import { updatePlayer, type GameState, type PlayerId } from './state.ts';

function setup(overrides: Partial<RuleSet> = {}): { engine: Engine; state: GameState } {
  const ruleSet = makeRuleSet(overrides);
  const library = createLibrary(ruleSet);
  const engine = createEngine(ruleSet, library);
  return { engine, state: createFight(20260808, engine).state };
}

/** Puts a specific Trick in hand, bypassing the randomness of drafting. */
function give(state: GameState, player: PlayerId, ...cardIds: string[]): GameState {
  return updatePlayer(state, player, {
    hand: [...state.players[player].hand, ...cardIds],
  });
}

function run(
  state: GameState,
  engine: Engine,
  commands: Command[],
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (const command of commands) {
    const step = reduce(current, command, engine);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

/** One full Round: both commit, the Clash is left, both decline the Draft. */
function round(
  state: GameState,
  engine: Engine,
  p0: string,
  p1: string,
): { state: GameState; events: GameEvent[] } {
  return run(state, engine, [
    { kind: 'commit', player: 0, cardId: p0 },
    { kind: 'commit', player: 1, cardId: p1 },
    { kind: 'advance' },
    { kind: 'draftPick', player: 0, cardId: null, discard: null },
    { kind: 'draftPick', player: 1, cardId: null, discard: null },
  ]);
}

const damageTo = (events: GameEvent[], target: PlayerId): number =>
  events.reduce(
    (sum, e) => (e.kind === 'damaged' && e.target === target ? sum + e.amount : sum),
    0,
  );

const revealOf = (events: GameEvent[]): GameEvent | undefined =>
  events.find((e) => e.kind === 'clashRevealed');

describe('card library', () => {
  it('has no dangling card references', () => {
    expect(validateLibrary(createLibrary(makeRuleSet()))).toEqual([]);
  });
});

describe('the triangle', () => {
  it('names the Countering card the Winner and lets only it deal damage', () => {
    const { engine, state } = setup();
    const result = round(state, engine, 'rock', 'paper');

    expect(revealOf(result.events)).toMatchObject({ winner: 1, stalemate: false });
    expect(damageTo(result.events, 0)).toBe(3);
    expect(damageTo(result.events, 1)).toBe(0);
    expect(result.state.players[0].hp).toBe(17);
    expect(result.state.players[1].hp).toBe(20);
  });

  it('calls matching Types a Stalemate and fires neither card', () => {
    const { engine, state } = setup();
    const result = round(state, engine, 'rock', 'rock');

    expect(revealOf(result.events)).toMatchObject({ winner: null, stalemate: true });
    expect(result.events.some((e) => e.kind === 'noEffect')).toBe(false);
    expect(result.state.players[0].hp).toBe(20);
    expect(result.state.players[1].hp).toBe(20);
  });

  it('spends a losing Trick without firing any of its rules', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'boulder');

    // Boulder is Rock, so committing it into Paper loses the Type matchup.
    const result = round(armed, engine, 'boulder', 'paper');

    expect(result.state.players[0].hand).toEqual([]);
    expect(result.events.some((e) => e.kind === 'trickSpent')).toBe(true);
    expect(damageTo(result.events, 1)).toBe(0);
  });

  it('reports No Effect when the Winner Condition does not match', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'last_stand');

    // Last Stand is Scissors and beats Paper, but only pays off at low HP.
    const result = round(armed, engine, 'last_stand', 'paper');

    expect(result.events.some((e) => e.kind === 'noEffect')).toBe(true);
    expect(damageTo(result.events, 1)).toBe(0);
  });

  it('lets an unopposed card land when the opponent cannot commit', () => {
    const { engine, state } = setup();
    const stunned = updatePlayer(state, 1, {
      cooldowns: { rock: 2, paper: 2, scissors: 2 },
    });

    const result = run(stunned, engine, [
      { kind: 'commit', player: 0, cardId: 'rock' },
      { kind: 'timeout' },
    ]);

    expect(revealOf(result.events)).toMatchObject({ winner: 0, stalemate: false });
    expect(damageTo(result.events, 1)).toBe(3);
  });

  it('scales with the RuleSet rather than hardcoded damage', () => {
    const { engine, state } = setup({ coreDamage: 7 });
    expect(damageTo(round(state, engine, 'rock', 'paper').events, 0)).toBe(7);
  });
});

describe('cooldown', () => {
  it('locks a played Core for exactly one Round', () => {
    const { engine, state } = setup();

    const first = round(state, engine, 'rock', 'paper');
    expect(legalPlays(first.state, 0)).not.toContain('rock');

    const second = round(first.state, engine, 'paper', 'scissors');
    expect(legalPlays(second.state, 0)).toContain('rock');
  });

  it('refuses a commit naming a Core on Cooldown', () => {
    const { engine, state } = setup();
    const first = round(state, engine, 'rock', 'paper');

    const blocked = reduce(
      first.state,
      { kind: 'commit', player: 0, cardId: 'rock' },
      engine,
    );
    expect(blocked.state.players[0].committed).toBeNull();
    expect(blocked.events).toEqual([]);
  });

  it('applies Rust as a two-Round Stun on the opponent', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'rust');

    const first = round(armed, engine, 'rust', 'paper');
    expect(first.state.players[1].cooldowns.scissors).toBe(2);
    expect(legalPlays(first.state, 1)).not.toContain('scissors');

    const second = round(first.state, engine, 'rock', 'rock');
    expect(legalPlays(second.state, 1)).not.toContain('scissors');

    const third = round(second.state, engine, 'paper', 'paper');
    expect(legalPlays(third.state, 1)).toContain('scissors');
  });

  it('honours the winner-only cooldown variant', () => {
    const { engine, state } = setup({ cooldownAppliesTo: 'winner' });
    const result = round(state, engine, 'rock', 'paper');

    expect(result.state.players[1].cooldowns.paper).toBe(1);
    expect(result.state.players[0].cooldowns.rock).toBe(0);
  });
});

describe('hand', () => {
  it('spawns Fish Guts when Fish lands', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'fish');

    const result = round(armed, engine, 'fish', 'scissors');

    expect(result.state.players[0].hand).toEqual(['fish_guts', 'fish_guts']);
    expect(damageTo(result.events, 1)).toBe(4);
  });

  it('fizzles cards added beyond the hand cap', () => {
    const { engine, state } = setup({ handCap: 3 });
    const armed = give(state, 0, 'fish', 'boulder', 'boulder');

    const result = round(armed, engine, 'fish', 'scissors');

    // Fish frees its own slot first, so exactly one of the two Guts lands.
    expect(result.state.players[0].hand).toHaveLength(3);
    const added = result.events.find((e) => e.kind === 'cardsAdded');
    expect(added).toMatchObject({ fizzled: 1 });
  });

  it('lets Litter eat opposing hand slots', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'litter');

    const result = round(armed, engine, 'litter', 'rock');
    expect(result.state.players[1].hand).toEqual(['soggy_paper', 'soggy_paper']);
  });

  it('requires a named discard to draft into a full Hand', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'boulder', 'rust');

    const clash = run(armed, engine, [
      { kind: 'commit', player: 0, cardId: 'rock' },
      { kind: 'commit', player: 1, cardId: 'rock' },
      { kind: 'advance' },
    ]);

    const offer = clash.state.players[0].draftOffer!;
    const taken = reduce(
      clash.state,
      { kind: 'draftPick', player: 0, cardId: offer[0]!, discard: 'boulder' },
      engine,
    );

    expect(taken.state.players[0].hand).toEqual(['rust', offer[0]]);
  });
});

describe('echoes', () => {
  it('boosts matching cards and reveals itself on first fire', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'beast_pact', 'fish');

    // Both Tricks are Rock, so both need the opponent on Scissors to land. The
    // Stalemate Round between them is what brings their Scissors off Cooldown.
    const first = round(armed, engine, 'beast_pact', 'scissors');
    expect(first.events.some((e) => e.kind === 'echoInstalled')).toBe(true);
    expect(first.events.some((e) => e.kind === 'echoRevealed')).toBe(false);
    expect(first.state.players[0].echoes[0]!.revealed).toBe(false);

    const idle = round(first.state, engine, 'rock', 'rock');

    const second = round(idle.state, engine, 'fish', 'scissors');
    expect(damageTo(second.events, 1)).toBe(6);
    expect(second.events.some((e) => e.kind === 'echoRevealed')).toBe(true);
    expect(second.state.players[0].echoes[0]!.revealed).toBe(true);
  });

  it('reduces incoming damage from the filtered Type only', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'thick_skin');

    // Thick Skin is Rock, so it has to be committed into Scissors to install.
    const first = round(armed, engine, 'thick_skin', 'scissors');
    expect(first.events.some((e) => e.kind === 'echoInstalled')).toBe(true);

    const idle = round(first.state, engine, 'rock', 'rock');

    const fromScissors = round(idle.state, engine, 'paper', 'scissors');
    expect(damageTo(fromScissors.events, 0)).toBe(2);

    const fromPaper = round(fromScissors.state, engine, 'rock', 'paper');
    expect(damageTo(fromPaper.events, 0)).toBe(3);
  });

  it('widens the draft offer via Market Day', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'market_day');

    // Market Day is Scissors and deals nothing, so beating Paper installs the
    // Echo without either combatant falling behind on HP.
    const result = run(armed, engine, [
      { kind: 'commit', player: 0, cardId: 'market_day' },
      { kind: 'commit', player: 1, cardId: 'paper' },
      { kind: 'advance' },
    ]);

    expect(result.state.players[0].hp).toBe(result.state.players[1].hp);
    expect(result.state.players[0].draftOffer).toHaveLength(4);
    expect(result.state.players[1].draftOffer).toHaveLength(3);
  });
});

describe('draft', () => {
  it('offers an extra card to whoever is behind on HP', () => {
    const { engine, state } = setup();

    const result = run(state, engine, [
      { kind: 'commit', player: 0, cardId: 'rock' },
      { kind: 'commit', player: 1, cardId: 'paper' },
      { kind: 'advance' },
    ]);

    expect(result.state.players[0].hp).toBeLessThan(result.state.players[1].hp);
    expect(result.state.players[0].draftOffer).toHaveLength(4);
    expect(result.state.players[1].draftOffer).toHaveLength(3);
  });

  it('never offers Cores or spawn-only cards', () => {
    const { engine, state } = setup();
    const result = run(state, engine, [
      { kind: 'commit', player: 0, cardId: 'rock' },
      { kind: 'commit', player: 1, cardId: 'rock' },
      { kind: 'advance' },
    ]);

    for (const id of result.state.players[0].draftOffer!) {
      expect(['rock', 'paper', 'scissors', 'fish_guts', 'soggy_paper']).not.toContain(id);
    }
  });
});

describe('timeout', () => {
  it('auto-commits a Core and never spends a Trick', () => {
    const { engine, state } = setup();
    const armed = give(state, 0, 'boulder');

    const result = reduce(armed, { kind: 'timeout' }, engine);

    expect(result.events.filter((e) => e.kind === 'committed')).toHaveLength(2);
    expect(result.events.some((e) => e.kind === 'trickSpent')).toBe(false);
    expect(result.state.players[0].hand).toEqual(['boulder']);
  });
});

describe('sudden death', () => {
  it('ramps unavoidable damage and terminates a stalled Fight', () => {
    const { engine, state } = setup({ suddenDeathRound: 1, suddenDeathBaseDamage: 2 });

    // Driven entirely by timeouts so Cooldowns can never stall the loop.
    let current = state;
    let rounds = 0;
    while (current.outcome === null && rounds < 40) {
      current = run(current, engine, [
        { kind: 'timeout' },
        { kind: 'advance' },
        { kind: 'timeout' },
      ]).state;
      rounds++;
    }

    expect(current.outcome).not.toBeNull();
    expect(rounds).toBeLessThan(10);
  });

  it('calls a simultaneous knockout a draw', () => {
    const { engine, state } = setup({
      startingHp: 4,
      suddenDeathRound: 1,
      suddenDeathBaseDamage: 4,
    });

    const result = round(state, engine, 'rock', 'rock');
    expect(result.state.outcome).toEqual({ kind: 'draw' });
  });
});

describe('determinism', () => {
  it('produces identical state from the same seed and commands', () => {
    const commands: Command[] = [
      { kind: 'commit', player: 0, cardId: 'rock' },
      { kind: 'commit', player: 1, cardId: 'scissors' },
      { kind: 'advance' },
      { kind: 'timeout' },
      { kind: 'timeout' },
      { kind: 'advance' },
      { kind: 'timeout' },
    ];

    const a = setup();
    const b = setup();

    expect(JSON.stringify(run(a.state, a.engine, commands).state)).toBe(
      JSON.stringify(run(b.state, b.engine, commands).state),
    );
  });

  it('keeps draft streams independent of combat randomness', () => {
    const plain = setup();
    const withDiscard = setup();

    // Player 0's offer is read because only their Clash differs between the two
    // runs: a Winner's discard roll must not shift what either side is offered.
    const offersFrom = (result: { state: GameState }): readonly string[] =>
      result.state.players[0].draftOffer!;

    const a = run(plain.state, plain.engine, [
      { kind: 'commit', player: 0, cardId: 'rock' },
      { kind: 'commit', player: 1, cardId: 'rock' },
      { kind: 'advance' },
    ]);

    // Pickpocket forces a discard roll on the combat stream mid-Clash.
    const armed = give(give(withDiscard.state, 0, 'pickpocket'), 1, 'boulder');
    const b = run(armed, withDiscard.engine, [
      { kind: 'commit', player: 0, cardId: 'pickpocket' },
      { kind: 'commit', player: 1, cardId: 'paper' },
      { kind: 'advance' },
    ]);

    expect(offersFrom(a)).toEqual(offersFrom(b));
  });
});
