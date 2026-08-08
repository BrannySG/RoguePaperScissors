import { Container } from 'pixi.js';
import { cardById, CORE_IDS } from '../cards/library.ts';
import type { CardLibrary } from '../core/cards.ts';
import type { GameEvent } from '../core/events.ts';
import type { PlayerId } from '../core/state.ts';
import type { FightView } from '../core/view.ts';
import { Banner } from './banner.ts';
import { ClashView, type ClashSide } from './clash.ts';
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

/** How long the reveal holds before the Draft opens. */
export const CLASH_HOLD_MS = 2300;

export interface SceneHandlers {
  onCommit: (cardId: string) => void;
  onDraft: (cardId: string | null, discard: string | null) => void;
  onClashComplete: () => void;
}

interface ClashTally {
  dealt: [number, number];
  healed: [number, number];
  whiffed: [boolean, boolean];
  cards: readonly [string, string];
}

export class Scene {
  #library: CardLibrary;
  #handlers: SceneHandlers;

  #playerHand: HandView;
  #opponentHand: HandView;
  #playerPlate = new CombatantPlate('Branny', 'left', 'up');
  #opponentPlate = new CombatantPlate('Opponent', 'right', 'down');
  #countdown = new Countdown();
  #clash = new ClashView();
  #banner = new Banner();
  #draft: DraftView;

  #view: FightView | null = null;
  #clashRemainingMs = 0;
  #pendingClash: ClashTally | null = null;
  #draftShownFor = -1;

  constructor(root: Container, library: CardLibrary, handlers: SceneHandlers) {
    this.#library = library;
    this.#handlers = handlers;

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
    });

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

    const suddenDeath = view.round >= view.suddenDeathRound;

    this.#playerPlate.update({
      hp: view.self.hp,
      maxHp: view.startingHp,
      handCount: view.self.hand.length,
      handCap: view.handCap,
      echoes: view.self.echoes,
      notes: suddenDeath ? ['SUDDEN DEATH'] : [],
    });

    this.#opponentPlate.update({
      hp: view.opponent.hp,
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
            dealt: [0, 0],
            healed: [0, 0],
            whiffed: [false, false],
            cards: event.cards,
          };
          break;

        case 'damaged':
          if (this.#pendingClash !== null && event.source !== event.target) {
            this.#pendingClash.dealt[event.source] += event.amount;
          }
          break;

        case 'healed':
          if (this.#pendingClash !== null) {
            this.#pendingClash.healed[event.player] += event.amount;
          }
          break;

        case 'whiffed':
          if (this.#pendingClash !== null) this.#pendingClash.whiffed[event.player] = true;
          break;

        case 'echoRevealed':
          this.#banner.show(event.label.toUpperCase(), ECHO, 1800);
          break;

        case 'suddenDeath':
          this.#banner.show(`SUDDEN DEATH  -${event.amount}`, BLOOD, 1400);
          break;

        case 'fightEnded':
          this.#banner.show(
            event.outcome.kind === 'draw'
              ? 'DRAW'
              : event.outcome.player === 0
                ? 'YOU WIN'
                : 'YOU LOSE',
            event.outcome.kind === 'draw' ? MUTED : INK,
            6000,
          );
          break;

        default:
          break;
      }
    }

    if (this.#pendingClash !== null) this.#showClash(this.#pendingClash);
  }

  #showClash(tally: ClashTally): void {
    const side = (player: PlayerId): ClashSide => {
      const cardId = tally.cards[player];
      const card = cardId === '' ? null : cardById(this.#library, cardId);

      if (tally.whiffed[player]) {
        return { card, result: 'WHIFF', resultColor: MUTED };
      }

      const parts: string[] = [];
      if (tally.dealt[player] > 0) parts.push(`${tally.dealt[player]} DMG`);
      if (tally.healed[player] > 0) parts.push(`+${tally.healed[player]}`);

      return {
        card,
        result: parts.join('  ') || '-',
        resultColor: tally.dealt[player] > 0 ? BLOOD : ECHO,
      };
    };

    this.#clash.show(side(0), side(1));
    // The reveal sits over the same ground the player's fan occupies, so the
    // hands step aside rather than showing through it.
    this.#setHandsVisible(false);
    this.#clashRemainingMs = CLASH_HOLD_MS;
    this.#pendingClash = null;
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
  }

  setTimer(secondsRemaining: number | null, label: string): void {
    const hidden = this.#clash.visible || this.#view?.phase === 'over';
    this.#countdown.set(hidden ? null : secondsRemaining, label);
  }

  update(deltaMs: number): void {
    this.#banner.update(deltaMs);

    if (this.#clashRemainingMs > 0) {
      this.#clashRemainingMs -= deltaMs;
      if (this.#clashRemainingMs <= 0) {
        this.#clashRemainingMs = 0;
        this.#clash.hide();
        this.#setHandsVisible(true);
        this.#handlers.onClashComplete();
      }
    }
  }

  get clashPlaying(): boolean {
    return this.#clashRemainingMs > 0;
  }
}
