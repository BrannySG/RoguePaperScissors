import { Container, Graphics, Text } from 'pixi.js';
import type { AudioBus } from '../../audio/bus.ts';
import type { Boil } from '../boil.ts';
import { Button } from '../button.ts';
import { squiggle } from '../ink.ts';
import { body, MUTED, title } from '../theme.ts';
import { VIRTUAL_WIDTH } from '../viewport.ts';
import { HowToPlayOverlay } from './howToPlay.ts';
import { PrefsOverlay } from './prefs.ts';

const BUTTON = { width: 460, height: 84, fontSize: 34 } as const;
const FIRST_BUTTON_Y = 520;
const BUTTON_GAP = 130;
const WIGGLE_MS = 620;

export interface MenuHandlers {
  onSolo: () => void;
}

/** The hub: the title, the four ways out of it, and the two overlays. */
export class MainMenu extends Container {
  #audio: AudioBus;
  #buttons = new Container();
  #versusScratch: Graphics;
  #scratchHome = { x: 0, y: 0 };
  #wiggleMs = 0;

  #howToPlay: HowToPlayOverlay;
  #prefs: PrefsOverlay;

  constructor(audio: AudioBus, boil: Boil, handlers: MenuHandlers) {
    super();
    this.#audio = audio;

    this.addChild(this.#title(), this.#buttons);

    this.#button('SOLO', 0, () => {
      this.#audio.play('commit');
      handlers.onSolo();
    });

    const versus = this.#button('VERSUS ONLINE', 1, () => {
      this.#audio.play('flop');
      this.#wiggleMs = WIGGLE_MS;
    }, true);

    const soon = new Text({ text: 'COMING SOON', style: body(22, '700', MUTED) });
    soon.anchor.set(0.5);
    soon.position.set(VIRTUAL_WIDTH / 2, versus.y + BUTTON.height / 2 + 26);

    const scratchWidth = BUTTON.width - 40;
    this.#versusScratch = squiggle(scratchWidth, { amplitude: 8, waves: 5 });
    this.#versusScratch.pivot.set(scratchWidth / 2, 0);
    this.#scratchHome = { x: VIRTUAL_WIDTH / 2, y: versus.y };
    this.#versusScratch.position.set(this.#scratchHome.x, this.#scratchHome.y);

    this.#buttons.addChild(soon, this.#versusScratch);

    this.#button('HOW TO PLAY', 2, () => {
      this.#audio.play('draft');
      this.#open(this.#howToPlay);
    });

    this.#button('SETTINGS', 3, () => {
      this.#audio.play('draft');
      this.#prefs.sync();
      this.#open(this.#prefs);
    });

    this.#howToPlay = new HowToPlayOverlay(() => this.closeOverlay());
    this.#prefs = new PrefsOverlay(audio, boil, () => this.closeOverlay());
    this.#howToPlay.visible = false;
    this.#prefs.visible = false;
    this.addChild(this.#howToPlay, this.#prefs);
  }

  get overlayOpen(): boolean {
    return this.#howToPlay.visible || this.#prefs.visible;
  }

  closeOverlay(): void {
    this.#howToPlay.visible = false;
    this.#prefs.visible = false;
  }

  /** `M` can mute from anywhere, so the overlay cannot trust what it last drew. */
  syncPrefs(): void {
    this.#prefs.sync();
  }

  update(deltaMs: number): void {
    if (this.#wiggleMs <= 0) return;

    this.#wiggleMs = Math.max(0, this.#wiggleMs - deltaMs);
    const progress = this.#wiggleMs / WIGGLE_MS;
    const shake = Math.sin((1 - progress) * Math.PI * 8) * progress;

    this.#versusScratch.rotation = shake * 0.05;
    this.#versusScratch.y = this.#scratchHome.y + shake * 5;
  }

  #open(overlay: Container): void {
    this.closeOverlay();
    overlay.visible = true;
  }

  #title(): Container {
    const group = new Container();

    const rogue = new Text({ text: 'ROGUE', style: title(168) });
    rogue.anchor.set(0.5);
    rogue.position.set(VIRTUAL_WIDTH / 2, 195);

    const rest = new Text({ text: 'PAPER SCISSORS', style: title(124) });
    rest.anchor.set(0.5);
    rest.position.set(VIRTUAL_WIDTH / 2, 330);

    const underline = squiggle(rest.width + 40, { amplitude: 8, waves: 5 });
    underline.position.set(VIRTUAL_WIDTH / 2 - (rest.width + 40) / 2, 400);

    group.addChild(rogue, rest, underline);
    return group;
  }

  #button(label: string, index: number, onTap: () => void, inert = false): Button {
    const button = new Button(label, BUTTON.width, BUTTON.height, onTap, {
      fontSize: BUTTON.fontSize,
      inert,
    });

    button.position.set(VIRTUAL_WIDTH / 2, FIRST_BUTTON_Y + index * BUTTON_GAP);
    button.on('pointerover', () => this.#audio.play('hover'));

    this.#buttons.addChild(button);
    return button;
  }
}
