// Which coverage marks (src-mark.tsx) a capture shows: a Box2 / ClickableBox call site counts for a
// capture when one of its instances is drawn in the screenshot. The drivers run these functions in
// the app, on its React fiber tree, at the moment of the capture:
// - desktop: one of the mark's host elements is rendered (not display:none or visibility:hidden,
//   non-empty, its opacity times its ancestors' above 0), overlaps the viewport once clipped by the
//   ancestors that clip it, and is not covered by an opaque element at every sampled point of it;
// - phone: the mark's screen is the focused one, or it draws outside every screen (the overlays
//   and sheets over the navigator), and one of its host views has an opacity above 0 along its
//   views, overlaps the window once clipped by the scroll views and overflow:hidden views around it,
//   and is under no opaque full-window view (nativeVisibleSites says which).
// A site whose instances are all scrolled out of view, transparent or covered does not count: no
// pixel of it is compared. Where a rule cannot tell, it counts the site as not drawn: that only
// costs a restored prop, never a change no compare saw.
//
// Each function is sent to the app as its own source (inPage) and may call only the others here
// by name, so none may use anything else from module scope.

export type Fiber = {
  tag: number
  type?: unknown
  memoizedProps?: Record<string, unknown> | null
  stateNode?: unknown
  child?: Fiber | null
  sibling?: Fiber | null
  return?: Fiber | null
}
export type Box = {left: number; top: number; right: number; bottom: number}
type Navigation = {isFocused?: () => boolean}

// Every fiber in the subtrees of the roots (not their siblings'), root by root; stops at the first
// one visit returns true for.
export function walkFibers(roots: ReadonlyArray<Fiber>, visit: (f: Fiber) => boolean | undefined): void {
  for (const root of roots) {
    const stack = [root]
    while (stack.length) {
      const f = stack.pop()!
      if (visit(f) === true) return
      if (f.child) stack.push(f.child)
      if (f !== root && f.sibling) stack.push(f.sibling)
    }
  }
}

// The navigation of the screen f is drawn in: the nearest component above it that react-navigation
// hands a route and its navigation.
export function screenNavigation(f: Fiber): Navigation | undefined {
  for (let p = f.return; p; p = p.return) {
    const props = p.memoizedProps
    if (props?.['route'] && props['navigation']) return props['navigation'] as Navigation
  }
  return undefined
}

// 'focused': in the focused screen (navigation.isFocused also asks every navigator above it).
// 'hidden': in a hidden tab or a screen under the top one. 'overlay': outside every screen.
export function screenPlacement(f: Fiber): 'focused' | 'hidden' | 'overlay' {
  const nav = screenNavigation(f)
  if (!nav) return 'overlay'
  return nav.isFocused?.() ? 'focused' : 'hidden'
}

// The host fibers (tag 5: a DOM element, a native view) nearest under f, f itself if it is one:
// what f draws.
export function nearestHosts(f: Fiber): Array<Fiber> {
  const out: Array<Fiber> = []
  const stack = [f]
  while (stack.length) {
    const x = stack.pop()!
    if (x.tag === 5) out.push(x)
    else if (x.child) stack.push(x.child)
    if (x !== f && x.sibling) stack.push(x.sibling)
  }
  return out
}

export function overlaps(a: Box, b: Box): boolean {
  return Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
}

export function intersect(a: Box, b: Box): Box {
  return {bottom: Math.min(a.bottom, b.bottom), left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top)}
}

// The alpha of a color: a CSS string (computed or as written in a native style) or a processed
// native color (0xAARRGGBB). No color is 0; a form it does not know (a named or platform color)
// counts as opaque.
export function colorAlpha(c: unknown): number {
  if (c === undefined || c === null || c === 'transparent') return 0
  if (typeof c === 'number') return ((c >>> 24) & 255) / 255
  if (typeof c !== 'string') return 1
  const hex = /^#([0-9a-f]+)$/i.exec(c)?.[1]
  if (hex) {
    if (hex.length === 4) return parseInt(hex.slice(3), 16) / 15
    if (hex.length === 8) return parseInt(hex.slice(6), 16) / 255
    return 1
  }
  const args = /^[a-z-]+\((.*)\)$/i.exec(c.trim())?.[1]
  if (args === undefined) return 1
  const slash = args.split('/')
  const commas = args.split(',')
  const a = slash.length === 2 ? slash[1] : commas.length === 4 ? commas[3] : undefined
  if (a === undefined) return 1
  const v = parseFloat(a)
  if (Number.isNaN(v)) return 1
  return a.trim().endsWith('%') ? v / 100 : v
}

// The marks under the roots, and the ids of those `visible` accepts.
export function visibleSites(roots: ReadonlyArray<Fiber>, visible: (mark: Fiber) => boolean): {marks: number; ids: Array<string>} {
  const ids = new Set<string>()
  let marks = 0
  walkFibers(roots, f => {
    if (typeof f.type !== 'function' || (f.type as {__kbVisualSrcMark?: boolean}).__kbVisualSrcMark !== true) return
    marks++
    const id = f.memoizedProps?.['id']
    if (typeof id === 'string' && !ids.has(id) && visible(f)) ids.add(id)
  })
  return {ids: [...ids].sort(), marks}
}

// ---------------------------------------------------------------- desktop

export type DomStyle = {
  display: string
  visibility: string
  position: string
  overflowX: string
  overflowY: string
  opacity: string
  backgroundColor: string
}
export type DomNode = {parentElement: DomNode | null; children: ArrayLike<DomNode>; tagName?: string}
export type DomEnv = {
  style: (el: DomNode) => DomStyle
  rect: (el: DomNode) => Box
  // the elements at a viewport point, topmost first (document.elementsFromPoint)
  at: (x: number, y: number) => ArrayLike<DomNode>
  width: number
  height: number
}

// Whether el is inside (or is) ancestor.
export function within(el: DomNode, ancestor: DomNode): boolean {
  for (let p: DomNode | null = el; p; p = p.parentElement) if (p === ancestor) return true
  return false
}

// The share of el's paint that shows through its own opacity and every ancestor's.
export function domOpacity(el: DomNode, env: DomEnv): number {
  let o = 1
  for (let p: DomNode | null = el; p; p = p.parentElement) {
    const v = parseFloat(env.style(p).opacity)
    if (!Number.isNaN(v)) o *= v
  }
  return o
}

// Whether el hides what is drawn under it: an opaque background, an image or a video, at full
// opacity. A translucent backdrop (a modal's dim) hides nothing: the pixels under it still compare.
export function domOpaque(el: DomNode, env: DomEnv): boolean {
  const opaque = el.tagName === 'IMG' || el.tagName === 'VIDEO' || colorAlpha(env.style(el).backgroundColor) >= 1
  return opaque && domOpacity(el, env) >= 1
}

// Whether some sampled point of box (el's visible part: its centre and its corners inset 1px)
// shows el: among the elements hit there, topmost first, el comes before any opaque element that is
// not inside it. An element that takes no hits (pointer-events: none) is stood in for by its
// nearest ancestor that does, and anything opaque above that counts as above el. A point where
// neither is hit counts as covered.
export function domUncovered(el: DomNode, box: Box, env: DomEnv): boolean {
  const ix = Math.min(1, (box.right - box.left) / 2)
  const iy = Math.min(1, (box.bottom - box.top) / 2)
  const [l, r, t, b] = [box.left + ix, box.right - ix, box.top + iy, box.bottom - iy]
  const points = [[(box.left + box.right) / 2, (box.top + box.bottom) / 2], [l, t], [r, t], [l, b], [r, b]] as const
  return points.some(([x, y]) => {
    const hits = Array.from(env.at(x, y))
    let stop = hits.indexOf(el)
    if (stop < 0) stop = hits.findIndex(h => within(el, h))
    if (stop < 0) return false
    return !hits.slice(0, stop).some(h => !within(h, el) && domOpaque(h, env))
  })
}

// Whether an element draws in the viewport. An ancestor clips it only when it is in its containing
// block chain: an absolutely positioned element escapes static ancestors, a fixed one all of them.
export function domVisible(el: DomNode, env: DomEnv): boolean {
  const s = env.style(el)
  if (s.display === 'contents') return Array.from(el.children).some(c => domVisible(c, env))
  if (s.display === 'none' || s.visibility !== 'visible') return false
  const r = env.rect(el)
  if (!(r.right > r.left && r.bottom > r.top)) return false
  if (!(domOpacity(el, env) > 0)) return false
  let clip: Box = {bottom: env.height, left: 0, right: env.width, top: 0}
  let position = s.position
  for (let p = el.parentElement; p; p = p.parentElement) {
    const ps = env.style(p)
    if (ps.display === 'none') return false
    if (position === 'fixed' || (position === 'absolute' && ps.position === 'static')) continue
    position = ps.position
    if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue
    const pr = env.rect(p)
    clip = {
      bottom: ps.overflowY === 'visible' ? clip.bottom : Math.min(clip.bottom, pr.bottom),
      left: ps.overflowX === 'visible' ? clip.left : Math.max(clip.left, pr.left),
      right: ps.overflowX === 'visible' ? clip.right : Math.min(clip.right, pr.right),
      top: ps.overflowY === 'visible' ? clip.top : Math.max(clip.top, pr.top),
    }
  }
  return overlaps(r, clip) && domUncovered(el, intersect(r, clip), env)
}

// The current root fibers of the React roots rendered into these elements. React keeps the key on
// a container whose root it unmounted, set to null.
export function containerRoots(els: Iterable<object>): Array<Fiber> {
  const roots: Array<Fiber> = []
  for (const el of els) {
    for (const k of Object.keys(el)) {
      if (!k.startsWith('__reactContainer$')) continue
      const root = (el as Record<string, {stateNode?: {current?: Fiber | null} | null} | null | undefined>)[k]?.stateNode?.current
      if (root) roots.push(root)
    }
  }
  return roots
}

// ---------------------------------------------------------------- phone

export type NativeEnv = {rect: (host: Fiber) => Box | undefined; width: number; height: number}

// The value a style gives key: style arrays flattened, later entries winning, as RN flattens them.
export function styleValue(style: unknown, key: string): unknown {
  let v: unknown
  const read = (s: unknown) => {
    if (Array.isArray(s)) s.forEach(read)
    else if (s && typeof s === 'object' && key in s) v = (s as Record<string, unknown>)[key]
  }
  read(style)
  return v
}

// A host view that clips what it holds: a scroll view, or a view styled overflow hidden or scroll.
export function clipsChildren(f: Fiber): boolean {
  if (f.type === 'RCTScrollView') return true
  const overflow = styleValue(f.memoizedProps?.['style'], 'overflow')
  return overflow === 'hidden' || overflow === 'scroll'
}

// A host view's own opacity: its style's, read through an Animated value; 1 when it sets none.
export function viewOpacity(f: Fiber): number {
  let v = styleValue(f.memoizedProps?.['style'], 'opacity')
  if (v && typeof v === 'object' && typeof (v as {__getValue?: unknown}).__getValue === 'function') {
    v = (v as {__getValue: () => unknown}).__getValue()
  }
  return typeof v === 'number' ? v : 1
}

// The window, clipped by the views around host that clip.
export function nativeClip(host: Fiber, env: NativeEnv): Box {
  let clip: Box = {bottom: env.height, left: 0, right: env.width, top: 0}
  for (let p = host.return; p; p = p.return) {
    if (p.tag !== 5 || !clipsChildren(p)) continue
    const pr = env.rect(p)
    if (pr) clip = intersect(clip, pr)
  }
  return clip
}

// Whether a host view draws in the window, clipped by the views around it that clip.
export function nativeInWindow(host: Fiber, env: NativeEnv): boolean {
  const r = env.rect(host)
  if (!r || !(r.right > r.left && r.bottom > r.top)) return false
  return overlaps(r, nativeClip(host, env))
}

// Whether box shows all of r; along an axis where r is longer than box, whether r fills box there
// (as much of it as fits).
export function showsAll(r: Box, box: Box): boolean {
  const along = (a0: number, a1: number, b0: number, b1: number) => (a1 - a0 <= b1 - b0 ? a0 >= b0 && a1 <= b1 : a0 <= b0 && a1 >= b1)
  return along(r.left, r.right, box.left, box.right) && along(r.top, r.bottom, box.top, box.bottom)
}

// The ids of the marks a phone capture draws, and how many marks the walk met. One top-down walk
// carries each fiber's placement (the focused screen, or outside every screen; a hidden screen's
// subtree is skipped once any mark has been met), the opacity and clip of the views above it, and
// its layer. What paints over what, bottom first:
//   0. the app's root view: the navigator's screens and the views outside them;
//   1. natively presented modal screens (RNSModalScreen), over all of the root view;
//   2. FullWindowOverlay content (popups, sheets), a window of its own over everything.
// Within a layer a later view in tree order paints over an earlier one that does not hold it.
// A host view of a mark is drawn when its opacity along its views is above 0, it overlaps the
// window once clipped, and nothing covers it:
// - while the focused screen is a modal, nothing in layer 0 counts: a page sheet leaves a strip of
//   the dimmed root view at the top, but too little to count on;
// - a view outside every screen with an opaque background at full opacity that fills the window
//   covers every view under it (in a lower layer, or earlier in its layer and not its ancestor).
// Views of one screen covering others of the same screen are not modelled.
export function nativeVisibleSites(roots: ReadonlyArray<Fiber>, env: NativeEnv): {marks: number; ids: Array<string>} {
  type Ctx = {
    hidden: boolean
    inScreen: boolean
    modal: boolean
    layer: number
    opacity: number
    clip: Box
    marks: ReadonlyArray<string>
  }
  type Host = {f: Fiber; ids: ReadonlyArray<string>; order: number; layer: number; opacity: number; clip: Box; rect: Box | undefined}
  const win: Box = {bottom: env.height, left: 0, right: env.width, top: 0}
  const hosts: Array<Host> = []
  const covers: Array<Host> = []
  let marks = 0
  let order = 0
  let focusedInModal = false
  const start: Ctx = {clip: win, hidden: false, inScreen: false, layer: 0, marks: [], modal: false, opacity: 1}
  for (const root of roots) {
    const stack: Array<{f: Fiber; ctx: Ctx; top: boolean}> = [{ctx: start, f: root, top: true}]
    while (stack.length) {
      const {f, ctx, top} = stack.pop()!
      if (!top && f.sibling) stack.push({ctx, f: f.sibling, top: false})
      // a hidden screen's subtree is walked only until the walk has met a mark (the count says
      // whether the app has coverage marks at all)
      if (ctx.hidden && marks) continue
      let c = ctx
      const props = f.memoizedProps
      if (!c.hidden && props?.['route'] && props['navigation']) {
        // navigation.isFocused also asks every navigator above it
        if ((props['navigation'] as Navigation).isFocused?.()) {
          c = {...c, inScreen: true}
          if (c.modal) focusedInModal = true
        } else {
          c = {...c, hidden: true}
        }
      }
      if (typeof f.type === 'function' && (f.type as {__kbVisualSrcMark?: boolean}).__kbVisualSrcMark === true) {
        marks++
        const id = props?.['id']
        if (!c.hidden && typeof id === 'string') c = {...c, marks: [...c.marks, id]}
      }
      if (f.tag === 5 && !c.hidden) {
        let {clip, layer, modal, opacity} = c
        if (f.type === 'RNSFullWindowOverlay') {
          // moved into a window of its own: nothing above it in the tree clips it or fades it
          layer = 2
          clip = win
          opacity = 1
        } else if (f.type === 'RNSModalScreen' && layer < 1) {
          layer = 1
          modal = true
        }
        opacity *= viewOpacity(f)
        const rect = env.rect(f)
        const h: Host = {clip, f, ids: c.marks, layer, opacity, order: order++, rect}
        if (h.ids.length) hosts.push(h)
        const fills = !!rect && rect.left <= 0 && rect.top <= 0 && rect.right >= env.width && rect.bottom >= env.height
        const unclipped = clip.left <= 0 && clip.top <= 0 && clip.right >= env.width && clip.bottom >= env.height
        if (!c.inScreen && fills && unclipped && opacity >= 1 && colorAlpha(styleValue(props?.['style'], 'backgroundColor')) >= 1) {
          covers.push(h)
        }
        c = {...c, clip: rect && clipsChildren(f) ? intersect(clip, rect) : clip, layer, marks: [], modal, opacity}
      }
      if (f.child) stack.push({ctx: c, f: f.child, top: false})
    }
  }
  const holds = (outer: Fiber, inner: Fiber) => {
    for (let p = inner.return; p; p = p.return) if (p === outer) return true
    return false
  }
  const covered = (h: Host) =>
    (focusedInModal && h.layer === 0) ||
    covers.some(c => c !== h && (c.layer > h.layer || (c.layer === h.layer && c.order > h.order && !holds(h.f, c.f))))
  const ids = new Set<string>()
  for (const h of hosts) {
    if (h.ids.every(id => ids.has(id))) continue
    const r = h.rect
    if (!r || !(r.right > r.left && r.bottom > r.top) || !(h.opacity > 0) || !overlaps(r, h.clip) || covered(h)) continue
    for (const id of h.ids) ids.add(id)
  }
  return {ids: [...ids].sort(), marks}
}

// The functions as declarations for a script run in the app.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const inPage = (...fns: ReadonlyArray<Function>) => fns.map(f => `const ${f.name} = ${f.toString()};`).join('\n')

// Every function here, for a script that uses any of them.
export const VISIBLE_FUNCTIONS = inPage(
  walkFibers,
  screenNavigation,
  screenPlacement,
  nearestHosts,
  overlaps,
  intersect,
  colorAlpha,
  visibleSites,
  within,
  domOpacity,
  domOpaque,
  domUncovered,
  domVisible,
  containerRoots,
  styleValue,
  clipsChildren,
  viewOpacity,
  nativeClip,
  nativeInWindow,
  showsAll,
  nativeVisibleSites
)

// The ids a desktop window's capture shows, or null when the app has no coverage marks. React's
// roots are found from their container elements.
export const DESKTOP_VISIBLE_SITES = `(() => {
  ${VISIBLE_FUNCTIONS}
  const roots = containerRoots(document.querySelectorAll('*'))
  const styles = new Map()
  const rects = new Map()
  const hits = new Map()
  const env = {
    at: (x, y) => {
      const k = x + ',' + y
      if (!hits.has(k)) hits.set(k, document.elementsFromPoint(x, y))
      return hits.get(k)
    },
    height: innerHeight,
    rect: el => {
      if (!rects.has(el)) rects.set(el, el.getBoundingClientRect())
      return rects.get(el)
    },
    style: el => {
      if (!styles.has(el)) styles.set(el, getComputedStyle(el))
      return styles.get(el)
    },
    width: innerWidth,
  }
  const r = visibleSites(roots, m => nearestHosts(m).some(h => domVisible(h.stateNode, env)))
  return r.marks ? r.ids : null
})()`
