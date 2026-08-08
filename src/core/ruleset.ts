/**
 * Every tunable rule and number in the game. Nothing in `core/` may hardcode a
 * balance figure; it all arrives through here so variants are a toggle rather
 * than a code change. See docs/adr/0001.
 */
export interface RuleSet {
  startingHp: number;
  /** Damage printed on the three Cores. Cores are generated from this. */
  coreDamage: number;

  commitSeconds: number;
  draftSeconds: number;

  /** Rounds a Core stays locked after being played. */
  cooldownRounds: number;
  /**
   * Which combatant's played Core enters Cooldown. `both` is the shipped
   * design; the others exist to test whether cooldown should be a prize or a
   * penalty. `winner`/`loser` compare damage dealt during the Clash.
   */
  cooldownAppliesTo: 'both' | 'winner' | 'loser' | 'none';

  /** Maximum Tricks held. Overflow from card effects fizzles. */
  handCap: number;

  draftOptions: number;
  /** Extra offers for whoever currently has less HP. The only comeback lever. */
  draftBonusWhenBehind: number;

  /** Round from which unavoidable damage begins. */
  suddenDeathRound: number;
  suddenDeathBaseDamage: number;
  /** Added to Sudden Death damage for each Round beyond the first. */
  suddenDeathRamp: number;

  /** Flips Trick identity only. Everything else is public in both modes. */
  handVisibility: 'hidden' | 'open';
  echoReveal: 'onFirstFire' | 'always' | 'never';
}

export const DEFAULT_RULESET: RuleSet = {
  startingHp: 20,
  coreDamage: 3,

  commitSeconds: 10,
  draftSeconds: 8,

  cooldownRounds: 1,
  cooldownAppliesTo: 'both',

  handCap: 5,

  draftOptions: 3,
  draftBonusWhenBehind: 1,

  suddenDeathRound: 8,
  suddenDeathBaseDamage: 1,
  suddenDeathRamp: 1,

  handVisibility: 'hidden',
  echoReveal: 'onFirstFire',
};

export function makeRuleSet(overrides: Partial<RuleSet> = {}): RuleSet {
  return { ...DEFAULT_RULESET, ...overrides };
}

/**
 * A stable identity for a RuleSet. Recorded Fights are only comparable and
 * only replayable against the exact rules they were played under.
 */
export function ruleSetFingerprint(ruleSet: RuleSet): string {
  const canonical = Object.keys(ruleSet)
    .sort()
    .map((key) => `${key}=${String(ruleSet[key as keyof RuleSet])}`)
    .join('|');

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}
