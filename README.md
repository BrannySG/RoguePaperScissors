# Rogue Paper Scissors

A duelling card game descended from Rock Paper Scissors. Two combatants secretly commit one card per Round under a countdown, the cards resolve against each other simultaneously, and whoever is losing drafts extra cards to fight back with.

This is a prototype: one Fight against a random bot, built so the rules can be re-tuned as data and tested by the thousand.

Start with [`CONTEXT.md`](./CONTEXT.md) for the vocabulary — the terms below (Round, Clash, Core, Trick, Echo, Whiff) all have precise meanings — and [`docs/adr/`](./docs/adr) for the three decisions that shape everything else.

## Running it

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, with the RuleSet panel |
| `npm run build` | Typecheck then production bundle |
| `npm test` | Full suite |
| `npm run sim` | Headless balance simulation |

**Playing.** Click a card in the bottom-right fan, or press `1`–`9`. Cards `1`–`3` are your Cores. Press `R` to restart, and `` ` `` to toggle the dev panel.

## How a Round works

```
Commit (10s, both in secret)  ->  Clash  ->  Draft (8s)  ->  repeat
```

Both combatants start at 20 HP and hold three permanent **Cores** — Rock, Paper, Scissors. Playing a Core puts it on **Cooldown** for a Round, so you only ever hold two of the three, and because Cooldowns are public they are the layer your opponent reads you through. Everything you draft is a one-shot **Trick**, consumed on play, capped at five in Hand.

At the Clash both cards evaluate their conditions against a single snapshot and all effects apply together, so neither combatant is advantaged by resolution order. A card whose condition does not match does nothing — a **Whiff** — and that is a legal, deliberate, common outcome. From Round 8 both combatants take ramping unavoidable damage, which guarantees the Fight ends.

## Layout

```
src/
  core/      the rules: pure reducer, RuleSet, condition and effect evaluators
  cards/     the 14 starter cards, as data
  bot/       policies and the think-time driver
  referee/   the multiplayer seam: local now, networked later
  render/    Pixi 8 view, fan maths, HUD, draft screen
  dev/       RuleSet panel, replay verification, simulation harness
  app/       wiring and the only clock in the project
```

The load-bearing rule: **`core/` is pure.** `reduce(state, command, ruleSet) -> { state, events }`, with no access to `Math.random`, the clock, timers, or the DOM. Randomness comes from seeded streams held in the state; the countdown lives in `app/` and arrives as an explicit `timeout` command. That is what makes the renderer swappable, the balance testable headlessly, and multiplayer a matter of implementing `Referee` once.

There is no `beats` table anywhere. Paper counters Rock because Paper's card data says so — see [ADR 0002](./docs/adr/0002-engine-has-no-rock-paper-scissors-rule.md) before looking for one.

## Tuning and testing

Every number lives in one `RuleSet` object. Edit it live in the dev panel and hit **APPLY + RESTART**, or measure a variant properly:

```bash
npm run sim -- --fights 20000 --compare coreDamage=5 --compare handVisibility=open
```

A Fight records as `{seed, ruleSet, commands[]}` plus a state hash per Round, so **VERIFY REPLAY** in the dev panel re-runs a recording and names the exact Round if anything ever diverges. That is the tripwire for accidental non-determinism creeping into `core/`.

## Where it stands

20,000 simulated Fights on the default RuleSet:

| | |
| --- | --- |
| Mean Fight length | 10.7 Rounds |
| Whiff rate | 53% |
| Fights reaching Sudden Death | 98% |
| Draws | 26% |
| Seat advantage | none measurable |

Two of those want attention before this is fun. Almost every Fight is decided by Sudden Death rather than by cards, and a quarter end in a draw because Sudden Death damages both combatants at once. Raising `coreDamage` to 5 pulls Sudden Death down to 86% and draws to 19%, so the levers work — the numbers just have not been settled yet.

The larger caveat is that **these numbers come from a random bot**, which validates that the systems work and says nothing about whether the game is good. Every interesting thing here is a response to an opponent with intentions. Add a greedy heuristic policy in `src/bot/` before drawing conclusions about the design.
