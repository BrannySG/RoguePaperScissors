# Rogue Paper Scissors

A duelling card game descended from Rock Paper Scissors. Two combatants secretly commit one card per Round under a countdown, the cards resolve against each other, and both are then offered new cards to fight back with.

## Language

### The Fight

**Fight**:
A single duel between two combatants, from full HP until one reaches 0.
_Avoid_: match, battle, game

**Run**:
A sequence of Fights sharing one accumulating Hand. Not yet built — the Fight is modelled so a Run can wrap it later.
_Avoid_: campaign, season, career

**Round**:
One full cycle of Commit, Clash and Draft. Both combatants act within the same Round.
_Avoid_: turn — nothing alternates, and "turn" implies an ordering that does not exist here

**Commit**:
Choosing and locking a card during the Round's countdown, secretly and simultaneously.
_Avoid_: play, select, submit

**Clash**:
The moment two committed cards resolve against each other.
_Avoid_: combat, battle, resolution phase

**Winner**:
The committed card whose Type Counters the other's. The only card in a Clash allowed to fire its rules.
_Avoid_: attacker, aggressor

**Loser**:
The committed card whose Type is Countered. Spent all the same, and its rules never fire.
_Avoid_: victim, defender

**Stalemate**:
A Clash between two cards of the same Type. There is no Winner, neither card's rules fire, and both are still spent.
_Avoid_: tie, draw, mirror

**No Effect**:
A Clash won on Type by a card whose Condition did not match, so winning bought nothing. A legal and common outcome, not an error.
_Avoid_: whiff, miss, fizzle

**Condition**:
What a card asks about the Clash before its rules fire. Only ever checked on the Winner.
_Avoid_: trigger, requirement, prerequisite

**Draft**:
The offer of new Tricks made to each combatant between Clashes.
_Avoid_: shop, reward, pick, loot

**Sudden Death**:
The phase from a fixed Round onward in which both combatants take unavoidable ramping damage every Round, guaranteeing the Fight terminates.
_Avoid_: overtime, fatigue, decay

### Cards

**Core**:
One of the three permanent cards every combatant owns — Rock, Paper, Scissors. Never consumed, gated only by Cooldown.
_Avoid_: basic, starter, base card

**Trick**:
A drafted card. Spent at the Clash whether or not it did anything, and gone.
_Avoid_: spell, item, ability, action

**Hand**:
Every card a combatant holds: their three Cores, plus room for two Tricks alongside them.
_Avoid_: deck — there is no deck, nothing is drawn or shuffled into play

**Type**:
The single Rock, Paper or Scissors classification every card carries regardless of its name. Fish is a Rock-type card.
_Avoid_: element, suit, class, colour

**Tag**:
A freeform label a card may carry any number of, such as Beast or Metal. Carries synergy between cards but takes no part in the triangle.
_Avoid_: keyword, trait, subtype

**Counters**:
The relation the triangle is made of: Rock Counters Scissors, Paper Counters Rock, Scissors Counters Paper. It decides the Winner of a Clash and nothing else.
_Avoid_: trumps, wins against

**Cooldown**:
The lockout a Core enters after being played, during which its owner cannot play it. Always public to both combatants.
_Avoid_: exhaust, tap, recharge

**Stun**:
A Cooldown inflicted on an opponent's Core by a card effect, rather than one incurred by playing it. Mechanically identical, distinct in origin.
_Avoid_: freeze, lock, disable

**Echo**:
A lasting rule change left behind by a spent Trick. Secret until the Round it first alters an outcome, permanently public afterwards.
_Avoid_: buff, aura, passive, relic, standing

### Setup

**RuleSet**:
The complete set of tunable rules and numbers a Fight is played under. Fights recorded under different RuleSets are not comparable.
_Avoid_: config, settings, options, balance

### Outside the Fight

**Splash**:
A title card shown once at boot, before the Main Menu. Carries a credit and nothing else.
_Avoid_: intro, logo screen, loading screen

**Main Menu**:
The screen a player leaves to start a Fight and returns to when one is over. Not part of any Fight.
_Avoid_: home, lobby, title screen, front end

**Prefs**:
The player's own audio choices — mute, music volume, SFX volume. Kept across sessions, and unlike a RuleSet it changes nothing about how a Fight plays.
_Avoid_: settings, config, options, preferences
