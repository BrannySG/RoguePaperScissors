# Rogue Paper Scissors

A duelling card game descended from Rock Paper Scissors. Two combatants secretly commit one card per Round under a countdown, the cards resolve against each other simultaneously, and both are offered extra cards to fight back with.

This is a prototype: one Fight against a random bot, built so the rules can be re-tuned as data and tested by the thousand.

Start with [`CONTEXT.md`](./CONTEXT.md) for the vocabulary — the terms below (Round, Clash, Core, Trick, Echo, Stalemate) all have precise meanings — and [`docs/adr/`](./docs/adr) for the decisions that shape everything else.

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

**Playing.** Click a card in the bottom-right fan, or press `1`–`5`. Cards `1`–`3` are your Cores. Press `R` to restart, `M` to mute, and `` ` `` to toggle the dev panel.

## How a Round works

```
Commit (10s, both in secret)  ->  Clash  ->  Draft (8s)  ->  repeat
```

Both combatants start at 20 HP and hold three permanent **Cores** — Rock, Paper, Scissors. Playing a Core puts it on **Cooldown** for a Round, so you only ever hold two of the three, and because Cooldowns are public they are the layer your opponent reads you through. Everything you draft is a one-shot **Trick**, spent at the Clash whether or not it did anything, with room for two alongside your Cores.

At the Clash the Type triangle names the **Winner**, and only the Winner's card evaluates its Condition and applies effects. The Loser is spent and does nothing; two cards of the same Type are a **Stalemate** and neither does anything. Winning on Type with a Condition that does not match is **No Effect** — a legal, deliberate, common outcome. From Round 8 both combatants take ramping unavoidable damage, which guarantees the Fight ends.

## Layout

```
src/
  core/      the rules: pure reducer, RuleSet, triangle, condition and effect evaluators
  cards/     the 13 starter cards, as data
  bot/       policies and the think-time driver
  referee/   the multiplayer seam: local now, networked later
  render/    Pixi 8 view, fan maths, HUD, Clash cinema, draft screen
  audio/     procedural one-shot cues, no asset files
  dev/       RuleSet panel, replay verification, simulation harness
  app/       wiring and the only clock in the project
```

The load-bearing rule: **`core/` is pure.** `reduce(state, command, ruleSet) -> { state, events }`, with no access to `Math.random`, the clock, timers, or the DOM. Randomness comes from seeded streams held in the state; the countdown lives in `app/` and arrives as an explicit `timeout` command. That is what makes the renderer swappable, the balance testable headlessly, and multiplayer a matter of implementing `Referee` once.

The triangle lives in `core/triangle.ts` and does exactly one job: name the Winner of a Clash. Everything a card then *does* is still data. [ADR 0004](./docs/adr/0004-type-triangle-picks-the-clash-winner.md) explains why it moved into the engine, and what that costs card authors.

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
| Mean Fight length | 11.0 Rounds |
| Stalemate rate | 34% |
| No Effect rate (of decided Clashes) | 5% |
| Fights reaching Sudden Death | 99% |
| Draws | 27% |
| Seat advantage | none measurable |

Two of those want attention before this is fun. Almost every Fight is decided by Sudden Death rather than by cards, and a quarter end in a draw because Sudden Death damages both combatants at once — a third of Rounds being a Stalemate is most of the reason why. Raising `coreDamage` to 5 pulls Sudden Death down to 88% and draws to 17%, so the levers work — the numbers just have not been settled yet.

The larger caveat is that **these numbers come from a random bot**, which validates that the systems work and says nothing about whether the game is good. Every interesting thing here is a response to an opponent with intentions. Add a greedy heuristic policy in `src/bot/` before drawing conclusions about the design.
