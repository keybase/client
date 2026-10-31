// Which on-screen element is a header button the app measured, for escapeToTabs' stacked-modal
// fallback (helpers/navigate.ts).
export type Rect = {height: number; width: number; x: number; y: number}

// The header band a modal's dismiss button sits in, from the top of the screen.
export const HEADER_BAND = 200

const near = (a: number, b: number) => Math.abs(a - b) <= 1

export const onScreen = (r: Rect, screen: {height: number; width: number}) =>
  r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x + r.width <= screen.width && r.y + r.height <= screen.height

// The index of the one element whose frame is the app-measured button's, placed on screen: the same
// size and left edge (a modal's window is offset down from the screen, never across), and its top at
// the measured top plus `windowTop`, the screen y of the modal window's top (its navigation bar's top).
// Wholly on screen and in the header band; the measured frame (in the modal's window) must be on
// screen too. undefined unless exactly one element qualifies.
export const measuredButtonAmong = (
  measured: Rect,
  elements: ReadonlyArray<Rect>,
  screen: {height: number; width: number},
  windowTop: number
) => {
  if (!onScreen(measured, screen)) return undefined
  const at = elements.flatMap((e, i) =>
    near(e.width, measured.width) &&
    near(e.height, measured.height) &&
    // the same left edge assumes full-width modals: the gate runs on iPhone only
    near(e.x, measured.x) &&
    near(e.y, measured.y + windowTop) &&
    onScreen(e, screen) &&
    e.y + e.height <= HEADER_BAND
      ? [i]
      : []
  )
  return at.length === 1 ? at[0] : undefined
}
