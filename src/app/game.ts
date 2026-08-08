import { Container, type Application } from 'pixi.js';
import { AudioBus } from '../audio/bus.ts';
import { attachBot, DEFAULT_BOT_OPTIONS } from '../bot/driver.ts';
import { randomPolicy, type BotPolicy } from '../bot/policy.ts';
import { createLibrary } from '../cards/library.ts';
import type { RuleSet } from '../core/ruleset.ts';
import { LocalReferee } from '../referee/local.ts';
import type { MatchRecord } from '../referee/referee.ts';
import { Scene } from '../render/scene.ts';

const HUMAN = 0;
const BOT = 1;

export interface GameOptions {
  seed: number;
  ruleSet: RuleSet;
  policy?: BotPolicy;
}

/**
 * Wires the Referee, the bot and the Scene together and owns the only clock in
 * the project. The countdown lives here rather than in the reducer, which
 * receives expiry as an explicit `timeout` command.
 */
export class Game {
  #app: Application;
  #root: Container;
  #layer = new Container();
  #audio = new AudioBus();

  #referee!: LocalReferee;
  #scene!: Scene;
  #detachBot: (() => void) | null = null;
  #unsubscribe: (() => void) | null = null;

  #phaseKey = '';
  #remainingMs = 0;
  #running = false;
  #options!: GameOptions;

  constructor(app: Application, root: Container) {
    this.#app = app;
    this.#root = root;
    this.#root.addChild(this.#layer);

    this.#app.ticker.add(this.#tick);
    window.addEventListener('keydown', this.#onKeyDown);
    // Browsers will not start an AudioContext before a gesture, so the bus stays
    // silent until the player touches something.
    window.addEventListener('pointerdown', this.#onGesture);
  }

  get record(): MatchRecord {
    return this.#referee.record();
  }

  get options(): GameOptions {
    return this.#options;
  }

  start(options: GameOptions): void {
    this.#teardown();
    this.#options = options;

    const library = createLibrary(options.ruleSet);
    this.#referee = new LocalReferee(options.seed, options.ruleSet);

    this.#scene = new Scene(this.#layer, library, this.#audio, {
      onCommit: (cardId) => this.#referee.commit(HUMAN, cardId),
      onDraft: (cardId, discard) => this.#referee.draft(HUMAN, cardId, discard),
      onClashComplete: () => this.#referee.advance(),
    });

    this.#unsubscribe = this.#referee.subscribe((events) =>
      this.#scene.handleEvents(events),
    );

    this.#detachBot = attachBot(this.#referee, BOT, options.policy ?? randomPolicy, {
      ...DEFAULT_BOT_OPTIONS,
      seed: options.seed ^ 0x5eed,
    });

    this.#phaseKey = '';
    this.#running = true;
    this.#scene.render(this.#referee.view(HUMAN));
  }

  restart(seed = this.#options.seed + 1): void {
    this.start({ ...this.#options, seed });
  }

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    window.removeEventListener('keydown', this.#onKeyDown);
    window.removeEventListener('pointerdown', this.#onGesture);
    this.#teardown();
  }

  #teardown(): void {
    this.#running = false;
    this.#detachBot?.();
    this.#unsubscribe?.();
    this.#detachBot = null;
    this.#unsubscribe = null;

    for (const child of this.#layer.removeChildren()) child.destroy({ children: true });
  }

  #onGesture = (): void => {
    this.#audio.unlock();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (!this.#running) return;

    // Typing a number into the dev panel must not also commit a card.
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;

    this.#audio.unlock();

    if (event.key >= '1' && event.key <= '9') {
      this.#scene.pickByNumber(Number(event.key));
      return;
    }
    if (event.key.toLowerCase() === 'r') this.restart();
    if (event.key.toLowerCase() === 'm') this.#audio.muted = !this.#audio.muted;
  };

  #tick = (): void => {
    if (!this.#running) return;

    const deltaMs = this.#app.ticker.deltaMS;
    this.#scene.update(deltaMs);

    const view = this.#referee.view(HUMAN);
    const timed = view.phase === 'commit' || view.phase === 'draft';
    const key = `${view.phase}:${view.round}`;

    if (timed && key !== this.#phaseKey) {
      this.#phaseKey = key;
      this.#remainingMs =
        (view.phase === 'commit'
          ? this.#referee.ruleSet.commitSeconds
          : this.#referee.ruleSet.draftSeconds) * 1000;
    }

    if (timed && !this.#scene.clashPlaying) {
      this.#remainingMs -= deltaMs;
      if (this.#remainingMs <= 0) {
        this.#remainingMs = 0;
        this.#referee.timeout();
      }
    }

    const current = this.#referee.view(HUMAN);
    this.#scene.render(current);
    this.#scene.setTimer(
      timed ? this.#remainingMs / 1000 : null,
      current.phase === 'draft' ? 'DRAFT' : 'COMMIT',
    );
  };
}
