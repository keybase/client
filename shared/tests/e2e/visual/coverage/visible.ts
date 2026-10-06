// Which coverage marks (src-mark.tsx) a capture shows: a Box2 / ClickableBox call site counts for a
// capture when one of its instances is drawn in the screenshot. The drivers run these functions in
// the app, on its React fiber tree, at the moment of the capture:
// - desktop: one of the mark's host elements is rendered (not display:none or visibility:hidden,
//   non-empty) and overlaps the viewport once clipped by the ancestors that clip it;
// - phone: the mark's screen is the focused one, or it draws outside every screen (the overlays
//   and sheets over the navigator), and one of its host views overlaps the window once clipped by
//   the scroll views and overflow:hidden views around it.
// A site whose instances are all scrolled out of view does not count: no pixel of it is compared.
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

export type DomStyle = {display: string; visibility: string; position: string; overflowX: string; overflowY: string}
export type DomNode = {parentElement: DomNode | null; children: ArrayLike<DomNode>}
export type DomEnv = {style: (el: DomNode) => DomStyle; rect: (el: DomNode) => Box; width: number; height: number}

// Whether an element draws in the viewport. An ancestor clips it only when it is in its containing
// block chain: an absolutely positioned element escapes static ancestors, a fixed one all of them.
export function domVisible(el: DomNode, env: DomEnv): boolean {
  const s = env.style(el)
  if (s.display === 'contents') return Array.from(el.children).some(c => domVisible(c, env))
  if (s.display === 'none' || s.visibility !== 'visible') return false
  const r = env.rect(el)
  if (!(r.right > r.left && r.bottom > r.top)) return false
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
  return overlaps(r, clip)
}

// ---------------------------------------------------------------- phone

export type NativeEnv = {rect: (host: Fiber) => Box | undefined; width: number; height: number}

// A host view that clips what it holds: a scroll view, or a view styled overflow hidden or scroll.
export function clipsChildren(f: Fiber): boolean {
  if (f.type === 'RCTScrollView') return true
  let overflow: unknown
  const read = (s: unknown) => {
    if (Array.isArray(s)) s.forEach(read)
    else if (s && typeof s === 'object' && 'overflow' in s) overflow = (s as {overflow: unknown}).overflow
  }
  read(f.memoizedProps?.['style'])
  return overflow === 'hidden' || overflow === 'scroll'
}

// Whether a host view draws in the window, clipped by the views around it that clip.
export function nativeInWindow(host: Fiber, env: NativeEnv): boolean {
  const r = env.rect(host)
  if (!r || !(r.right > r.left && r.bottom > r.top)) return false
  let clip: Box = {bottom: env.height, left: 0, right: env.width, top: 0}
  for (let p = host.return; p; p = p.return) {
    if (p.tag !== 5 || !clipsChildren(p)) continue
    const pr = env.rect(p)
    if (!pr) continue
    clip = {
      bottom: Math.min(clip.bottom, pr.bottom),
      left: Math.max(clip.left, pr.left),
      right: Math.min(clip.right, pr.right),
      top: Math.max(clip.top, pr.top),
    }
  }
  return overlaps(r, clip)
}

export function nativeVisible(mark: Fiber, env: NativeEnv): boolean {
  if (screenPlacement(mark) === 'hidden') return false
  return nearestHosts(mark).some(h => nativeInWindow(h, env))
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
  visibleSites,
  domVisible,
  clipsChildren,
  nativeInWindow,
  nativeVisible
)

// The ids a desktop window's capture shows, or null when the app has no coverage marks. React's
// roots are found from their container elements.
export const DESKTOP_VISIBLE_SITES = `(() => {
  ${VISIBLE_FUNCTIONS}
  const roots = []
  for (const el of document.querySelectorAll('*')) {
    for (const k of Object.keys(el)) if (k.startsWith('__reactContainer$')) roots.push(el[k].stateNode.current)
  }
  const styles = new Map()
  const rects = new Map()
  const env = {
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
