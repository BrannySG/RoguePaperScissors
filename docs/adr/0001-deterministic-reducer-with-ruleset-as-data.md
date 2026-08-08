# Deterministic reducer with the RuleSet as data

The whole game is a pure function `reduce(state, command, ruleSet) -> { state, events }` living in `src/core/`, with every tunable rule and number passed in as a `RuleSet` argument and all randomness drawn from seeded `pure-rand` streams held in the state. Nothing in `core/` may touch `Math.random`, the clock, timers, or the DOM; the countdown lives outside and enters as an explicit `timeout` command.

We chose this because the design is explicitly unfinished — cooldown length, who cooldown applies to, hand visibility, and the Sudden Death curve are all things we intend to A/B against each other rather than settle up front. Making them data means testing a variant is a toggle and ten thousand headless simulations instead of a code change. The same property buys three other things for free: a Fight records as `{seed, ruleSet, commands[]}` and replays bit-identically for debugging, the renderer can be swapped without touching game logic, and the eventual move to a server-authoritative multiplayer build is a matter of running the identical reducer behind a `Referee` implementation.

## Consequences

The cost is indirection: no magic numbers anywhere in the rules, and every function that needs a rule has to be handed the `RuleSet`. Determinism is also a standing constraint that is easy to break by accident months later — a stray `Date.now()` in `core/` would not fail any obvious test. We mitigate that by hashing state each Round and storing the hashes alongside recorded Fights, so a replay mismatch pinpoints the exact Round that diverged.
