# The Boil is one displacement pass, not sketched geometry

Everything on screen is drawn rather than illustrated, and stillness was the giveaway — flat vector shapes read as a diagram until the lines move. The **Boil** answers that with a single `DisplacementFilter` over the whole `root` in `src/render/boil.ts`, driven by a generated noise lattice that jumps to a fresh offset eight times a second. Nothing that draws knows it exists.

The obvious implementation was the opposite one: rebuild each `Graphics` path per frame with a fresh seed, so the vector points themselves move. That is how hand-drawn boil actually works, and it is the approach `src/render/cardView.ts` was written against. It was rejected because Pixi rasterises `Text` into a texture. Every card name, every HP number and the 300px countdown would have sat perfectly still while the shapes around them squirmed, and a screen where only the text is frozen reads as broken rather than as hand-drawn. A screen-space pass gets the type and the linework with the same code.

Displacing pixels rather than points is normally a poor imitation, because warping empty space betrays the trick. It does not here, and the reason is specific to this game: the background is a flat `PAPER` fill, and warping uniform white is invisible. The only pixels where the offset can be seen are the ones carrying ink. The art direction is what makes the cheap technique look like the expensive one, so this reasoning does not survive a background texture, a gradient, or any imported artwork.

Eight frames a second is load-bearing, not a performance figure — the pass runs every rendered frame either way. Advancing the offset smoothly produces heat haze; holding each offset for 125ms produces a hand redrawing the same shape. Offsets are drawn fresh each beat rather than cycled, because a repeating three-frame loop lasts 375ms and turns into a visible pulse on a screen where nothing else is moving.

## Consequences

Amplitude is capped at half a virtual pixel, and that ceiling is doing real work: Pixi hit-tests pointers against the unwarped display list, so what a button looks like and where it can be clicked diverge by exactly the peak displacement. At half a pixel against a 300x74 button this is imperceptible. Raising it far would eventually need the input layer to learn about the Boil, which is the point at which this design stops being free.

The noise wavelength matters more than the amplitude, and in a way that is easy to get backwards. The first pass used 80 virtual pixels per cell, which is wider than a glyph and far wider than a stroke, so every detail on screen sat inside a single cell and was displaced uniformly — the image slid about in patches instead of its lines bending. Cells have to stay near the scale of the smallest thing that should deform, a few times the stroke width, and turning the amplitude down does not substitute for getting that wrong. The two move together: their ratio sets how ragged a line looks, while their absolute size sets how much motion there is and how much of the screen shares it.

The filter displaces by a count of render-target pixels, so the amplitude has to be re-derived from `root.scale` and the renderer resolution whenever the letterbox is laid out again. Left fixed it would silently weaken on large or high-density displays.

`Prefs` widened from audio to presentation generally to hold the switch, which meant lifting the stored blob out of `src/audio/` into `src/prefs.ts` and giving it a single owner. The audio bus had been keeping its own copy and writing the whole thing back on every change, which would have reverted the Boil setting the next time a player touched a volume slider.
