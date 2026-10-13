import type * as Styles from '@/styles'

// Popups are placed with CSS anchor positioning: the popup is in the top layer and the browser keeps
// it on its anchor through scrolling and layout changes. The browser tries the base position, then
// the @position-try options in order, and keeps the first that fits in the viewport.
//
// Each option pins the popup's box exactly, so "fits" means the whole popup is in the viewport, and
// that needs the popup's own size, which CSS can't read from inside the popup's insets: the
// positioner measures it into widthVar/heightVar.
//
// Chromium tries at most five options, fewer than the nine positions a popup may try, so runs of
// positions that share an axis are merged into one option that picks the first of them that fits.
// The browser goes back to the base when nothing fits, so the last option is the last position
// pushed back into the viewport, which always fits.

export const offsetVar = '--kb-popup-offset'
export const widthVar = '--kb-popup-width'
export const heightVar = '--kb-popup-height'
// where a popup whose anchor is not rendered stays (data-held), in px from the viewport
export const heldLeftVar = '--kb-popup-held-left'
export const heldTopVar = '--kb-popup-held-top'
export const heldWidthVar = '--kb-popup-held-width'

const offset = `var(${offsetVar}, 0px)`
// Text in a popup with no width of its own wraps at the window's width, less the gap the last
// position pushed into the window keeps on each side, so it always fits.
export const popupMaxWidth = `calc(100% - 4 * ${offset})`
const width = `var(${widthVar}, 0px)`
const height = `var(${heightVar}, 0px)`
// the gap between the anchor and a popup beside it ('left center', 'right center')
const sideGap = '8px'
// rounding slack, so a popup touching the viewport's edge still fits
const slack = '0.5px'

export const allPositions: ReadonlyArray<Styles.Position> = [
  'top left',
  'top right',
  'bottom right',
  'bottom left',
  'right center',
  'left center',
  'top center',
  'bottom center',
  'center center',
]

export type Placement = {
  top: string
  right: string
  bottom: string
  left: string
  justifySelf: string
  alignSelf: string
  width: string
}

type HorizontalKind = 'left' | 'right' | 'besideRight' | 'besideLeft' | 'center' | 'stretch'
type VerticalKind = 'top' | 'bottom' | 'center'

const horizontalKind = (position: Styles.Position, matchDimension: boolean): HorizontalKind => {
  const beside = !position.includes('top') && !position.includes('bottom') && !matchDimension
  if (position.includes('right')) {
    return beside ? 'besideRight' : 'right'
  }
  if (position.includes('left')) {
    return beside ? 'besideLeft' : 'left'
  }
  return matchDimension ? 'stretch' : 'center'
}

const verticalKind = (position: Styles.Position): VerticalKind => {
  if (position.includes('top')) {
    return 'top'
  }
  return position.includes('bottom') ? 'bottom' : 'center'
}

const round = (length: string) => `round(${length}, 1px)`

// anchor() measures from the side of the property it is in, so an inset on the end side has to
// turn it back into a distance from the start
type AnchorEdge = (side: 'left' | 'right' | 'top' | 'bottom' | 'center') => string
const fromStart: AnchorEdge = side => `anchor(${side})`
const fromEnd: AnchorEdge = side => `(100% - anchor(${side}))`

// where the popup's left edge goes
const leftEdge = (kind: Exclude<HorizontalKind, 'stretch'>, anchor: AnchorEdge) => {
  switch (kind) {
    case 'left':
      return round(`${anchor('left')} + ${offset}`)
    case 'right':
      return `${round(`${anchor('right')} - ${offset}`)} - ${width}`
    case 'besideRight':
      return `${round(`${anchor('right')} - ${offset}`)} + ${sideGap}`
    case 'besideLeft':
      return `${round(`${anchor('left')} + ${offset}`)} - ${width} - ${sideGap}`
    case 'center':
      return round(`${anchor('center')} - ${width} / 2`)
  }
}

// where the popup's top edge goes
const topEdge = (kind: VerticalKind, anchor: AnchorEdge) => {
  switch (kind) {
    case 'top':
      return `${round(`${anchor('top')} + ${offset}`)} - ${height}`
    case 'bottom':
      return round(`${anchor('bottom')} - ${offset}`)
    case 'center':
      return round(`${anchor('center')} - ${height} / 2`)
  }
}

// 1 when a popup of this size starting at this edge is inside the viewport, else 0
const fitsAt = (edge: string, size: string) =>
  `(1 - max(0, sign(-${slack} - (${edge})))) * (1 - max(0, sign(${edge} + ${size} - 100% - ${slack})))`

// the first of these edges where the popup fits, or the last one
const firstFitting = (edges: ReadonlyArray<string>, last: string, size: string) =>
  edges.reduceRight((rest, edge) => {
    const fits = fitsAt(edge, size)
    return `${fits} * (${edge}) + (1 - ${fits}) * (${rest})`
  }, last)

// A popup crossing the viewport's start edge moves to twice the offset inside it; one crossing
// the end edge moves to end twice the offset inside it.
const pushed = (edge: string, size: string) => {
  const under = `max(0, sign(-1 * (${edge})))`
  const over = `max(0, sign(${edge} + ${size} - 100%))`
  const inset = `2 * ${offset}`
  return `${under} * ${inset} + (1 - ${under}) * (${over} * (100% - ${size} - ${inset}) + (1 - ${over}) * (${edge}))`
}

// Insets that leave exactly the popup's box, so it only fits when it is inside the viewport
const pinned = (edgeAt: (anchor: AnchorEdge) => ReadonlyArray<string>, size: string, push: boolean) => {
  const edge = (anchor: AnchorEdge) => {
    const edges = [...new Set(edgeAt(anchor))]
    const last = edges.pop()
    if (last === undefined) {
      throw new Error('pinned needs an edge')
    }
    return push ? pushed(last, size) : firstFitting(edges, last, size)
  }
  return {
    end: `calc(max(0px, 100% - (${edge(fromEnd)}) - ${size}) - ${slack})`,
    start: `max(0px, calc(${edge(fromStart)}))`,
  }
}

type Option = {
  name: string
  placement: Placement
}

const slug = (position: Styles.Position) => position.replace(' ', '-')

const makeOption = (
  positions: ReadonlyArray<Styles.Position>,
  matchDimension: boolean,
  push: boolean
): Option => {
  const hKinds = positions.map(p => horizontalKind(p, matchDimension))
  const vertical = pinned(anchor => positions.map(p => topEdge(verticalKind(p), anchor)), height, push)
  const name = `--kb-popup-${positions.map(slug).join('_')}${matchDimension ? '-match' : ''}${push ? '-pushed' : ''}`
  if (hKinds.includes('stretch')) {
    // a popup matching its anchor's width spans the anchor, whatever its margins
    return {
      name,
      placement: {
        alignSelf: 'start',
        bottom: vertical.end,
        justifySelf: 'normal',
        left: 'anchor(left)',
        right: 'anchor(right)',
        top: vertical.start,
        width: 'auto',
      },
    }
  }
  const horizontal = pinned(
    anchor => hKinds.map(k => leftEdge(k as Exclude<HorizontalKind, 'stretch'>, anchor)),
    width,
    push
  )
  return {
    name,
    placement: {
      alignSelf: 'start',
      bottom: vertical.end,
      justifySelf: 'start',
      left: horizontal.start,
      right: horizontal.end,
      top: vertical.start,
      width: 'max-content',
    },
  }
}

// Runs of positions that share where they put the popup on one axis, so one option can try them
// all in order along the other axis
const shareAnAxis = (
  run: ReadonlyArray<Styles.Position>,
  next: Styles.Position,
  matchDimension: boolean
) => {
  const all = [...run, next]
  const hKinds = new Set(all.map(p => horizontalKind(p, matchDimension)))
  const vKinds = new Set(all.map(verticalKind))
  return hKinds.size === 1 || (vKinds.size === 1 && !hKinds.has('stretch'))
}

const runsOf = (positions: ReadonlyArray<Styles.Position>, matchDimension: boolean) =>
  positions.reduce<Array<Array<Styles.Position>>>((runs, position) => {
    const run = runs.at(-1)
    if (run && shareAnAxis(run, position, matchDimension)) {
      run.push(position)
    } else {
      runs.push([position])
    }
    return runs
  }, [])

const placementCSS = (p: Placement) =>
  `top: ${p.top}; right: ${p.right}; bottom: ${p.bottom}; left: ${p.left}; ` +
  `justify-self: ${p.justifySelf}; align-self: ${p.alignSelf}; width: ${p.width};`

export type PopupPlacement = {
  base: Placement
  // the position-try-fallbacks value
  tryOptions: string
  // the @position-try rules it names
  rules: string
}

const computePlacement = (
  position: Styles.Position,
  matchDimension: boolean,
  positionFallbacks: ReadonlyArray<Styles.Position> | undefined
): PopupPlacement => {
  const fallbacks = positionFallbacks ?? allPositions
  const last = fallbacks.at(-1) ?? position
  const runs = runsOf(fallbacks, matchDimension)
  // the pushed last position is the last position itself whenever that fits
  if (runs.at(-1)?.length === 1) {
    runs.pop()
  }
  const options = [
    ...runs.map(run => makeOption(run, matchDimension, false)),
    makeOption([last], matchDimension, true),
  ]
  return {
    base: makeOption([position], matchDimension, false).placement,
    rules: options.map(o => `@position-try ${o.name} { ${placementCSS(o.placement)} }`).join('\n'),
    tryOptions: options.map(o => o.name).join(', '),
  }
}

// a handful of position lists are ever used, so every placement is built once
const placements = new Map<string, PopupPlacement>()

// With no fallbacks given every position is tried.
export const popupPlacement = (
  position: Styles.Position,
  matchDimension: boolean,
  positionFallbacks: ReadonlyArray<Styles.Position> | undefined
): PopupPlacement => {
  const key = `${position}|${matchDimension}|${positionFallbacks?.join(',') ?? '*'}`
  let placement = placements.get(key)
  if (!placement) {
    placement = computePlacement(position, matchDimension, positionFallbacks)
    placements.set(key, placement)
  }
  return placement
}
