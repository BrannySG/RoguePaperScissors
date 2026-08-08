# The engine has no Rock-Paper-Scissors rule

There is no `beats` table anywhere in this codebase, and searching for one is how most readers will start. Paper counters Rock solely because Paper's card data says `{ when: { opponentType: ['rock'] }, then: [{ damage: 3 }] }`. The engine knows only how to evaluate a condition against the opposing card and apply a list of effects; the famous triangle is an emergent property of three cards that happen to be written in a cycle.

We chose this because the game's whole ambition is a growing pool of cards that interact in unanticipated ways — Fish spawning Fish Guts, cards that punish the opponent for spending a Trick, cards that stun a Core. Under a rules-first engine with a built-in `beats` relation, every one of those needs an exception bolted onto the resolver, and the resolver accretes special cases until nobody can predict what a new card will do. Under cards-first, adding a card is adding a data file and touching no logic at all.

## Consequences

A Clash where neither card's condition matches is legal and does nothing — see **Whiff** in `CONTEXT.md`. This is deliberate and should not be "fixed" with a fallback damage rule; whiffs are what make reads matter, and the Fight is guaranteed to terminate by Sudden Death rather than by every exchange dealing damage. The corresponding risk is that a card can be authored whose condition nothing in the pool ever satisfies, making it dead on arrival. Types are the guard against that: every card carries exactly one of Rock, Paper or Scissors, so it always remains reachable by the base triangle no matter what Tags it also carries.
