export const FONT_BODY = 'Shantell Sans';
export const FONT_DISPLAY = 'Permanent Marker';

const FACES: Array<{ family: string; url: string; descriptors: FontFaceDescriptors }> = [
  { family: FONT_BODY, url: '/fonts/ShantellSans.woff2', descriptors: { weight: '300 800' } },
  { family: FONT_DISPLAY, url: '/fonts/PermanentMarker.woff2', descriptors: { weight: '400' } },
];

/**
 * Registers the self-hosted faces with the document before any Pixi Text is
 * constructed. Pixi measures text against the document font set, so a Text
 * created before this resolves silently rasterises in a fallback face.
 */
export async function loadFonts(): Promise<void> {
  await Promise.all(
    FACES.map(async ({ family, url, descriptors }) => {
      const face = new FontFace(family, `url(${url}) format('woff2')`, descriptors);
      await face.load();
      document.fonts.add(face);
    }),
  );
  await document.fonts.ready;
}
