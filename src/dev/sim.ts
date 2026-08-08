import { makeRuleSet, ruleSetFingerprint, type RuleSet } from '../core/ruleset.ts';
import { runBatch, type BatchStats } from './simulate.ts';

/**
 * Headless balance harness. Run with `npm run sim -- --fights 20000`.
 *
 * Any RuleSet field can be overridden on the command line, and repeating
 * `--compare` runs a second RuleSet side by side, which is the point of the
 * whole data-driven exercise: "is winner-only cooldown better?" should be
 * answered with numbers rather than opinions.
 *
 *   npm run sim -- --fights 5000 --compare cooldownAppliesTo=winner
 *   npm run sim -- --compare handVisibility=open --compare suddenDeathRound=6
 */
function parseOverrides(pairs: string[]): Partial<RuleSet> {
  const overrides: Record<string, unknown> = {};

  for (const pair of pairs) {
    const [key, raw] = pair.split('=');
    if (key === undefined || raw === undefined) continue;
    const asNumber = Number(raw);
    overrides[key] = Number.isNaN(asNumber) ? raw : asNumber;
  }

  return overrides as Partial<RuleSet>;
}

function parseArgs(argv: string[]): {
  fights: number;
  seed: number;
  compare: string[];
} {
  let fights = 5000;
  let seed = 1;
  const compare: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--fights' && value !== undefined) fights = Number(value);
    else if (flag === '--seed' && value !== undefined) seed = Number(value);
    else if (flag === '--compare' && value !== undefined) compare.push(value);
  }

  return { fights, seed, compare };
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

function report(label: string, stats: BatchStats, ruleSet: RuleSet): void {
  const decisive = stats.fights - stats.draws;

  console.log(`\n${label}  [ruleset ${ruleSetFingerprint(ruleSet)}]`);
  console.log(`  fights            ${stats.fights}`);
  console.log(
    `  p0 / p1 / draw    ${pct(stats.wins[0] / stats.fights)} / ` +
      `${pct(stats.wins[1] / stats.fights)} / ${pct(stats.draws / stats.fights)}`,
  );
  console.log(
    `  rounds            mean ${stats.meanRounds.toFixed(2)}  ` +
      `median ${stats.medianRounds}  p90 ${stats.p90Rounds}`,
  );
  console.log(`  whiff rate        ${pct(stats.whiffRate)}`);
  console.log(`  reached sudden    ${pct(stats.suddenDeathRate)}`);
  console.log(`  damage per round  ${stats.meanDamagePerRound.toFixed(2)}`);
  console.log(`  tricks drafted    ${stats.meanTricksDrafted.toFixed(2)}`);

  if (stats.abandoned > 0) {
    console.log(`  ABANDONED         ${stats.abandoned} (fights that never ended)`);
  }
  if (decisive > 0 && Math.abs(stats.wins[0] - stats.wins[1]) / decisive > 0.06) {
    console.log('  WARNING: seat advantage above 6% - resolution order may be biased');
  }
}

function main(): void {
  const { fights, seed, compare } = parseArgs(process.argv.slice(2));

  const baseline = makeRuleSet();
  const started = Date.now();
  report('baseline', runBatch(fights, baseline, seed), baseline);

  for (const spec of compare) {
    const variant = makeRuleSet(parseOverrides([spec]));
    report(spec, runBatch(fights, variant, seed), variant);
  }

  const total = fights * (1 + compare.length);
  console.log(`\n${total} fights in ${Date.now() - started}ms\n`);
}

main();
