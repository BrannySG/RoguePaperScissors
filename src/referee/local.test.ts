import { describe, expect, it } from 'vitest';
import { randomPolicy } from '../bot/policy.ts';
import { createLibrary } from '../cards/library.ts';
import { hashState } from '../core/hash.ts';
import { createEngine, createFight, reduce, reduceAll } from '../core/reduce.ts';
import { makeRuleSet, type RuleSet } from '../core/ruleset.ts';
import { updatePlayer } from '../core/state.ts';
import { viewFor } from '../core/view.ts';
import { LocalReferee } from './local.ts';

function playSomeRounds(referee: LocalReferee, rounds: number): void {
  let guard = 0;
  while (referee.view(0).outcome === null && guard++ < rounds * 6) {
    const view = referee.view(0);

    if (view.phase === 'commit') {
      for (const player of [0, 1] as const) {
        const legal = referee.legalPlays(player);
        if (legal.length > 0) referee.commit(player, legal[0]!);
      }
    } else if (view.phase === 'clash') {
      referee.advance();
    } else if (view.phase === 'draft') {
      for (const player of [0, 1] as const) {
        const offer = referee.view(player).self.draftOffer ?? [];
        referee.draft(player, offer[0] ?? null, null);
      }
    }

    if (referee.view(0).round > rounds) break;
  }
}

describe('hidden information', () => {
  const armed = (ruleSet: RuleSet): LocalReferee => {
    const referee = new LocalReferee(4242, ruleSet);
    playSomeRounds(referee, 3);
    return referee;
  };

  it('withholds opposing Trick identities while still reporting the count', () => {
    const referee = armed(makeRuleSet({ handVisibility: 'hidden' }));
    const view = referee.view(0);

    expect(view.opponent.hand).toBeNull();
    expect(view.opponent.handCount).toBeGreaterThan(0);
  });

  it('reveals opposing Tricks in open mode and changes nothing else', () => {
    const hidden = armed(makeRuleSet({ handVisibility: 'hidden' })).view(0);
    const open = armed(makeRuleSet({ handVisibility: 'open' })).view(0);

    expect(open.opponent.hand).not.toBeNull();
    expect(open.opponent.hand).toHaveLength(open.opponent.handCount);
    expect(open.opponent.handCount).toBe(hidden.opponent.handCount);
    expect(open.opponent.hp).toBe(hidden.opponent.hp);
    expect(open.opponent.cooldowns).toEqual(hidden.opponent.cooldowns);
  });

  it('never leaks what the opponent committed, only that they have', () => {
    const referee = new LocalReferee(99, makeRuleSet({ handVisibility: 'hidden' }));
    referee.commit(1, 'rock');

    const view = referee.view(0);
    expect(view.opponent.hasCommitted).toBe(true);
    // The committed card must be absent from the shape entirely, not merely
    // left unrendered, or it leaks through devtools.
    expect(view.opponent).not.toHaveProperty('committed');
    expect(view.opponent.hand).toBeNull();
  });

  it('hides an Echo from the opponent until it fires', () => {
    const ruleSet = makeRuleSet();
    const engine = createEngine(ruleSet, createLibrary(ruleSet));

    const opening = createFight(7, engine).state;
    const armedState = updatePlayer(opening, 1, { hand: ['beast_pact'] });

    const installed = reduceAll(
      armedState,
      [
        { kind: 'commit', player: 0, cardId: 'scissors' },
        { kind: 'commit', player: 1, cardId: 'beast_pact' },
      ],
      engine,
    ).state;

    expect(viewFor(installed, 1, ruleSet).self.echoes).toHaveLength(1);
    expect(viewFor(installed, 0, ruleSet).opponent.echoes).toEqual([]);
  });
});

describe('recording', () => {
  it('replays to identical per-Round hashes', () => {
    const ruleSet = makeRuleSet();
    const referee = new LocalReferee(31337, ruleSet);
    playSomeRounds(referee, 4);

    const record = referee.record();
    expect(record.commands.length).toBeGreaterThan(4);

    const engine = createEngine(ruleSet, createLibrary(ruleSet));
    let state = createFight(record.seed, engine).state;
    const replayed = [{ round: 0, hash: hashState(state) }];

    for (const command of record.commands) {
      const step = reduce(state, command, engine);
      state = step.state;
      for (const event of step.events) {
        if (event.kind === 'roundEnded' || event.kind === 'fightEnded') {
          replayed.push({ round: state.round, hash: hashState(state) });
        }
      }
    }

    expect(replayed).toEqual(record.roundHashes);
  });

  it('keeps rejected commands out of the recording', () => {
    const referee = new LocalReferee(5, makeRuleSet());
    referee.commit(0, 'rock');
    referee.commit(0, 'paper');
    referee.commit(0, 'not_a_card');

    expect(referee.record().commands).toHaveLength(1);
  });
});

describe('random policy', () => {
  it('only ever names a legal play', () => {
    const referee = new LocalReferee(2026, makeRuleSet());
    let rolls = 0;
    const roll = (max: number): number => (rolls++ * 7) % Math.max(1, max);

    for (let i = 0; i < 25; i++) {
      const view = referee.view(1);

      if (view.phase === 'commit') {
        const choice = randomPolicy.commit(view, roll);
        expect(referee.legalPlays(1)).toContain(choice);
        referee.commit(1, choice!);
        referee.commit(0, referee.legalPlays(0)[0]!);
      } else if (view.phase === 'clash') {
        referee.advance();
      } else if (view.phase === 'draft') {
        const choice = randomPolicy.draft(view, roll);
        referee.draft(1, choice.cardId, choice.discard);
        referee.draft(0, null, null);
      } else {
        break;
      }
    }
  });
});
