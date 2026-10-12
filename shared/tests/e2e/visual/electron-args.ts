// Chromium switches for visual runs (launch-app.mts --visual), so a capture depends only on what is
// on screen, not on the display, GPU, or what the app drew earlier in its life:
//   --disable-gpu               GPU raster decodes a downscaled image differently once the same
//                               image has been drawn at another size, for the life of the process
//   --disable-partial-raster    software raster re-rasters only the invalidated part of a tile; the
//                               anti-aliased edge of the nav avatar's ring then depends on which
//                               screen invalidated it last
//   --force-color-profile=srgb  otherwise every pixel is converted to the display's color profile
export const VISUAL_CAPTURE_ARGS: ReadonlyArray<string> = [
  '--disable-gpu',
  '--disable-partial-raster',
  '--force-color-profile=srgb',
]
// One more for the app (desktop/app/main-window.desktop.tsx), which captures don't depend on, so a
// base tree from before it still captures: its window's content area matches the emulated
// viewport, and a person watching a run sees what is captured.
export const VISUAL_VIEWPORT = {height: 800, width: 1280}
export const VISUAL_ELECTRON_ARGS: ReadonlyArray<string> = [
  ...VISUAL_CAPTURE_ARGS,
  `--kb-visual-content-size=${VISUAL_VIEWPORT.width}x${VISUAL_VIEWPORT.height}`,
]
