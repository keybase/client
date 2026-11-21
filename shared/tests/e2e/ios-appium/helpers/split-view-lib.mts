// Reading an iPhone Duo inner-screen screenshot (3x PNG, interface points) for the Split View setup in
// split-view.mts: where the app's Home Screen icon is, where its icon menu's "Open in Split View" row
// is, and where the dock's blue (Safari) icon is. Each answers undefined rather than guess, so the
// setup touches nothing it has not found.
export type Img = {width: number; height: number; data: Buffer | Uint8Array}
export type Point = {x: number; y: number}

const SCALE = 3

const rgbAt = (img: Img, px: number, py: number): [number, number, number] => {
  const i = (Math.round(py) * img.width + Math.round(px)) * 4
  return [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0]
}

// A score below this is the icon (measured 27 on a full Home Screen, 39 on a half one; 255 with none)
const ICON_MATCH = 80
// screenshot pixels per sample; the icon is drawn 55-70pt (165-210px) square
const STEP = 6
const ICON_SIZES_PX = [165, 180, 195, 210]

// The center (points) of `icon` (the app icon image) on the screen, by the least mean color distance
// over the icon's inner 70% (the corners are masked off on the Home Screen), or undefined.
export const findIcon = (screen: Img, icon: Img): Point | undefined => {
  const sw = Math.floor(screen.width / STEP)
  const sh = Math.floor(screen.height / STEP)
  const samples = new Float32Array(sw * sh * 3)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) samples.set(rgbAt(screen, x * STEP + STEP / 2, y * STEP + STEP / 2), (y * sw + x) * 3)
  }
  let best = {score: Infinity, x: 0, y: 0}
  for (const sizePx of ICON_SIZES_PX) {
    const n = Math.round(sizePx / STEP)
    const lo = Math.round(n * 0.15)
    const hi = Math.round(n * 0.85)
    const tmpl: Array<[number, number, [number, number, number]]> = []
    for (let ty = lo; ty < hi; ty++) {
      for (let tx = lo; tx < hi; tx++) {
        tmpl.push([tx, ty, rgbAt(icon, Math.floor(((tx + 0.5) / n) * icon.width), Math.floor(((ty + 0.5) / n) * icon.height))])
      }
    }
    for (let y = 0; y + n < sh; y++) {
      for (let x = 0; x + n < sw; x++) {
        let sum = 0
        const cap = best.score * tmpl.length
        for (const [tx, ty, c] of tmpl) {
          const k = ((y + ty) * sw + x + tx) * 3
          sum += Math.abs(samples[k]! - c[0]) + Math.abs(samples[k + 1]! - c[1]) + Math.abs(samples[k + 2]! - c[2])
          if (sum > cap) break
        }
        const score = sum / tmpl.length
        if (score < best.score) best = {score, x: ((x + n / 2) * STEP) / SCALE, y: ((y + n / 2) * STEP) / SCALE}
      }
    }
  }
  return best.score < ICON_MATCH ? {x: Math.round(best.x), y: Math.round(best.y)} : undefined
}

type Band = {dark: number; light: number; red: number; redMinX: number}

// Counts of dark (text), light (menu card) and red (destructive text) samples in a 1pt-tall row
const bandAt = (img: Img, y: number, x0: number, x1: number): Band => {
  const b = {dark: 0, light: 0, red: 0, redMinX: Infinity}
  for (let x = Math.max(0, x0); x < Math.min(img.width / SCALE, x1); x += 1) {
    const [r, g, bl] = rgbAt(img, x * SCALE, y * SCALE)
    const l = (r + g + bl) / 3
    if (l > 200) b.light++
    if (l < 90) b.dark++
    if (r > 180 && g < 110 && bl < 110) {
      b.red++
      b.redMinX = Math.min(b.redMinX, x)
    }
  }
  return b
}

// Where "Open in Split View" sits in an icon menu: the app's own (Keybase) lists Edit Home Screen,
// Remove App, then Open in Split View; Safari's lists it first and Remove App last
export type MenuLayout = 'after-remove' | 'first'

type Run = {y0: number; y1: number; red: boolean}

// The rows of text on the menu card, top to bottom, in the column where its text starts
const textRuns = (screen: Img, top: number, bottom: number, x0: number, x1: number): Array<Run> => {
  const runs: Array<Run> = []
  let cur: Run | undefined
  for (let y = top; y <= bottom; y++) {
    const b = bandAt(screen, y, x0, x1)
    const text = b.red > 0 || b.dark >= (x1 - x0) * 0.08
    if (text) {
      cur ??= {red: false, y0: y, y1: y}
      cur.y1 = y
      cur.red ||= b.red > 0
    } else if (cur) {
      runs.push(cur)
      cur = undefined
    }
  }
  if (cur) runs.push(cur)
  // a run a few points tall is a stray stroke, not a row of text
  return runs.filter(r => r.y1 - r.y0 >= 4)
}

const ROW_TEXT_INSET = 40
const ROW_SPAN = 150
// The card's top edge: the first row near the icon that is almost all light (the card's glass)
const CARD_TOP_LIGHT = 0.8

// Mean color change of a region between two screenshots
const changeIn = (a: Img, b: Img, x0: number, x1: number, y0: number, y1: number) => {
  let n = 0
  let sum = 0
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = rgbAt(a, x * SCALE, y * SCALE)
      const q = rgbAt(b, x * SCALE, y * SCALE)
      sum += (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2])) / 3
      n++
    }
  }
  return n ? sum / n : 0
}
// a menu opened over the row changes it at least this much on average (a card over wallpaper or icons)
const MENU_CHANGE = 25

// The "Open in Split View" row of the icon menu opened near `icon` (points) in `screen`, taken after
// the long-press that `before` was taken just before, or undefined unless it is unmistakable: the red
// Remove App row anchors the menu's text column, the card's light top edge bounds it, the row chosen
// by `layout` holds no red (a misread never taps Remove App), and the row changed since `before` (the
// menu opened there, not a Home Screen that happens to look like one).
export const findSplitViewRow = (screen: Img, icon: Point, layout: MenuLayout, before: Img): Point | undefined => {
  const height = screen.height / SCALE
  const x0 = icon.x - 380
  const x1 = icon.x + 160
  const rows: Array<{y: number; red: number; redMinX: number}> = []
  for (let y = Math.max(0, icon.y - 320); y < Math.min(height, icon.y + 360); y++) {
    const b = bandAt(screen, y, x0, x1)
    if (b.red) rows.push({red: b.red, redMinX: b.redMinX, y})
  }
  const peak = rows.reduce<(typeof rows)[number] | undefined>((m, r) => (!m || r.red > m.red ? r : m), undefined)
  if (!peak || peak.red < 10) return undefined
  // the Remove App text: the unbroken run of red rows around the reddest (other red, such as an icon's,
  // is rows away); its leftmost pixel is where the menu's text starts
  const red = [peak]
  const byY = new Map(rows.map(r => [r.y, r]))
  for (const dir of [-1, 1]) {
    for (let y = peak.y + dir; byY.has(y) && byY.get(y)!.red >= peak.red / 4; y += dir) red.push(byY.get(y)!)
  }
  const textX = Math.min(...red.map(r => r.redMinX))
  const cx0 = textX - 10
  const cx1 = textX + ROW_SPAN
  const redTop = Math.min(...red.map(r => r.y))
  let top: number | undefined
  for (let y = Math.max(0, redTop - 400); y < redTop; y++) {
    const b = bandAt(screen, y, cx0, cx1)
    if (b.light >= (cx1 - cx0) * CARD_TOP_LIGHT) {
      top = y
      break
    }
  }
  if (top === undefined) return undefined
  const runs = textRuns(screen, top, Math.min(height - 1, redTop + 120), cx0, cx1)
  const removeAt = runs.findIndex(r => r.red)
  if (removeAt < 0) return undefined
  const row = layout === 'first' ? runs[0] : runs[removeAt + 1]
  if (!row || row.red || row === runs[removeAt]) return undefined
  if (changeIn(before, screen, cx0, cx1, row.y0, row.y1) < MENU_CHANGE) return undefined
  return {x: textX + ROW_TEXT_INSET, y: Math.round((row.y0 + row.y1) / 2)}
}

// The dock sits at the inner screen's right edge in landscape; Safari is its blue icon
const DOCK_MIN_X = 860

// The center of the blue icon in the dock (Safari), or undefined
export const findBlueIcon = (screen: Img): Point | undefined => {
  const width = screen.width / SCALE
  const height = screen.height / SCALE
  let n = 0
  let sx = 0
  let sy = 0
  for (let y = 40; y < height - 40; y++) {
    for (let x = DOCK_MIN_X; x < width - 4; x++) {
      const [r, g, b] = rgbAt(screen, x * SCALE, y * SCALE)
      if (b > 180 && r < 110 && g < 170) {
        n++
        sx += x
        sy += y
      }
    }
  }
  return n > 150 ? {x: Math.round(sx / n), y: Math.round(sy / n)} : undefined
}

// A split inner screen has a black divider down its middle (measured: columns 470-480pt 93-100% black;
// under 10% on a full Home Screen)
export const hasSplitDivider = (screen: Img): boolean => {
  const width = screen.width / SCALE
  const height = screen.height / SCALE
  const mid = Math.round(width / 2)
  for (let x = mid - 10; x <= mid + 10; x++) {
    let dark = 0
    let n = 0
    for (let y = 0; y < height; y += 2) {
      const [r, g, b] = rgbAt(screen, x * SCALE, y * SCALE)
      if ((r + g + b) / 3 < 40) dark++
      n++
    }
    if (dark / n > 0.85) return true
  }
  return false
}

// Split View on the Duo halves the inner screen (469 of 951pt); full screen is the whole width
export const isSplitWidth = (appWidth: number, screenWidth: number) => appWidth < screenWidth * 0.6

export type Rotation = 'rot0' | 'rot90' | 'rot180' | 'rot270'

// An interface point (in a screen of `width`x`height` points as the interface sees it, rotated by
// `rotation`) as the 0-1 panel coordinates the touchscreen takes
export const nativePoint = (p: Point, d: {width: number; height: number; rotation: Rotation}) => {
  const u = p.x / d.width
  const v = p.y / d.height
  switch (d.rotation) {
    case 'rot90':
      return {u: v, v: 1 - u}
    case 'rot180':
      return {u: 1 - u, v: 1 - v}
    case 'rot270':
      return {u: 1 - v, v: u}
    case 'rot0':
      return {u, v}
  }
}
