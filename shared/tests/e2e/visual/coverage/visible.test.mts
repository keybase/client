/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as V from './visible.ts'
import type {Box, DomEnv, DomNode, DomStyle, Fiber, NativeEnv} from './visible.ts'

// The functions as the app runs them (each sent as its own source) and as this module has them:
// every rule is checked both ways, so none leans on module scope.
type Fns = Pick<typeof V, 'visibleSites' | 'nearestHosts' | 'domVisible' | 'nativeVisible'>
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const sent = new Function(`${V.VISIBLE_FUNCTIONS}\nreturn {domVisible, nativeVisible, nearestHosts, visibleSites}`)() as Fns
const both: ReadonlyArray<[string, Fns]> = [
  ['module', V],
  ['in page', sent],
]

const Mark = Object.assign(({children}: {children: unknown}) => children, {__kbVisualSrcMark: true})
const Box2 = () => null

// parent -> children links, with return and sibling set as React keeps them
const tree = (f: Fiber, ...children: Array<Fiber>): Fiber => {
  f.child = children[0]
  children.forEach((c, i) => {
    c.return = f
    c.sibling = children[i + 1]
  })
  return f
}
// a mark over Box2 over its host
const mark = (id: string, host: Fiber) => tree({memoizedProps: {id}, tag: 0, type: Mark}, tree({tag: 0, type: Box2}, host))
const screen = (focused: boolean, ...children: Array<Fiber>) =>
  tree({memoizedProps: {navigation: {isFocused: () => focused}, route: {key: 'r'}}, tag: 0}, ...children)
const sites = (fns: Fns, root: Fiber, visible: (m: Fiber) => boolean) => fns.visibleSites([root], visible).ids

// ---------------------------------------------------------------- desktop

type El = DomNode & {style: Partial<DomStyle>; box: Box}
const VIEW = {height: 800, width: 1280}
const el = (box: Box, style: Partial<DomStyle> = {}, ...children: Array<El>): El => {
  const e: El = {box, children, parentElement: null, style}
  for (const c of children) c.parentElement = e
  return e
}
const at = (top: number, height = 50, left = 0, width = 100): Box => ({bottom: top + height, left, right: left + width, top})
const domEnv: DomEnv = {
  ...VIEW,
  rect: e => (e as El).box,
  style: e => ({display: 'block', overflowX: 'visible', overflowY: 'visible', position: 'static', visibility: 'visible', ...(e as El).style}),
}
const hostOf = (e: El): Fiber => ({stateNode: e, tag: 5})
const desktopSites = (fns: Fns, root: Fiber) =>
  sites(fns, root, m => fns.nearestHosts(m).some(h => fns.domVisible(h.stateNode as El, domEnv)))

for (const [how, fns] of both) {
  test(`desktop (${how}): a site counts when a host of it is drawn in the viewport`, () => {
    const shown = el(at(10))
    el(at(0, 800, 0, 1280), {}, shown)
    assert.deepEqual(desktopSites(fns, tree({tag: 3}, mark('a.tsx:1', hostOf(shown)))), ['a.tsx:1'])
  })

  test(`desktop (${how}): a site in a hidden tab (display:none) does not count`, () => {
    const inTab = el(at(0, 0, 0, 0))
    const tab = el(at(0, 0, 0, 0), {display: 'none'}, el(at(0, 0, 0, 0), {}, inTab))
    el(at(0, 800, 0, 1280), {}, tab)
    assert.deepEqual(desktopSites(fns, tree({tag: 3}, mark('tab.tsx:1', hostOf(inTab)))), [])
    // the rule is the display:none ancestor, not the empty box a hidden element reports
    const sized = el(at(10))
    el(at(0, 800), {display: 'none'}, sized)
    assert.deepEqual(desktopSites(fns, tree({tag: 3}, mark('tab.tsx:2', hostOf(sized)))), [])
  })

  test(`desktop (${how}): a site of a stack screen under the top one does not count, the top one's does`, () => {
    // native-stack on the web keeps the screens under the top one mounted, display:none
    const under = el(at(10))
    const top = el(at(10))
    el(at(0, 800, 0, 1280), {}, el(at(0, 800), {display: 'none'}, under), el(at(0, 800), {}, top))
    const root = tree({tag: 3}, mark('inbox.tsx:1', hostOf(under)), mark('thread.tsx:1', hostOf(top)))
    assert.deepEqual(desktopSites(fns, root), ['thread.tsx:1'])
  })

  test(`desktop (${how}): a portal overlay over the screen counts`, () => {
    // the popup's element hangs off the body, outside the screen that rendered it
    const popup = el(at(300), {position: 'fixed'})
    el(at(0, 800, 0, 1280), {overflowX: 'hidden', overflowY: 'hidden'}, el(at(0, 800), {}), el(at(0, 0, 0, 0), {position: 'relative'}, popup))
    const portal = tree({tag: 4}, tree({tag: 0, type: Box2}, hostOf(popup)))
    const root = tree({tag: 3}, tree({memoizedProps: {id: 'menu.tsx:1'}, tag: 0, type: Mark}, portal))
    assert.deepEqual(desktopSites(fns, root), ['menu.tsx:1'])
  })

  test(`desktop (${how}): a site scrolled below the fold of a scroll view does not count`, () => {
    const above = el(at(100))
    const below = el(at(700))
    // the list scrolls in 0..600 of an 800 tall viewport; the row at 700 is inside the viewport
    // but outside the list
    const list = el(at(0, 600, 0, 1280), {overflowY: 'auto'}, el(at(0, 2000, 0, 1280), {}, above, below))
    el(at(0, 800, 0, 1280), {}, list)
    const root = tree({tag: 3}, mark('row.tsx:1', hostOf(above)), mark('row.tsx:9', hostOf(below)))
    assert.deepEqual(desktopSites(fns, root), ['row.tsx:1'])
  })

  test(`desktop (${how}): hidden, empty and off-viewport elements do not count; a fixed or absolute one escapes non-containing clips`, () => {
    const hidden = el(at(10), {visibility: 'hidden'})
    const empty = el(at(10, 0))
    const off = el(at(900))
    const fixed = el(at(700), {position: 'fixed'})
    const absolute = el(at(700), {position: 'absolute'})
    // clips at 600, but contains neither: the fixed one's block is the viewport, the absolute one's
    // the positioned ancestor above the clip
    const clipper = el(at(0, 600, 0, 1280), {overflowY: 'hidden'}, hidden, empty, off, fixed, absolute)
    el(at(0, 800, 0, 1280), {position: 'relative'}, clipper)
    const root = tree(
      {tag: 3},
      mark('hidden.tsx:1', hostOf(hidden)),
      mark('empty.tsx:1', hostOf(empty)),
      mark('off.tsx:1', hostOf(off)),
      mark('fixed.tsx:1', hostOf(fixed)),
      mark('absolute.tsx:1', hostOf(absolute))
    )
    assert.deepEqual(desktopSites(fns, root), ['absolute.tsx:1', 'fixed.tsx:1'])
  })

  test(`desktop (${how}): display:contents passes to its children`, () => {
    const child = el(at(10))
    const contents = el(at(0, 0, 0, 0), {display: 'contents'}, child)
    el(at(0, 800, 0, 1280), {}, contents)
    assert.deepEqual(desktopSites(fns, tree({tag: 3}, mark('c.tsx:1', hostOf(contents)))), ['c.tsx:1'])
  })
}

// ---------------------------------------------------------------- phone

const WINDOW = {height: 874, width: 402}
const view = (box: Box, props: Record<string, unknown> = {}, type = 'RCTView'): Fiber => ({memoizedProps: props, stateNode: box, tag: 5, type})
const nativeEnv: NativeEnv = {...WINDOW, rect: f => f.stateNode as Box | undefined}
const phoneSites = (fns: Fns, root: Fiber) => sites(fns, root, m => fns.nativeVisible(m, nativeEnv))

for (const [how, fns] of both) {
  test(`phone (${how}): a site in the focused screen and in the window counts`, () => {
    const root = tree({tag: 3}, screen(true, mark('a.tsx:1', view(at(100)))))
    assert.deepEqual(phoneSites(fns, root), ['a.tsx:1'])
  })

  test(`phone (${how}): a site of a stack screen under the top one, or of a hidden tab, does not count`, () => {
    // both lay out in the window: only the screen's focus tells them apart
    const root = tree(
      {tag: 3},
      screen(false, mark('inbox.tsx:1', view(at(100)))),
      screen(true, mark('thread.tsx:1', view(at(100)))),
      screen(false, mark('otherTab.tsx:1', view(at(100))))
    )
    assert.deepEqual(phoneSites(fns, root), ['thread.tsx:1'])
  })

  test(`phone (${how}): an overlay outside every screen counts while it is in the window`, () => {
    const root = tree(
      {tag: 3},
      screen(true),
      mark('sheet.tsx:1', view(at(500))),
      // a sheet parked below the window
      mark('sheet.tsx:9', view(at(900)))
    )
    assert.deepEqual(phoneSites(fns, root), ['sheet.tsx:1'])
  })

  test(`phone (${how}): a site scrolled below the fold of a scroll view does not count`, () => {
    const above = view(at(100))
    const below = view(at(700))
    // the scroll view ends at 600; the row at 700 is in the window but outside the scroll view
    const list = tree(view(at(0, 600, 0, 402), {}, 'RCTScrollView'), tree(view(at(0, 3000, 0, 402)), mark('row.tsx:1', above), mark('row.tsx:9', below)))
    const root = tree({tag: 3}, screen(true, list))
    assert.deepEqual(phoneSites(fns, root), ['row.tsx:1'])
  })

  test(`phone (${how}): an overflow:hidden view clips, through a style array; an empty view does not count`, () => {
    const clipped = view(at(300))
    const empty = view(at(10, 0))
    const box = tree(view(at(0, 200, 0, 402), {style: [{flex: 1}, [{overflow: 'hidden'}]]}), mark('clip.tsx:1', clipped), mark('empty.tsx:1', empty))
    const unclipped = view(at(300))
    const open = tree(view(at(0, 200, 0, 402), {style: [{overflow: 'hidden'}, {overflow: 'visible'}]}), mark('open.tsx:1', unclipped))
    assert.deepEqual(phoneSites(fns, tree({tag: 3}, screen(true, box, open))), ['open.tsx:1'])
  })

  test(`phone (${how}): one drawn instance is enough for the site`, () => {
    const root = tree({tag: 3}, screen(false, mark('cell.tsx:2', view(at(100)))), screen(true, mark('cell.tsx:2', view(at(100)))))
    assert.deepEqual(phoneSites(fns, root), ['cell.tsx:2'])
  })
}

test('visibleSites counts the marks it walked, and nothing without the mark flag', () => {
  const plain = tree({memoizedProps: {id: 'x.tsx:1'}, tag: 0, type: () => null}, view(at(0)))
  assert.deepEqual(V.visibleSites([tree({tag: 3}, plain)], () => true), {ids: [], marks: 0})
  assert.deepEqual(V.visibleSites([tree({tag: 3}, mark('a.tsx:1', view(at(0))))], () => false), {ids: [], marks: 1})
})

test('walkFibers stops at the first fiber visit returns true for', () => {
  const seen: Array<number> = []
  const root = tree({tag: 3}, tree({tag: 1}, {tag: 7}), {tag: 2}, {tag: 4}, {tag: 6})
  V.walkFibers([root], f => {
    seen.push(f.tag)
    return f.tag === 4
  })
  // a fiber's next sibling before its children, as the drivers have always walked
  assert.deepEqual(seen, [3, 1, 2, 4])
})
