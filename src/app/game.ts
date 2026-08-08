import { Container, type Application } from 'pixi.js';
import type { AudioBus } from '../audio/bus.ts';
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
 *
 * A Fight only exists between `start` and `stop`; the Shell owns everything
 * around it, including the audio bus and the way back to the Main Menu.
 */
export class Game {
  #app: Application;
  #root: Container;
  #layer = new Container();
  #audio: AudioBus;

  #referee: LocalReferee | null = null;
  #scene: Scene | null = null;
  #detachBot: (() => void) | null = null;
  #unsubscribe: (() => void) | null = null;

  #phaseKey = '';
  #remainingMs = 0;
  #running = false;
  #options: GameOptions | null = null;

  constructor(app: Application, root: Container, audio: AudioBus) {
    this.#app = app;
    this.#root = root;
    this.#audio = audio;
    this.#root.addChild(this.#layer);

    this.#app.ticker.add(this.#tick);
    window.addEventListener('keydown', this.#onKeyDown);
  }

  /** Null until a Fight has been started. */
  get record(): MatchRecord | null {
    return this.#referee?.record() ?? null;
  }

  get options(): GameOptions | null {
    return this.#options;
  }

  get running(): boolean {
    return this.#running;
  }

  start(options: GameOptions): void {
    this.#teardown();
    this.#options = options;

    const library = createLibrary(options.ruleSet);
    const referee = new LocalReferee(options.seed, options.ruleSet);
    this.#referee = referee;

    this.#scene = new Scene(this.#layer, library, this.#audio, {
      onCommit: (cardId) => referee.commit(HUMAN, cardId),
      onDraft: (cardId, discard) => referee.draft(HUMAN, cardId, discard),
      onClashComplete: () => referee.advance(),
    });

    this.#unsubscribe = referee.subscribe((events) => this.#scene?.handleEvents(events));

    this.#detachBot = attachBot(referee, BOT, options.policy ?? randomPolicy, {
      ...DEFAULT_BOT_OPTIONS,
      seed: options.seed ^ 0x5eed,
    });

    this.#phaseKey = '';
    this.#running = true;
    this.#scene.render(referee.view(HUMAN));
  }

  restart(seed?: number): void {
    const options = this.#options;
    if (options === null) return;
    this.start({ ...options, seed: seed ?? options.seed + 1 });
  }

  /** Ends the Fight and clears the board, leaving the Shell an empty stage. */
  stop(): void {
    this.#teardown();
    this.#referee = null;
    this.#scene = null;
  }

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    window.removeEventListener('keydown', this.#onKeyDown);
    this.stop();
  }

  #teardown(): void {
    this.#running = false;
    this.#detachBot?.();
    this.#unsubscribe?.();
    this.#detachBot = null;
    this.#unsubscribe = null;

    for (const child of this.#layer.removeChildren()) child.destroy({ children: true });
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    if (!this.#running || this.#scene === null) return;

    // Typing a number into the dev panel must not also commit a card.
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;

    if (event.key >= '1' && event.key <= '9') {
      this.#scene.pickByNumber(Number(event.key));
      return;
    }
    if (event.key.toLowerCase() === 'r') this.restart();
  };

  #tick = (): void => {
    const referee = this.#referee;
    const scene = this.#scene;
    if (!this.#running || referee === null || scene === null) return;

    const deltaMs = this.#app.ticker.deltaMS;
    scene.update(deltaMs);

    const view = referee.view(HUMAN);
    const timed = view.phase === 'commit' || view.phase === 'draft';
    const key = `${view.phase}:${view.round}`;

    if (timed && key !== this.#phaseKey) {
      this.#phaseKey = key;
      this.#remainingMs =
        (view.phase === 'commit'
          ? referee.ruleSet.commitSeconds
          : referee.ruleSet.draftSeconds) * 1000;
    }

    if (timed && !scene.clashPlaying) {
      this.#remainingMs -= deltaMs;
      if (this.#remainingMs <= 0) {
        this.#remainingMs = 0;
        referee.timeout();
      }
    }

    const current = referee.view(HUMAN);
    scene.render(current);
    scene.setTimer(
      timed ? this.#remainingMs / 1000 : null,
      current.phase === 'draft' ? 'DRAFT' : 'COMMIT',
    );
  };
}
