import { Game } from './app/game.ts';
import { DEFAULT_RULESET } from './core/ruleset.ts';
import { loadFonts } from './render/fonts.ts';
import { createViewport } from './render/viewport.ts';

async function boot(): Promise<void> {
  // Fonts first: Pixi measures against the document font set, so any Text
  // built before they land rasterises in a fallback face.
  await loadFonts();

  const { app, root } = await createViewport(document.body);

  const game = new Game(app, root);
  game.start({ seed: Math.floor(Date.now() % 1_000_000), ruleSet: DEFAULT_RULESET });

  if (import.meta.env.DEV) {
    const { mountDevPanel } = await import('./dev/panel.ts');
    mountDevPanel(game);
  }
}

void boot();
