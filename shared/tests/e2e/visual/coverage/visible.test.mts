/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as V from './visible.ts'
import type {Box, DomEnv, DomNode, DomStyle, Fiber, NativeEnv} from './visible.ts'

// The functions as the app runs them (each sent as its own source) and as this module has them:
// every rule is checked both ways, so none leans on module scope.
type Fns = Pick<typeof V, 'visibleSites' | 'nearestHosts' | 'domVisible' | 'nativeVisibleSites' | 'colorAlpha' | 'containerRoots'>
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const sent = new Function(
  `${V.VISIBLE_FUNCTIONS}\nreturn {colorAlpha, containerRoots, domVisible, nativeVisibleSites, nearestHosts, visibleSites}`
)() as Fns
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

type El = DomNode & {style: Partial<DomStyle> & {pointerEvents?: string}; box: Box}
const VIEW = {height: 800, width: 1280}
const el = (box: Box, style: El['style'] = {}, ...children: Array<El>): El => {
  const e: El = {box, children, parentElement: null, style}
  for (const c of children) c.parentElement = e
  return e
}
const img = (box: Box): El => ({...el(box), tagName: 'IMG'})
const at = (top: number, height = 50, left = 0, width = 100): Box => ({bottom: top + height, left, right: left + width, top})
const styleOf = (e: DomNode): DomStyle => ({
  backgroundColor: 'rgba(0, 0, 0, 0)',
  display: 'block',
  opacity: '1',
  overflowX: 'visible',
  overflowY: 'visible',
  position: 'static',
  visibility: 'visible',
  ...(e as El).style,
})
// document.elementsFromPoint over the tree of el: the elements whose box holds the point, later in
// document order (and so children over their parents) first, without the hidden and those that
// take no hits
const hitTest = (x: number, y: number, e: El): Array<El> => {
  let top = e
  while (top.parentElement) top = top.parentElement as El
  const order: Array<El> = []
  const visit = (n: El) => {
    order.push(n)
    Array.from(n.children).forEach(c => visit(c as El))
  }
  visit(top)
  return order
    .reverse()
    .filter(
      n =>
        n.box.left <= x && x < n.box.right && n.box.top <= y && y < n.box.bottom &&
        styleOf(n).visibility === 'visible' && n.style.pointerEvents !== 'none'
    )
}
// the tree the hit test reads: the one the element under test is in
let hitRoot: El | undefined
const domEnv: DomEnv = {
  ...VIEW,
  at: (x, y) => (hitRoot ? hitTest(x, y, hitRoot) : []),
  rect: e => (e as El).box,
  style: styleOf,
}
const hostOf = (e: El): Fiber => ({stateNode: e, tag: 5})
const desktopSites = (fns: Fns, root: Fiber) =>
  sites(fns, root, m =>
    fns.nearestHosts(m).some(h => {
      hitRoot = h.stateNode as El
      return fns.domVisible(h.stateNode as El, domEnv)
    })
  )

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

  test(`desktop (${how}): an element whose opacity times its ancestors' is 0 does not count`, () => {
    const clear = el(at(10), {opacity: '0'})
    const inClear = el(at(100))
    const half = el(at(200), {opacity: '0.5'})
    el(at(0, 800, 0, 1280), {}, clear, el(at(0, 800, 0, 1280), {opacity: '0'}, inClear), el(at(0, 800, 0, 1280), {opacity: '0.5'}, half))
    const root = tree({tag: 3}, mark('clear.tsx:1', hostOf(clear)), mark('inClear.tsx:1', hostOf(inClear)), mark('half.tsx:1', hostOf(half)))
    assert.deepEqual(desktopSites(fns, root), ['half.tsx:1'])
  })

  test(`desktop (${how}): an element covered by an opaque element drawn over it does not count; a translucent one leaves it`, () => {
    const page = (cover: El) => {
      const under = el(at(10))
      el(at(0, 800, 0, 1280), {backgroundColor: 'rgb(255, 255, 255)'}, el(at(0, 800, 0, 1280), {}, under), cover)
      return desktopSites(fns, tree({tag: 3}, mark('under.tsx:1', hostOf(under))))
    }
    const full = at(0, 800, 0, 1280)
    assert.deepEqual(page(el(full, {backgroundColor: 'rgb(255, 255, 255)'})), [])
    assert.deepEqual(page(img(full)), [])
    // a modal's dim, or an opaque color faded by an opacity: the pixels under it still compare
    assert.deepEqual(page(el(full, {backgroundColor: 'rgba(0, 0, 0, 0.5)'})), ['under.tsx:1'])
    assert.deepEqual(page(el(full, {backgroundColor: 'rgb(0, 0, 0)', opacity: '0.4'})), ['under.tsx:1'])
    assert.deepEqual(page(el(full)), ['under.tsx:1'])
    // covering all but its bottom edge: a sampled corner still shows it
    assert.deepEqual(page(el(at(0, 59, 0, 1280), {backgroundColor: 'rgb(255, 255, 255)'})), ['under.tsx:1'])
    // the one sample point the cover leaves is the bottom right corner
    assert.deepEqual(page(el(at(0, 59, 0, 98), {backgroundColor: 'rgb(255, 255, 255)'})), ['under.tsx:1'])
    assert.deepEqual(page(el(at(0, 61, 0, 101), {backgroundColor: 'rgb(255, 255, 255)'})), [])
  })

  test(`desktop (${how}): its own opaque children, and the ancestors it draws over, do not cover an element`, () => {
    const parentEl = el(at(10), {}, el(at(10), {backgroundColor: 'rgb(255, 0, 0)'}))
    el(at(0, 800, 0, 1280), {backgroundColor: 'rgb(255, 255, 255)'}, parentEl)
    assert.deepEqual(desktopSites(fns, tree({tag: 3}, mark('p.tsx:1', hostOf(parentEl)))), ['p.tsx:1'])
  })

  test(`desktop (${how}): an element that takes no hits is placed by its nearest ancestor that does`, () => {
    const page = (covered: boolean) => {
      const ghost = el(at(10), {pointerEvents: 'none'})
      const sibling = el(at(0, 100), covered ? {backgroundColor: 'rgb(255, 255, 255)'} : {})
      el(at(0, 800, 0, 1280), {}, el(at(0, 100), {}, ghost), sibling)
      return desktopSites(fns, tree({tag: 3}, mark('ghost.tsx:1', hostOf(ghost))))
    }
    assert.deepEqual(page(false), ['ghost.tsx:1'])
    assert.deepEqual(page(true), [])
  })

  test(`desktop (${how}): a point where neither the element nor any ancestor is hit counts as covered`, () => {
    const lost = el(at(10), {pointerEvents: 'none'})
    el(at(0, 800, 0, 1280), {pointerEvents: 'none'}, lost)
    assert.deepEqual(desktopSites(fns, tree({tag: 3}, mark('lost.tsx:1', hostOf(lost)))), [])
  })

  test(`colorAlpha (${how}) reads CSS and native colors; one it does not know is opaque`, () => {
    const cases: Array<[unknown, number]> = [
      [undefined, 0],
      ['transparent', 0],
      ['rgba(0, 0, 0, 0)', 0],
      ['rgba(0, 0, 0, 0.5)', 0.5],
      ['rgb(1, 2, 3)', 1],
      ['rgb(1 2 3 / 25%)', 0.25],
      ['color(srgb 1 0 0 / 0.2)', 0.2],
      ['#fff', 1],
      ['#ffffff80', 128 / 255],
      ['#fff0', 0],
      ['white', 1],
      [0x80ffffff, 128 / 255],
      [0xffffffff, 1],
      [{semantic: 'systemBackground'}, 1],
    ]
    for (const [c, a] of cases) assert.equal(fns.colorAlpha(c), a, String(c))
  })

  test(`containerRoots (${how}) skips a container whose root React unmounted`, () => {
    const current: Fiber = {tag: 3}
    const els = [{__reactContainer$x: {stateNode: {current}}}, {__reactContainer$y: null}, {__reactContainer$z: {stateNode: null}}, {other: 1}]
    assert.deepEqual(fns.containerRoots(els), [current])
  })
}

// ---------------------------------------------------------------- phone

const WINDOW = {height: 874, width: 402}
const view = (box: Box, props: Record<string, unknown> = {}, type = 'RCTView'): Fiber => ({memoizedProps: props, stateNode: box, tag: 5, type})
const nativeEnv: NativeEnv = {...WINDOW, rect: f => f.stateNode as Box | undefined}
const phoneSites = (fns: Fns, root: Fiber) => fns.nativeVisibleSites([root], nativeEnv).ids

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

  test(`phone (${how}): a view whose opacity along its views is 0 does not count`, () => {
    const animated = (v: number) => ({__getValue: () => v})
    const root = tree(
      {tag: 3},
      screen(
        true,
        mark('clear.tsx:1', view(at(100), {style: [{opacity: 1}, {opacity: 0}]})),
        tree(view(at(0, 874, 0, 402), {style: {opacity: 0}}), mark('inClear.tsx:1', view(at(100)))),
        mark('fading.tsx:1', view(at(100), {style: {opacity: animated(0)}})),
        tree(view(at(0, 874, 0, 402), {style: {opacity: 0.5}}), mark('half.tsx:1', view(at(100), {style: {opacity: animated(0.5)}})))
      )
    )
    assert.deepEqual(phoneSites(fns, root), ['half.tsx:1'])
  })

  test(`phone (${how}): an opaque full-window view outside every screen covers what is under it`, () => {
    const full = at(0, 874, 0, 402)
    const page = (coverProps: Record<string, unknown>, coverBox = full) =>
      phoneSites(
        fns,
        tree(
          {tag: 3},
          mark('before.tsx:1', view(at(10))),
          screen(true, mark('screen.tsx:1', view(at(100)))),
          tree(view(coverBox, coverProps), mark('inCover.tsx:1', view(at(200)))),
          mark('after.tsx:1', view(at(300)))
        )
      )
    assert.deepEqual(page({style: {backgroundColor: '#fff'}}), ['after.tsx:1', 'inCover.tsx:1'])
    // a dim, a faded cover, one that leaves part of the window, or one with no background covers nothing
    const all = ['after.tsx:1', 'before.tsx:1', 'inCover.tsx:1', 'screen.tsx:1']
    assert.deepEqual(page({style: {backgroundColor: 'rgba(0,0,0,0.4)'}}), all)
    assert.deepEqual(page({style: [{backgroundColor: '#fff'}, {opacity: 0.9}]}), all)
    assert.deepEqual(page({style: {backgroundColor: '#fff'}}, at(0, 800, 0, 402)), all)
    assert.deepEqual(page({}), all)
  })

  test(`phone (${how}): an opaque full-window view in a screen covers nothing`, () => {
    // a screen's own background: what it holds draws over it, and the native header over that
    const root = tree(
      {tag: 3},
      screen(true, mark('header.tsx:1', view(at(0, 50))), tree(view(at(0, 874, 0, 402), {style: {backgroundColor: '#fff'}}), mark('in.tsx:1', view(at(10))))),
      mark('after.tsx:1', view(at(300)))
    )
    assert.deepEqual(phoneSites(fns, root), ['after.tsx:1', 'header.tsx:1', 'in.tsx:1'])
  })

  test(`phone (${how}): an opaque full-window view does not cover the view that holds it`, () => {
    const cover = view(at(0, 874, 0, 402), {style: {backgroundColor: '#fff'}})
    const root = tree({tag: 3}, screen(true), mark('wrapper.tsx:1', tree(view(at(0, 874, 0, 402)), cover)))
    assert.deepEqual(phoneSites(fns, root), ['wrapper.tsx:1'])
  })

  test(`phone (${how}): while the focused screen is a modal, only it and FullWindowOverlay content count`, () => {
    const page = (modalFocused: boolean) =>
      phoneSites(
        fns,
        tree(
          {tag: 3},
          screen(!modalFocused, mark('tab.tsx:1', view(at(100)))),
          tree(view(at(40, 834, 0, 402), {}, modalFocused ? 'RNSModalScreen' : 'RNSScreen'), screen(true, mark('modal.tsx:1', view(at(100))))),
          mark('errorBar.tsx:1', view(at(800, 20))),
          tree(view(at(0, 874, 0, 402), {}, 'RNSFullWindowOverlay'), mark('sheet.tsx:1', view(at(600))))
        )
      )
    assert.deepEqual(page(true), ['modal.tsx:1', 'sheet.tsx:1'])
    // the same tree pushed rather than presented: the root view's overlays are drawn
    assert.deepEqual(page(false), ['errorBar.tsx:1', 'modal.tsx:1', 'sheet.tsx:1', 'tab.tsx:1'])
  })

  test(`phone (${how}): FullWindowOverlay content is in a window of its own: nothing above it clips or fades it, and it covers the root view`, () => {
    const overlay = tree(view(at(0, 874, 0, 402), {style: {backgroundColor: '#000'}}, 'RNSFullWindowOverlay'), mark('sheet.tsx:1', view(at(600))))
    const clipper = tree(view(at(0, 10, 0, 402), {style: {opacity: 0.5, overflow: 'hidden'}}), overlay)
    const root = tree({tag: 3}, screen(true, mark('screen.tsx:1', view(at(100)))), clipper)
    assert.deepEqual(phoneSites(fns, root), ['sheet.tsx:1'])
  })

  test(`phone (${how}): a hidden screen's subtree is not walked once the walk has met a mark`, () => {
    const poisoned: Fiber = {tag: 5}
    Object.defineProperty(poisoned, 'memoizedProps', {
      get: () => {
        throw new Error('walked a hidden screen')
      },
    })
    // the walk meets the focused screen's mark first (children before later siblings)
    const root = tree({tag: 3}, screen(true, mark('a.tsx:1', view(at(100)))), screen(false, mark('b.tsx:1', poisoned)))
    assert.deepEqual(fns.nativeVisibleSites([root], nativeEnv), {ids: ['a.tsx:1'], marks: 1})
    // marks only in a hidden screen still say the app has coverage marks
    const onlyHidden = tree({tag: 3}, screen(false, mark('b.tsx:1', view(at(100)))), screen(true, view(at(100))))
    assert.deepEqual(fns.nativeVisibleSites([onlyHidden], nativeEnv), {ids: [], marks: 1})
  })

  test(`phone (${how}): each screen asks its navigation once, however many marks it holds`, () => {
    let asked = 0
    const counted = tree(
      {memoizedProps: {navigation: {isFocused: () => ++asked > 0}, route: {key: 'r'}}, tag: 0},
      ...[1, 2, 3, 4].map(i => mark(`m.tsx:${i}`, view(at(100))))
    )
    assert.deepEqual(phoneSites(fns, tree({tag: 3}, counted)), ['m.tsx:1', 'm.tsx:2', 'm.tsx:3', 'm.tsx:4'])
    assert.equal(asked, 1)
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
