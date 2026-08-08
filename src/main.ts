import { Shell } from './app/shell.ts';
import { loadFonts } from './render/fonts.ts';
import { createViewport } from './render/viewport.ts';

async function boot(): Promise<void> {
  // Fonts first: Pixi measures against the document font set, so any Text
  // built before they land rasterises in a fallback face.
  await loadFonts();

  const { app, root } = await createViewport(document.body);

  const shell = new Shell(app, root);
  void shell.start();

  if (import.meta.env.DEV) {
    const { mountDevPanel } = await import('./dev/panel.ts');
    mountDevPanel(shell);
  }
}

void boot();
