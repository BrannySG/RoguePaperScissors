# The Type triangle picks the Clash Winner

Supersedes [ADR 0002](./0002-engine-has-no-rock-paper-scissors-rule.md).

The engine now owns one hardcoded relation — Rock Counters Scissors, Paper Counters Rock, Scissors Counters Paper — in `src/core/triangle.ts`. It is consulted once per Clash to name the **Winner**, and only the Winner's rules are then evaluated. The Loser is spent and does nothing; two cards of the same Type are a **Stalemate** and neither does anything.

ADR 0002 argued the opposite: the triangle should be emergent from card data so that no resolver ever accretes special cases. Playing the prototype refuted the premise it rested on. Cards-first resolution meant both sides could fire at once, neither could, or a Rock card could pay off against Rock, and none of it was legible on screen — there was no "my card won" moment to animate, and nothing the player could reason about before committing. A duelling game descended from Rock Paper Scissors has to answer "who won this exchange?" in one unambiguous way, and Type is the only thing every card is guaranteed to carry.

## Consequences

Cards remain data and the condition/effect evaluator is untouched, so authoring a card is still a data change. What changes is that a card's Type is now a hard constraint on when its Condition can ever be true: a Rock card asking `opponentType: ['rock']` is dead on arrival, because Rock never Counters Rock. Fish, Fish Guts and Pickpocket had exactly that shape and were realigned; Sucker Punch was cut because "vs any Trick" cannot be satisfied often enough to be worth the slot. New cards must be checked against the triangle by hand — the library validator catches dangling card ids, not unreachable Conditions.

Utility Tricks with `when: always` — Second Wind, Litter, Beast Pact, Market Day, Rust, Thick Skin — now require winning the Type matchup to do anything, which makes committing one a read rather than a free action. The `mirror` Condition is unreachable by construction and was removed.
