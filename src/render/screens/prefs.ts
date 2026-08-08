import { Container, Graphics, Text } from 'pixi.js';
import type { AudioBus } from '../../audio/bus.ts';
import { Button } from '../button.ts';
import { squiggle } from '../ink.ts';
import { Slider } from '../slider.ts';
import { body, MUTED, PAPER, title } from '../theme.ts';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../viewport.ts';

const TRACK_WIDTH = 520;
const TRACK_X = 760;

/**
 * The player's own audio choices. The RuleSet is not here and never will be —
 * that is tuning, lives in the dev panel, and changes how a Fight plays.
 */
export class PrefsOverlay extends Container {
  #audio: AudioBus;
  #music: Slider;
  #sfx: Slider;
  #musicReadout: Text;
  #sfxReadout: Text;
  #mute: Button;

  constructor(audio: AudioBus, onBack: () => void) {
    super();
    this.#audio = audio;

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

    this.#mute = new Button('', 300, 74, () => {
      this.#audio.muted = !this.#audio.muted;
      this.sync();
    }, { fontSize: 30 });
    this.#mute.position.set(VIRTUAL_WIDTH / 2, 720);

    const back = new Button('BACK', 240, 74, onBack, { fontSize: 30 });
    back.position.set(VIRTUAL_WIDTH / 2, 900);

    this.addChild(this.#mute, back);
    this.sync();
  }

  /** Pulls the displayed values back from the bus, which `M` can change behind us. */
  sync(): void {
    this.#music.value = this.#audio.musicVolume;
    this.#sfx.value = this.#audio.sfxVolume;
    this.#mute.setLabel(this.#audio.muted ? 'UNMUTE' : 'MUTE');
    this.#readouts();
  }

  #readouts(): void {
    this.#musicReadout.text = percent(this.#audio.musicVolume);
    this.#sfxReadout.text = percent(this.#audio.sfxVolume);
  }

  #row(label: string, slider: Slider, y: number): Text {
    const name = new Text({ text: label, style: title(34) });
    name.anchor.set(1, 0.5);
    name.position.set(TRACK_X - 60, y);

    slider.position.set(TRACK_X, y);

    const readout = new Text({ text: '', style: body(28, '700', MUTED) });
    readout.anchor.set(0, 0.5);
    readout.position.set(TRACK_X + TRACK_WIDTH + 50, y);

    this.addChild(name, slider, readout);
    return readout;
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
