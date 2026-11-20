// W3C pointer actions on an iPhone Duo unfolded or in a Split View: there a pointer at screen points
// (or with the window as its origin) touches nothing, while XCUITest's gestures given relative to the
// window land (helpers/elements.ts tapAt). A run that reads frames (gate/shown-lib.ts) sends each
// one-pointer sequence as the window-relative gesture it makes instead (wdio.gate.conf.ts): no move
// between the press and the lift is a tap, or a hold when it stays down HOLD_MS or more, and a move is
// a press-drag from where it went down to where it lifted (a path through other points, such as a
// pan's overshoot, only ends there). Anything else (keys, two pointers) goes as written.

type Point = {x: number; y: number}
export type PointerAction = {
  duration?: number
  origin?: unknown
  type: string
  x?: number
  y?: number
}
export type ActionSource = {actions: ReadonlyArray<PointerAction>; id?: string; parameters?: {pointerType?: string}; type: string}

export type WindowGesture =
  | {at: Point; kind: 'tap'}
  | {at: Point; kind: 'hold'; seconds: number}
  | {from: Point; kind: 'drag'; press: number; to: Point}

const HOLD_MS = 500
// XCUITest's press before a drag: long enough to read as a press, short of a long press
const MIN_PRESS_S = 0.05

// What a move's origin is: the viewport (or none), the pointer's last point, or an element (its id).
const originOf = (o: unknown): 'viewport' | 'pointer' | {element: string} => {
  if (o === undefined || o === 'viewport') return 'viewport'
  if (o === 'pointer') return 'pointer'
  if (typeof o === 'object' && o !== null) {
    const id = Object.values(o as Record<string, unknown>).find(v => typeof v === 'string')
    if (typeof id === 'string') return {element: id}
  }
  throw new Error('a pointer move with an origin this harness does not read')
}

// The window-relative gestures `sources` make, given each element origin's middle in window points
// (`middles`, by element id); undefined when the sources are not one pointer's press-and-lift
// sequences (they go as written).
export const windowGestures = (
  sources: ReadonlyArray<ActionSource>,
  middles: ReadonlyMap<string, Point>
): Array<WindowGesture> | undefined => {
  const pointers = sources.filter(s => s.type === 'pointer')
  if (pointers.length !== 1 || sources.some(s => s.type !== 'pointer' && s.type !== 'none')) return undefined
  const out: Array<WindowGesture> = []
  let at: Point = {x: 0, y: 0}
  let down: {at: Point; moved: boolean; ms: number; pressMs: number} | undefined
  for (const a of pointers[0]!.actions) {
    if (a.type === 'pointerMove') {
      const o = originOf(a.origin)
      const x = a.x ?? 0
      const y = a.y ?? 0
      if (o === 'viewport') at = {x, y}
      else if (o === 'pointer') at = {x: at.x + x, y: at.y + y}
      else {
        const m = middles.get(o.element)
        if (!m) throw new Error('a pointer move from an element whose frame was not read')
        at = {x: m.x + x, y: m.y + y}
      }
      if (down && (at.x !== down.at.x || at.y !== down.at.y)) down.moved = true
      if (down) down.ms += a.duration ?? 0
    } else if (a.type === 'pointerDown') {
      down = {at, moved: false, ms: 0, pressMs: 0}
    } else if (a.type === 'pause') {
      if (down) {
        down.ms += a.duration ?? 0
        if (!down.moved) down.pressMs += a.duration ?? 0
      }
    } else if (a.type === 'pointerUp') {
      if (!down) continue
      if (down.moved) out.push({from: down.at, kind: 'drag', press: Math.max(MIN_PRESS_S, down.pressMs / 1000), to: at})
      else if (down.ms >= HOLD_MS) out.push({at: down.at, kind: 'hold', seconds: down.ms / 1000})
      else out.push({at: down.at, kind: 'tap'})
      down = undefined
    } else {
      return undefined
    }
  }
  // a press never lifted is left to go as written
  return down ? undefined : out
}

// The element ids the sources' moves are relative to.
export const originElements = (sources: ReadonlyArray<ActionSource>) =>
  [
    ...new Set(
      sources.flatMap(s =>
        s.actions.flatMap(a => {
          if (a.type !== 'pointerMove') return []
          try {
            const o = originOf(a.origin)
            return typeof o === 'object' ? [o.element] : []
          } catch {
            return []
          }
        })
      )
    ),
  ]
