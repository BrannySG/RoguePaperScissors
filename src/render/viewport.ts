import { Application, Container, Graphics } from 'pixi.js';
import { PAPER } from './theme.ts';

export const VIRTUAL_WIDTH = 1920;
export const VIRTUAL_HEIGHT = 1080;

export interface Viewport {
  app: Application;
  /** Everything is authored in a fixed 1920x1080 space and added here. */
  root: Container;
}

/**
 * Fixed-resolution stage. The game is authored at exactly 1920x1080 and the
 * whole scene is uniformly scaled to fit the window with letterbox bars, so
 * nothing reflows and mockup coordinates are literal. See docs/adr/0003.
 */
export async function createViewport(mount: HTMLElement): Promise<Viewport> {
  const app = new Application();

  await app.init({
    background: 0x000000,
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  mount.appendChild(app.canvas);

  const root = new Container();
  root.addChild(new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(PAPER));

  const frame = new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill(PAPER);
  root.mask = frame;

  app.stage.addChild(root, frame);

  const layout = (): void => {
    const scale = Math.min(
      app.screen.width / VIRTUAL_WIDTH,
      app.screen.height / VIRTUAL_HEIGHT,
    );
    const x = Math.round((app.screen.width - VIRTUAL_WIDTH * scale) / 2);
    const y = Math.round((app.screen.height - VIRTUAL_HEIGHT * scale) / 2);

    for (const node of [root, frame]) {
      node.scale.set(scale);
      node.position.set(x, y);
    }
  };

  layout();
  app.renderer.on('resize', layout);

  return { app, root };
}
