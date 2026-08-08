import { Container } from 'pixi.js';
import type { AudioBus, SoundCue } from '../audio/bus.ts';
import { cardById, CORE_IDS } from '../cards/library.ts';
import type { CardLibrary } from '../core/cards.ts';
import type { GameEvent } from '../core/events.ts';
import type { PlayerId } from '../core/state.ts';
import type { FightView } from '../core/view.ts';
import { Banner } from './banner.ts';
import { ClashView, type ClashBeat, type ClashScript, type ClashSide } from './clash.ts';
import { Countdown } from './countdown.ts';
import { DraftView } from './draft.ts';
import { HandView, type HandEntry } from './hand.ts';
import { CombatantPlate } from './hud.ts';
import {
  BANNER,
  CLASH,
  COUNTDOWN,
  OPPONENT_FAN,
  OPPONENT_PLATE,
  PLAYER_FAN,
  PLAYER_PLATE,
} from './layout.ts';
import { BLOOD, CARD, CARD_SMALL, ECHO, INK, MUTED } from './theme.ts';

/** HP drains at a readable speed rather than snapping, in HP per second. */
const HP_DRAIN_RATE = 14;

export interface SceneHandlers {
  onCommit: (cardId: string) => void;
  onDraft: (cardId: string | null, discard: string | null) => void;
  onClashComplete: () => void;
}

interface ClashTally {
  cards: readonly [string, string];
  winner: PlayerId | null;
  stalemate: boolean;
  taken: [number, number];
  healed: [number, number];
  noEffect: [boolean, boolean];
  suddenDeath: boolean;
}

interface PendingBanner {
  text: string;
  color: number;
  durationMs: number;
  cue: SoundCue | null;
}

export class Scene {
  #library: CardLibrary;
  #handlers: SceneHandlers;
  #audio: AudioBus;

  #playerHand: HandView;
  #opponentHand: HandView;
  #playerPlate = new CombatantPlate('Branny', 'left', 'up');
  #opponentPlate = new CombatantPlate('Opponent', 'right', 'down');
  #countdown = new Countdown();
  #clash: ClashView;
  #banner = new Banner();
  #draft: DraftView;

  #view: FightView | null = null;
  #pendingClash: ClashTally | null = null;
  #playing: ClashTally | null = null;
  #pendingBanners: PendingBanner[] = [];
  #draftShownFor = -1;
  #lastTick: number | null = null;

  /**
   * The reducer applies a whole Clash the instant both combatants commit, so
   * the plates would otherwise show the new HP while the cards are still
   * squaring up. They hold the pre-Clash figures until the blow lands.
   */
  #hpShown: [number, number] | null = null;
  #hpTarget: [number, number] = [0, 0];
  #hpHeld = false;

  constructor(
    root: Container,
    library: CardLibrary,
    audio: AudioBus,
    handlers: SceneHandlers,
  ) {
    this.#library = library;
    this.#handlers = handlers;
    this.#audio = audio;

    this.#opponentHand = new HandView({
      size: CARD_SMALL,
      interactive: false,
      fan: OPPONENT_FAN,
    });

    this.#playerHand = new HandView({
      size: CARD,
      interactive: true,
      fan: PLAYER_FAN,
      onPick: (index) => this.#pick(index),
      onHover: () => this.#audio.play('hover'),
    });

    this.#clash = new ClashView((beat) => this.#onClashBeat(beat));

    this.#playerPlate.position.set(PLAYER_PLATE.x, PLAYER_PLATE.y);
    this.#opponentPlate.position.set(OPPONENT_PLATE.x, OPPONENT_PLATE.y);
    this.#countdown.position.set(COUNTDOWN.x, COUNTDOWN.y);
    this.#clash.position.set(CLASH.x, CLASH.y);
    this.#banner.position.set(BANNER.x, BANNER.y);

    this.#draft = new DraftView(library, {
      onTake: (cardId, discard) => this.#handlers.onDraft(cardId, discard),
      onSkip: () => this.#handlers.onDraft(null, null),
    });

    root.addChild(
      this.#opponentHand,
      this.#playerHand,
      this.#playerPlate,
      this.#opponentPlate,
      this.#countdown,
      this.#clash,
      this.#banner,
      this.#draft,
    );
  }

  render(view: FightView): void {
    this.#view = view;

    this.#hpTarget = [view.self.hp, view.opponent.hp];
    if (this.#hpShown === null) this.#hpShown = [...this.#hpTarget];

    const suddenDeath = view.round >= view.suddenDeathRound;

    this.#playerPlate.update({
      hp: Math.round(this.#hpShown[0]),
      maxHp: view.startingHp,
      handCount: view.self.hand.length,
      handCap: view.handCap,
      echoes: view.self.echoes,
      notes: suddenDeath ? ['SUDDEN DEATH'] : [],
    });

    this.#opponentPlate.update({
      hp: Math.round(this.#hpShown[1]),
      maxHp: view.startingHp,
      handCount: view.opponent.handCount,
      handCap: view.handCap,
      echoes: view.opponent.echoes,
      notes: view.opponent.hasCommitted && view.phase === 'commit' ? ['LOCKED IN'] : [],
    });

    this.#playerHand.setEntries(this.#playerEntries(view));
    this.#opponentHand.setEntries(this.#opponentEntries(view));

    if (view.self.committed !== null) {
      const index = this.#playerHand.entries.findIndex(
        (entry) => entry.card?.id === view.self.committed,
      );
      this.#playerHand.setSelected(index);
    } else {
      this.#playerHand.setSelected(-1);
    }

    this.#syncDraft(view);
  }

  /** Card ids the player can currently commit, in fan order. */
  #playerEntries(view: FightView): HandEntry[] {
    const locked = view.self.committed !== null || view.phase !== 'commit';

    const cores: HandEntry[] = CORE_IDS.map((type) => ({
      key: `core:${type}`,
      card: cardById(this.#library, type),
      faceDown: false,
      lockRounds: view.self.cooldowns[type],
      lockKind: view.self.cooldowns[type] > 1 ? 'stun' : 'cooldown',
      playable: !locked,
    }));

    const tricks: HandEntry[] = view.self.hand.map((cardId, index) => ({
      key: `trick:${index}:${cardId}`,
      card: cardById(this.#library, cardId),
      faceDown: false,
      lockRounds: 0,
      lockKind: 'cooldown',
      playable: !locked,
    }));

    return [...cores, ...tricks];
  }

  #opponentEntries(view: FightView): HandEntry[] {
    const cores: HandEntry[] = CORE_IDS.map((type) => ({
      key: `ocore:${type}`,
      card: cardById(this.#library, type),
      faceDown: false,
      lockRounds: view.opponent.cooldowns[type],
      lockKind: view.opponent.cooldowns[type] > 1 ? 'stun' : 'cooldown',
      playable: false,
    }));

    const open = view.opponent.hand;
    const tricks: HandEntry[] = Array.from(
      { length: view.opponent.handCount },
      (_, index) => ({
        key: `otrick:${index}:${open?.[index] ?? 'hidden'}`,
        card: open === null ? null : cardById(this.#library, open[index]!),
        faceDown: open === null,
        lockRounds: 0,
        lockKind: 'cooldown' as const,
        playable: false,
      }),
    );

    return [...cores, ...tricks];
  }

  #pick(index: number): void {
    const entry = this.#playerHand.entries[index];
    if (entry?.card == null || !entry.playable) return;
    this.#handlers.onCommit(entry.card.id);
  }

  /** Number keys are meaningfully faster than the mouse under a countdown. */
  pickByNumber(number: number): void {
    this.#pick(number - 1);
  }

  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.kind) {
        case 'clashRevealed':
          this.#pendingClash = {
            cards: event.cards,
            winner: event.winner,
            stalemate: event.stalemate,
            taken: [0, 0],
            healed: [0, 0],
            noEffect: [false, false],
            suddenDeath: false,
          };
          break;

        case 'committed':
          // An auto-commit is the countdown acting, not the player, so it does
          // not get the lock-in thunk.
          if (event.player === 0 && !event.auto) this.#audio.play('commit');
          break;

        case 'damaged':
          if (this.#pendingClash !== null) {
            this.#pendingClash.taken[event.target] += event.amount;
          }
          break;

        case 'healed':
          if (this.#pendingClash !== null) {
            this.#pendingClash.healed[event.player] += event.amount;
          }
          break;

        case 'noEffect':
          if (this.#pendingClash !== null) this.#pendingClash.noEffect[event.player] = true;
          break;

        case 'echoRevealed':
          this.#announce(event.label.toUpperCase(), ECHO, 1800, null);
          break;

        case 'suddenDeath':
          // Cued with the rest of the Clash damage rather than on its own, so
          // the two never land on the same frame as separate noises.
          if (this.#pendingClash !== null) this.#pendingClash.suddenDeath = true;
          this.#announce(`SUDDEN DEATH  -${event.amount}`, BLOOD, 1400, null);
          break;

        case 'fightEnded':
          this.#announce(
            event.outcome.kind === 'draw'
              ? 'DRAW'
              : event.outcome.player === 0
                ? 'YOU WIN'
                : 'YOU LOSE',
            event.outcome.kind === 'draw' ? MUTED : INK,
            6000,
            event.outcome.kind === 'winner' && event.outcome.player === 0
              ? 'fightWon'
              : 'fightLost',
          );
          break;

        default:
          break;
      }
    }

    if (this.#pendingClash !== null) this.#startClash(this.#pendingClash);
  }

  /**
   * Callouts that arrive mid-Clash wait for the report beat: announcing the
   * Fight over while the cards are still mid-swing reads as a bug.
   */
  #announce(text: string, color: number, durationMs: number, cue: SoundCue | null): void {
    if (this.#pendingClash !== null || this.#clash.playing) {
      this.#pendingBanners.push({ text, color, durationMs, cue });
      return;
    }

    this.#banner.show(text, color, durationMs);
    if (cue !== null) this.#audio.play(cue);
  }

  #startClash(tally: ClashTally): void {
    this.#pendingClash = null;
    this.#playing = tally;
    this.#hpHeld = true;

    const script: ClashScript = {
      sides: [this.#sideOf(tally, 0), this.#sideOf(tally, 1)],
      winner: tally.winner,
      stalemate: tally.stalemate,
    };
    this.#clash.play(script);

    // The reveal sits over the same ground the player's fan occupies, so the
    // hands step aside rather than showing through it.
    this.#setHandsVisible(false);
  }

  #sideOf(tally: ClashTally, player: PlayerId): ClashSide {
    const cardId = tally.cards[player];
    const card = cardId === '' ? null : cardById(this.#library, cardId);

    const parts: string[] = [];
    if (tally.taken[player] > 0) parts.push(`-${tally.taken[player]}`);
    if (tally.healed[player] > 0) parts.push(`+${tally.healed[player]}`);

    if (parts.length === 0) {
      return tally.noEffect[player]
        ? { card, float: 'NO EFFECT', floatColor: MUTED }
        : { card, float: '', floatColor: MUTED };
    }

    return {
      card,
      float: parts.join('  '),
      floatColor: tally.taken[player] > 0 ? BLOOD : ECHO,
    };
  }

  #onClashBeat(beat: ClashBeat): void {
    const tally = this.#playing;

    switch (beat) {
      case 'reveal':
        this.#audio.play('reveal');
        break;

      case 'windup':
        this.#audio.play('windup');
        break;

      case 'impact':
        this.#audio.play(tally?.stalemate === true ? 'flop' : 'impact');
        // The bars drain as the Loser goes down, so the hit has a consequence
        // on screen before the numbers spell it out.
        this.#hpHeld = false;
        break;

      case 'report': {
        this.#hpHeld = false;
        if (tally !== null) {
          const hit = tally.taken[0] + tally.taken[1] > 0 || tally.suddenDeath;
          const healed = tally.healed[0] + tally.healed[1] > 0;
          if (hit) this.#audio.play('damage');
          else if (healed) this.#audio.play('heal');
        }
        for (const pending of this.#pendingBanners) {
          this.#banner.show(pending.text, pending.color, pending.durationMs);
          if (pending.cue !== null) this.#audio.play(pending.cue);
        }
        this.#pendingBanners = [];
        break;
      }
    }
  }

  #setHandsVisible(visible: boolean): void {
    this.#playerHand.visible = visible;
    this.#opponentHand.visible = visible;
  }

  #syncDraft(view: FightView): void {
    const shouldShow =
      view.phase === 'draft' && !view.self.draftTaken && view.self.draftOffer !== null;

    if (!shouldShow) {
      this.#draft.hide();
      this.#draftShownFor = -1;
      return;
    }

    if (this.#draftShownFor === view.round) return;
    this.#draftShownFor = view.round;
    this.#draft.show(view.self.draftOffer!, view.self.hand, view.handCap);
    this.#audio.play('draft');
  }

  setTimer(secondsRemaining: number | null, label: string): void {
    const hidden = this.#clash.playing || this.#view?.phase === 'over';
    const seconds =
      secondsRemaining === null ? null : Math.max(0, Math.ceil(secondsRemaining));

    if (!hidden && seconds !== null && seconds > 0 && seconds !== this.#lastTick) {
      this.#audio.play(seconds <= 3 ? 'tickUrgent' : 'tick');
    }
    this.#lastTick = hidden ? null : seconds;

    this.#countdown.set(hidden ? null : secondsRemaining, label);
  }

  update(deltaMs: number): void {
    this.#banner.update(deltaMs);
    this.#drainHp(deltaMs);

    if (this.#clash.update(deltaMs)) {
      this.#playing = null;
      this.#setHandsVisible(true);
      this.#handlers.onClashComplete();
    }
  }

  #drainHp(deltaMs: number): void {
    if (this.#hpShown === null || this.#hpHeld) return;

    const step = (HP_DRAIN_RATE * deltaMs) / 1000;

    for (const player of [0, 1] as const) {
      const shown = this.#hpShown[player];
      const target = this.#hpTarget[player];
      const gap = target - shown;

      this.#hpShown[player] =
        Math.abs(gap) <= step ? target : shown + Math.sign(gap) * step;
    }
  }

  get clashPlaying(): boolean {
    return this.#clash.playing;
  }
}
