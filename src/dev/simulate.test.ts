import { describe, expect, it } from 'vitest';
import { makeRuleSet } from '../core/ruleset.ts';
import { LocalReferee } from '../referee/local.ts';
import { verifyRecord } from './replay.ts';
import { runBatch, simulateFight } from './simulate.ts';

describe('simulation harness', () => {
  it('always terminates a Fight under the default rules', () => {
    const stats = runBatch(300, makeRuleSet());

    expect(stats.abandoned).toBe(0);
    expect(stats.wins[0] + stats.wins[1] + stats.draws).toBe(stats.fights);
  });

  it('keeps Fights inside the intended length band', () => {
    const stats = runBatch(300, makeRuleSet());

    expect(stats.meanRounds).toBeGreaterThan(4);
    expect(stats.p90Rounds).toBeLessThanOrEqual(16);
  });

  it('shows no seat advantage from resolution order', () => {
    const stats = runBatch(1500, makeRuleSet());
    const decisive = stats.wins[0] + stats.wins[1];

    // Player 0's effects apply first during a Clash; this is the check that
    // ordering never became an advantage.
    expect(Math.abs(stats.wins[0] - stats.wins[1]) / decisive).toBeLessThan(0.06);
  });

  it('reproduces a Fight exactly from its seed', () => {
    const ruleSet = makeRuleSet();
    const a = simulateFight(777, ruleSet);
    const b = simulateFight(777, ruleSet);

    expect(a).toEqual(b);
  });

  it('terminates under every cooldown variant', () => {
    for (const variant of ['both', 'winner', 'loser', 'none'] as const) {
      const stats = runBatch(120, makeRuleSet({ cooldownAppliesTo: variant }));
      expect(stats.abandoned, `variant ${variant} stalled`).toBe(0);
    }
  });

  it('terminates in open-hand mode', () => {
    expect(runBatch(120, makeRuleSet({ handVisibility: 'open' })).abandoned).toBe(0);
  });
});

describe('replay verification', () => {
  it('accepts a faithful recording', () => {
    const referee = new LocalReferee(1234, makeRuleSet());

    let guard = 0;
    while (referee.view(0).outcome === null && guard++ < 300) {
      const phase = referee.view(0).phase;
      if (phase === 'clash') referee.advance();
      else referee.timeout();
    }

    const result = verifyRecord(referee.record());
    expect(result.ok).toBe(true);
    expect(result.roundsChecked).toBeGreaterThan(1);
  });

  it('reports the exact Round a tampered recording diverges at', () => {
    const referee = new LocalReferee(88, makeRuleSet());
    for (let i = 0; i < 12; i++) {
      const phase = referee.view(0).phase;
      if (phase === 'over') break;
      if (phase === 'clash') referee.advance();
      else referee.timeout();
    }

    const record = referee.record();
    const corrupted = {
      ...record,
      roundHashes: record.roundHashes.map((entry, index) =>
        index === 2 ? { ...entry, hash: 'deadbeef' } : entry,
      ),
    };

    const result = verifyRecord(corrupted);
    expect(result.ok).toBe(false);
    expect(result.expected).toBe('deadbeef');
    expect(result.divergedAtRound).toBe(record.roundHashes[2]!.round);
  });

  it('refuses a recording whose RuleSet does not match its fingerprint', () => {
    const referee = new LocalReferee(9, makeRuleSet());
    referee.timeout();

    const record = referee.record();
    expect(() =>
      verifyRecord({ ...record, ruleSet: makeRuleSet({ startingHp: 99 }) }),
    ).toThrow(/does not match/);
  });
});
