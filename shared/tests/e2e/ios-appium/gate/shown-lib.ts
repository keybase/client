// What "shown" means for an element. XCUITest's `visible` says it, except on an iPhone Duo unfolded or
// in a Split View: there the app reports a portrait frame that its landscape window does not share, and
// every element of the app's own content reads visible=false (the floating tab bar alone, in its own
// overlay, reads true). There an element is shown when its frame starts inside the window, which the
// run records once the posture is set (KB_IOS_FRAME_SHOWN, "<width>x<height>"). It can count an element
// of a screen covered by another one as shown, which XCUITest's own flag would not.
import type {ChainablePromiseElement} from 'webdriverio'
import {sourceRect} from './page-source-lib.ts'

export const FRAME_SHOWN_VAR = 'KB_IOS_FRAME_SHOWN'

type Size = {height: number; width: number}
type Rect = Size & {x: number; y: number}

const frameWindow = (): Size | undefined => {
  const m = /^(\d+)x(\d+)$/.exec(process.env[FRAME_SHOWN_VAR] ?? '')
  return m ? {height: Number(m[2]), width: Number(m[1])} : undefined
}

// Records that this run reads "shown" off frames, inside a window of `size`.
export const recordFrameShown = (size: Size) => {
  process.env[FRAME_SHOWN_VAR] = `${Math.round(size.width)}x${Math.round(size.height)}`
}

const frameIn = (r: Rect, w: Size) => r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x < w.width && r.y < w.height

// Whether an element with frame `r` and XCUITest flag `visible` is shown.
export const isShown = (r: Rect, visible: boolean) => {
  const w = frameWindow()
  return w ? frameIn(r, w) : visible
}

// isShown for a page-source element's attributes.
export const shownAttrs = (attrs: Record<string, string | undefined>) =>
  isShown(sourceRect(attrs as Record<string, string>), attrs['visible'] === 'true')

// The predicate clause for "shown", to AND into an -ios predicate string.
export const SHOWN = () => {
  const w = frameWindow()
  return w
    ? `(rect.width > 0 AND rect.height > 0 AND rect.x >= 0 AND rect.y >= 0 AND rect.x < ${w.width} AND rect.y < ${w.height})`
    : 'visible == 1'
}

// isShown for a live element. Bound: its reads 1.
export const elementShown = async (e: WebdriverIO.Element) => {
  if (!frameWindow()) return (await e.getAttribute('visible').catch(() => null)) === 'true'
  const r = await browser.getElementRect(e.elementId).catch(() => undefined)
  return !!r && isShown(r, false)
}

// elementShown for what `find` finds, false when it finds nothing. Bound: its reads 2.
export const shownNow = async (find: ChainablePromiseElement) =>
  (await find.isExisting().catch(() => false)) && elementShown(await find.getElement())
