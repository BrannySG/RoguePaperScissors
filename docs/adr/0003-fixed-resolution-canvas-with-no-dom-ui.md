# Fixed 1920x1080 canvas, no DOM UI

The game is authored at exactly 1920x1080 and uniformly scaled to fit the window with letterbox bars. There are no breakpoints, no responsive reflow, and no HTML UI outside the canvas — menus, buttons and text are all rendered in Pixi.

This is deliberate and not an oversight. The prototype is aimed at eventually feeling like a desktop game rather than a web page, with a Tauri or Electron wrap as a plausible destination, so the layout model is a game's (one design resolution, scale to fit) rather than a document's. It also makes mockup coordinates literal, which removes an entire category of layout work: card fan positions are arc maths in a fixed space rather than flexbox being argued into a curve.

Developer tooling is exempt. The RuleSet panel in `src/dev/panel.ts` is plain DOM, because rebuilding a form with twenty fields in Pixi would cost more than the tool is worth. It is mounted only under `import.meta.env.DEV` and is absent from production builds, so the no-DOM rule still holds for anything a player can see.

## Consequences

Mobile is not supported and will not be by tweaking this — a phone would need a separately designed portrait layout, not a reflow of this one. Accessibility is materially worse than an HTML UI would be, since Pixi's shadow-DOM accessibility layer is far weaker than real semantic markup; this is an accepted cost of the desktop-game target, not an omission to be patched later. We also forgo `@pixi/layout`, which would otherwise be the natural choice, because absolute coordinates in a fixed space are simpler than a flexbox engine once nothing needs to reflow.
