// measures text off-screen via canvas, which matches browser layout for single-line text.
// fonts are preloaded before first render (see desktop/renderer/main2.desktop.tsx) so
// measurements always reflect the real fonts
let measureCtx: CanvasRenderingContext2D | null = null
export const measureTextWidth = (text: string, font: string): number => {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return 0
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

// largest font size in [minSize, maxSize] where text fits maxWidth; minSize if none fit
export const fitFontSize = (
  text: string,
  p: {maxWidth: number; maxSize: number; minSize: number; fontForSize: (size: number) => string}
): number => {
  for (let size = p.maxSize; size > p.minSize; size--) {
    if (measureTextWidth(text, p.fontForSize(size)) <= p.maxWidth) return size
  }
  return p.minSize
}
