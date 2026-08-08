import { Container, Graphics, Text } from 'pixi.js';
import type { AudioBus } from '../../audio/bus.ts';
import type { Boil } from '../boil.ts';
import { Button } from '../button.ts';
import { squiggle } from '../ink.ts';
import { Slider } from '../slider.ts';
import { body, MUTED, PAPER, title } from '../theme.ts';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../viewport.ts';

const TRACK_WIDTH = 520;
const TRACK_X = 760;

/**
 * The player's own presentation choices, audible and visible. The RuleSet is not
 * here and never will be — that is tuning, lives in the dev panel, and changes
 * how a Fight plays.
 */
export class PrefsOverlay extends Container {
  #audio: AudioBus;
  #boil: Boil;
  #music: Slider;
  #sfx: Slider;
  #musicReadout: Text;
  #sfxReadout: Text;
  #wobble: Button;
  #mute: Button;

  constructor(audio: AudioBus, boil: Boil, onBack: () => void) {
    super();
    this.#audio = audio;
    this.#boil = boil;

    this.addChild(
      new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(PAPER),
    );

    const heading = new Text({ text: 'SETTINGS', style: title(72) });
    heading.anchor.set(0.5);
    heading.position.set(VIRTUAL_WIDTH / 2, 200);

    const underline = squiggle(340, { amplitude: 6, waves: 5 });
    underline.position.set(VIRTUAL_WIDTH / 2 - 170, 258);

    this.addChild(heading, underline);

    this.#music = new Slider(TRACK_WIDTH, audio.musicVolume, (value) => {
      this.#audio.musicVolume = value;
      this.#readouts();
    });
    this.#musicReadout = this.#row('MUSIC', this.#music, 430);

    this.#sfx = new Slider(TRACK_WIDTH, audio.sfxVolume, (value) => {
      this.#audio.sfxVolume = value;
      this.#readouts();
    });
    this.#sfxReadout = this.#row('SOUND', this.#sfx, 560);

    this.#wobble = new Button('', 160, 68, () => {
      this.#boil.enabled = !this.#boil.enabled;
      this.sync();
    }, { fontSize: 30 });
    // Left edge on the slider tracks, since the Button is positioned by centre.
    this.#wobble.position.set(TRACK_X + 80, 690);
    this.#label('WOBBLE EFFECTS', 690);

    this.#mute = new Button('', 300, 74, () => {
      this.#audio.muted = !this.#audio.muted;
      this.sync();
    }, { fontSize: 30 });
    this.#mute.position.set(VIRTUAL_WIDTH / 2, 810);

    const back = new Button('BACK', 240, 74, onBack, { fontSize: 30 });
    back.position.set(VIRTUAL_WIDTH / 2, 940);

    this.addChild(this.#wobble, this.#mute, back);
    this.sync();
  }

  /** Pulls the displayed values back from the bus, which `M` can change behind us. */
  sync(): void {
    this.#music.value = this.#audio.musicVolume;
    this.#sfx.value = this.#audio.sfxVolume;
    this.#wobble.setLabel(this.#boil.enabled ? 'ON' : 'OFF');
    this.#mute.setLabel(this.#audio.muted ? 'UNMUTE' : 'MUTE');
    this.#readouts();
  }

  #readouts(): void {
    this.#musicReadout.text = percent(this.#audio.musicVolume);
    this.#sfxReadout.text = percent(this.#audio.sfxVolume);
  }

  #row(label: string, slider: Slider, y: number): Text {
    this.#label(label, y);
    slider.position.set(TRACK_X, y);

    const readout = new Text({ text: '', style: body(28, '700', MUTED) });
    readout.anchor.set(0, 0.5);
    readout.position.set(TRACK_X + TRACK_WIDTH + 50, y);

    this.addChild(slider, readout);
    return readout;
  }

  #label(label: string, y: number): void {
    const name = new Text({ text: label, style: title(34) });
    name.anchor.set(1, 0.5);
    name.position.set(TRACK_X - 60, y);
    this.addChild(name);
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
