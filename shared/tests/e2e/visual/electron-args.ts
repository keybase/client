// Chromium switches for visual runs (launch-app.mts --visual), so a capture depends only on what is
// on screen, not on the display, GPU, or what the app drew earlier in its life:
//   --disable-gpu               GPU raster decodes a downscaled image differently once the same
//                               image has been drawn at another size, for the life of the process
//   --disable-partial-raster    software raster re-rasters only the invalidated part of a tile; the
//                               anti-aliased edge of the nav avatar's ring then depends on which
//                               screen invalidated it last
//   --force-color-profile=srgb  otherwise every pixel is converted to the display's color profile
export const VISUAL_ELECTRON_ARGS: ReadonlyArray<string> = [
  '--disable-gpu',
  '--disable-partial-raster',
  '--force-color-profile=srgb',
]
