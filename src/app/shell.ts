import { Container, type Application } from 'pixi.js';
import { AudioBus, MUSIC_FADE_MS } from '../audio/bus.ts';
import { DEFAULT_RULESET } from '../core/ruleset.ts';
import type { MatchRecord } from '../referee/referee.ts';
import { Button } from '../render/button.ts';
import { Curtain } from '../render/screens/curtain.ts';
import { MainMenu } from '../render/screens/menu.ts';
import { SplashScreen } from '../render/screens/splash.ts';
import { Game, type GameOptions } from './game.ts';

const SPLASH_FADE_MS = 420;
const SPLASH_HOLD_MS = 1500;
/** The scene sheet moves faster than the music ramp so it never feels stalled. */
const SCENE_FADE_MS = 1000;
const LOADING_MS = 500;
const MENU_SETTLE_MS = 300;

type ShellState = 'splash' | 'menu' | 'fight' | 'transition';

/**
 * Everything outside a Fight: the Splash cards, the Main Menu, and the fades
 * and music handovers between them. The Game is started and stopped from here
 * and knows nothing about any of it.
 */
export class Shell {
  #app: Application;
  #audio = new AudioBus();
  #screens = new Container();
  #hud = new Container();
  #curtain = new Curtain();
  #splash = new SplashScreen();
  #menu: MainMenu;
  #game: Game;

  #state: ShellState = 'splash';
  #skip: (() => void) | null = null;
  #fightOptions: GameOptions = { seed: newSeed(), ruleSet: DEFAULT_RULESET };

  constructor(app: Application, root: Container) {
    this.#app = app;

    // Added in draw order: screens, then the Fight, then its HUD, then the sheet.
    root.addChild(this.#screens);
    this.#game = new Game(app, root, this.#audio);
    root.addChild(this.#hud, this.#curtain);

    this.#menu = new MainMenu(this.#audio, { onSolo: () => this.startFight() });
    this.#splash.visible = false;
    this.#menu.visible = false;
    this.#screens.addChild(this.#splash, this.#menu);

    const toMenu = new Button('MENU', 170, 58, () => this.returnToMenu(), {
      fontSize: 24,
    });
    toMenu.position.set(160, 62);
    this.#hud.addChild(toMenu);
    this.#hud.visible = false;

    app.ticker.add(this.#tick);
    window.addEventListener('pointerdown', this.#onGesture);
    window.addEventListener('keydown', this.#onKeyDown);
  }

  /** Null until a Fight has been started. Read by the dev panel. */
  get record(): MatchRecord | null {
    return this.#game.record;
  }

  get fightOptions(): GameOptions {
    return this.#fightOptions;
  }

  async start(): Promise<void> {
    await this.#curtain.cover(0);
    await this.#showSplash('SAUCE GAMES', 'studio');
    await this.#showSplash('a game designed by Branny', 'credit');

    this.#splash.visible = false;
    await this.#openMenu();
  }

  startFight(options: Partial<GameOptions> = {}): void {
    void this.#toFight(options);
  }

  returnToMenu(): void {
    void this.#toMenu();
  }

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    window.removeEventListener('pointerdown', this.#onGesture);
    window.removeEventListener('keydown', this.#onKeyDown);
    this.#game.destroy();
  }

  async #showSplash(text: string, kind: 'studio' | 'credit'): Promise<void> {
    this.#splash.show(text, kind);
    this.#splash.visible = true;

    await this.#curtain.reveal(SPLASH_FADE_MS);
    await this.#hold(SPLASH_HOLD_MS);
    await this.#curtain.cover(SPLASH_FADE_MS);
  }

  async #openMenu(): Promise<void> {
    this.#menu.closeOverlay();
    this.#menu.syncPrefs();
    this.#menu.visible = true;
    this.#hud.visible = false;
    this.#state = 'menu';

    this.#audio.playMusic('menu', MUSIC_FADE_MS);
    this.#curtain.setLoading(false);
    await this.#curtain.reveal(SCENE_FADE_MS);
  }

  async #toFight(options: Partial<GameOptions>): Promise<void> {
    if (this.#state === 'transition') return;
    this.#state = 'transition';

    this.#audio.stopMusic(MUSIC_FADE_MS);
    await this.#curtain.cover(SCENE_FADE_MS);

    this.#menu.closeOverlay();
    this.#menu.visible = false;

    this.#curtain.setLoading(true);
    this.#fightOptions = {
      seed: options.seed ?? newSeed(),
      ruleSet: options.ruleSet ?? this.#fightOptions.ruleSet,
      policy: options.policy ?? this.#fightOptions.policy,
    };
    this.#game.start(this.#fightOptions);
    await wait(LOADING_MS);

    this.#curtain.setLoading(false);
    this.#hud.visible = true;
    this.#state = 'fight';

    this.#audio.playMusic('fight', MUSIC_FADE_MS);
    await this.#curtain.reveal(SCENE_FADE_MS);
  }

  async #toMenu(): Promise<void> {
    if (this.#state !== 'fight') return;
    this.#state = 'transition';

    this.#audio.stopMusic(MUSIC_FADE_MS);
    await this.#curtain.cover(SCENE_FADE_MS);

    this.#game.stop();
    this.#hud.visible = false;

    this.#curtain.setLoading(true);
    await wait(MENU_SETTLE_MS);

    await this.#openMenu();
  }

  /** A wait the player can cut short, which is all a Splash card really is. */
  #hold(durationMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let timer = 0;
      const finish = (): void => {
        window.clearTimeout(timer);
        this.#skip = null;
        resolve();
      };

      timer = window.setTimeout(finish, durationMs);
      this.#skip = finish;
    });
  }

  #tick = (): void => {
    const deltaMs = this.#app.ticker.deltaMS;
    this.#curtain.update(deltaMs);
    this.#menu.update(deltaMs);
  };

  #onGesture = (): void => {
    this.#audio.unlock();
    if (this.#state === 'splash') this.#skip?.();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;

    this.#audio.unlock();

    if (this.#state === 'splash') {
      this.#skip?.();
      return;
    }

    // Mute is reachable from every screen, and writes through to Prefs.
    if (event.key.toLowerCase() === 'm') {
      this.#audio.muted = !this.#audio.muted;
      this.#menu.syncPrefs();
      return;
    }

    if (event.key === 'Escape') {
      if (this.#state === 'menu' && this.#menu.overlayOpen) this.#menu.closeOverlay();
      else if (this.#state === 'fight') this.returnToMenu();
    }
  };
}

function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}
