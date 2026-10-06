/// <reference types="jest" />
import type * as BoxModule from './box'
import type * as RN from 'react-native'
import * as fs from 'fs'
import * as path from 'path'

// Native styles come from the native path, so the platform globals are flipped before the style modules
// load. The desktop class and style builders read no platform global.
const g = globalThis as unknown as {isAndroid: boolean; isElectron: boolean; isIOS: boolean; isMobile: boolean}
g.isMobile = true
g.isIOS = false
g.isAndroid = false
g.isElectron = false

/* eslint-disable @typescript-eslint/no-require-imports */
const {box2ClassNamesForTest, box2DesktopStyleForTest, box2SharedPropsForTest} = require('./box') as typeof BoxModule
const {StyleSheet} = require('react-native') as typeof RN
/* eslint-enable @typescript-eslint/no-require-imports */

type Props = BoxModule.Box2Props
type Decls = Map<string, string | number>

// Each combination resolves on both platforms to the properties below. Engine defaults Box2 sets for
// neither platform are left out: flexShrink is compared only where noShrink sets it (CSS defaults to 1,
// Yoga to 0), and flex-basis not at all.
type Resolved = {
  alignItems: unknown
  childPointerEvents: unknown
  columnGap: unknown
  flexGrow: unknown
  flexShrink?: unknown
  justifyContent: unknown
  overflow: unknown
  paddingBottom: unknown
  paddingLeft: unknown
  paddingRight: unknown
  paddingTop: unknown
  pointerEvents: unknown
  rowGap: unknown
}

// ─── desktop: box.css plus the inline style ───────────────────────────────────

// box.css values are var(--size-*), defined in the renderer's root stylesheet.
const sizeVars = new Map(
  [...fs.readFileSync(path.join(__dirname, '../desktop/renderer/style.css'), 'utf8').matchAll(/--(size-\w+):\s*(\d+)px/g)].map(
    m => [`var(--${m[1]})`, Number(m[2])]
  )
)
const cssValue = (v: string): string | number => sizeVars.get(v) ?? (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v)

type Rule = {childOf: boolean; classes: Array<string>; decls: Array<[string, string]>; order: number; specificity: number}

// Enough of CSS for box.css: class selectors, `&` nesting, `:where()` and `> *`.
const parseCss = (css: string): Array<Rule> => {
  const rules: Array<Rule> = []
  const walk = (text: string, parent: string | undefined, owner: Rule | undefined) => {
    let buf = ''
    for (let i = 0; i < text.length; i++) {
      const c = text.charAt(i)
      if (c === '{') {
        let depth = 1
        let j = i + 1
        for (; depth > 0; j++) {
          if (text[j] === '{') depth++
          else if (text[j] === '}') depth--
        }
        const raw = buf.trim()
        const selector = parent ? raw.replace(/&/g, parent) : raw
        buf = ''
        const childOf = selector.endsWith('> *')
        const compound = childOf ? selector.slice(0, -3).trim() : selector
        if (!/^(:where\(\.[\w-]+\)|\.[\w-]+)+$/.test(compound)) throw new Error(`unsupported selector ${selector}`)
        const rule: Rule = {
          childOf,
          classes: [...compound.matchAll(/\.([\w-]+)/g)].map(m => m[1] ?? ''),
          decls: [],
          order: rules.length,
          specificity: [...compound.replace(/:where\([^)]*\)/g, '').matchAll(/\./g)].length,
        }
        rules.push(rule)
        walk(text.slice(i + 1, j - 1), selector, rule)
        i = j - 1
      } else if (c === ';') {
        const [k, ...v] = buf.split(':')
        if (!owner || !k) throw new Error(`declaration outside a rule: ${buf}`)
        owner.decls.push([k.trim(), v.join(':').trim()])
        buf = ''
      } else {
        buf += c
      }
    }
    if (buf.trim()) throw new Error(`unterminated: ${buf}`)
  }
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), undefined, undefined)
  return rules
}

const rules = parseCss(fs.readFileSync(path.join(__dirname, 'box.css'), 'utf8'))

const expand = (decls: Decls, prop: string, value: string | number) => {
  switch (prop) {
    case 'flex': {
      if (typeof value !== 'number') throw new Error(`unsupported flex ${value}`)
      decls.set('flex-grow', value)
      decls.set('flex-shrink', 1)
      decls.set('flex-basis', '0%')
      return
    }
    case 'padding':
      if (typeof value === 'string' && /\s/.test(value)) throw new Error(`unsupported padding ${value}`)
      for (const side of ['top', 'right', 'bottom', 'left']) decls.set(`padding-${side}`, value)
      return
    case 'gap':
      decls.set('row-gap', value)
      decls.set('column-gap', value)
      return
    default:
      decls.set(prop, value)
  }
}

const cascade = (classes: ReadonlySet<string>, parentClasses: ReadonlySet<string> | undefined): Decls => {
  const decls: Decls = new Map()
  rules
    .filter(r => r.classes.every(c => (r.childOf ? parentClasses?.has(c) : classes.has(c))))
    .sort((a, b) => a.specificity - b.specificity || a.order - b.order)
    .forEach(r => r.decls.forEach(([k, v]) => expand(decls, k, cssValue(v))))
  return decls
}

type Inherited = {customs: ReadonlyMap<string, string | number>; pointerEvents: string | number}

// One element under `inherited`: its classes cascade (with its parent's for `> *` rules), custom
// properties and pointer-events inherit unless set, and var() reads the inherited custom properties.
const resolveElement = (
  classes: ReadonlySet<string>,
  parentClasses: ReadonlySet<string> | undefined,
  inherited: Inherited
): Inherited => {
  const decls = cascade(classes, parentClasses)
  const customs = new Map(inherited.customs)
  for (const [k, v] of decls) if (k.startsWith('--')) customs.set(k, v)
  const resolveVar = (v: string | number): string | number => {
    const m = typeof v === 'string' ? /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(v) : null
    if (!m) return v
    return customs.get(m[1] ?? '') ?? (m[2] === undefined ? 'auto' : resolveVar(cssValue(m[2])))
  }
  const own = decls.get('pointer-events')
  return {customs, pointerEvents: own === undefined ? inherited.pointerEvents : resolveVar(own)}
}

const kebab = (k: string) => k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)

const resolveDesktop = (p: Props): Resolved => {
  const classes = new Set(box2ClassNamesForTest(p).split(' '))
  const decls = cascade(classes, undefined)
  // inline style beats every class, applied in key order as the DOM applies it
  for (const [k, v] of Object.entries(box2DesktopStyleForTest(p) ?? {})) {
    if (v !== undefined) expand(decls, kebab(k), v as string | number)
  }
  const pointerEvents = decls.get('pointer-events') ?? 'auto'
  const box = resolveElement(classes, undefined, {customs: new Map(), pointerEvents: 'auto'})
  // a plain child under the box
  const childPointerEvents = resolveElement(new Set(), classes, box).pointerEvents
  return {
    alignItems: decls.get('align-items'),
    childPointerEvents,
    columnGap: decls.get('column-gap') ?? 0,
    flexGrow: decls.get('flex-grow') ?? 0,
    ...(p.noShrink ? {flexShrink: decls.get('flex-shrink') ?? 1} : {}),
    justifyContent: decls.get('justify-content'),
    overflow: decls.get('overflow') ?? 'visible',
    paddingBottom: decls.get('padding-bottom') ?? 0,
    paddingLeft: decls.get('padding-left') ?? 0,
    paddingRight: decls.get('padding-right') ?? 0,
    paddingTop: decls.get('padding-top') ?? 0,
    pointerEvents,
    rowGap: decls.get('row-gap') ?? 0,
  }
}

// ─── native: the flattened style as Yoga reads it ─────────────────────────────

// Yoga reads the most specific edge or gutter that is set, whatever the order: Style::computeTopEdge
// (top, vertical, all), computeLeftEdge (start, left, horizontal, all), computeRowGap and
// computeColumnGap (row or column, then all), and Node::resolveFlexGrow / resolveFlexShrink
// (flexGrow / flexShrink, then flex).
const resolveNative = (p: Props): Resolved => {
  const shared = box2SharedPropsForTest(p)
  // flatten returns undefined when every style entry is empty, which its typing omits
  const s = (StyleSheet.flatten(shared.style as RN.StyleProp<RN.ViewStyle>) as {[key: string]: unknown} | undefined) ?? {}
  const first = (...keys: Array<string>) => keys.map(k => s[k]).find(v => v !== undefined) ?? 0
  const flex = typeof s['flex'] === 'number' ? s['flex'] : 0
  const pe = shared.pointerEvents
  return {
    alignItems: s['alignItems'],
    childPointerEvents: pe === 'none' ? 'none' : 'auto',
    columnGap: first('columnGap', 'gap'),
    flexGrow: s['flexGrow'] ?? (flex > 0 ? flex : 0),
    ...(p.noShrink ? {flexShrink: s['flexShrink'] ?? (flex < 0 ? -flex : 0)} : {}),
    justifyContent: s['justifyContent'],
    overflow: s['overflow'] ?? 'visible',
    paddingBottom: first('paddingBottom', 'paddingVertical', 'padding'),
    paddingLeft: first('paddingStart', 'paddingLeft', 'paddingHorizontal', 'padding'),
    paddingRight: first('paddingEnd', 'paddingRight', 'paddingHorizontal', 'padding'),
    paddingTop: first('paddingTop', 'paddingVertical', 'padding'),
    pointerEvents: pe === 'none' || pe === 'box-none' ? 'none' : 'auto',
    rowGap: first('rowGap', 'gap'),
  }
}

// ─── sweeps ───────────────────────────────────────────────────────────────────

type Axes = {[K in keyof Props]?: ReadonlyArray<Props[K]>}

const sweep = (axes: Axes): Array<Props> => {
  let out: Array<Props> = [{direction: 'vertical'}]
  for (const [name, values] of Object.entries(axes) as Array<[keyof Props, ReadonlyArray<unknown>]>) {
    out = out.flatMap(p => values.map(v => ({...p, [name]: v})))
  }
  return out
}

const mismatches = (combos: ReadonlyArray<Props>) =>
  combos.flatMap(p => {
    const desktop = resolveDesktop(p)
    const native = resolveNative(p)
    return JSON.stringify(desktop) === JSON.stringify(native)
      ? []
      : [`${JSON.stringify(p)}\n      desktop ${JSON.stringify(desktop)}\n      native  ${JSON.stringify(native)}`]
  })

const directions = ['horizontal', 'horizontalReverse', 'vertical', 'verticalReverse'] as const

test('alignment, overflow and pointerEvents resolve the same on desktop and native', () => {
  const combos = sweep({
    direction: directions,
    alignItems: [undefined, 'center', 'flex-start', 'flex-end', 'stretch'],
    centerChildren: [false, true],
    justifyContent: [undefined, 'flex-end', 'space-between'],
    overflow: [undefined, 'hidden', 'visible'],
    pointerEvents: [undefined, 'none', 'box-none'],
  })
  expect(mismatches(combos)).toEqual([])
})

test('flex, noShrink, padding and gaps resolve the same on desktop and native, with or without a style', () => {
  const combos = sweep({
    direction: directions,
    flex: [undefined, 1],
    noShrink: [false, true],
    padding: [undefined, 'small'],
    gap: [undefined, 'tiny'],
    gapStart: [false, true],
    gapEnd: [false, true],
    style: [
      undefined,
      {flex: 1},
      {flex: 1, flexShrink: 1},
      {padding: 4},
      {padding: 4, paddingLeft: 2, paddingTop: 2},
      {columnGap: 2},
      {rowGap: 2},
    ],
  })
  expect(mismatches(combos)).toEqual([])
})

// ─── pointer-events down a chain of boxes ─────────────────────────────────────

// `chain` is outermost first; the last entry's pointer-events (undefined = a plain child) is returned.
const desktopChain = (chain: ReadonlyArray<Props['pointerEvents']>) => {
  let inherited: Inherited = {customs: new Map(), pointerEvents: 'auto'}
  let parentClasses: ReadonlySet<string> | undefined
  for (const pe of chain) {
    const classes = new Set(box2ClassNamesForTest({direction: 'vertical', pointerEvents: pe}).split(' '))
    inherited = resolveElement(classes, parentClasses, inherited)
    parentClasses = classes
  }
  return inherited.pointerEvents
}

// React Native: 'none' removes the view and its whole subtree, 'box-none' only the view itself.
const nativeChain = (chain: ReadonlyArray<Props['pointerEvents']>) => {
  const own = chain.at(-1)
  return own === 'none' || own === 'box-none' || chain.slice(0, -1).includes('none') ? 'none' : 'auto'
}

test('pointer-events resolve the same on desktop and native down every chain of boxes', () => {
  const values = [undefined, 'none', 'box-none'] as const
  let chains: Array<Array<Props['pointerEvents']>> = [[]]
  const failures: Array<string> = []
  for (let depth = 1; depth <= 4; depth++) {
    chains = chains.flatMap(c => values.map(v => [...c, v]))
    for (const chain of chains) {
      const desktop = desktopChain(chain)
      const native = nativeChain(chain)
      if (desktop !== native) failures.push(`${JSON.stringify(chain)} desktop ${desktop} native ${native}`)
    }
  }
  expect(failures).toEqual([])
})

test('a box-none child inherits an outer none and otherwise keeps its own pointer-events', () => {
  expect(desktopChain(['none', 'box-none', undefined])).toBe('none')
  expect(desktopChain(['box-none', undefined])).toBe('auto')
  expect(desktopChain(['box-none', 'box-none', undefined])).toBe('auto')
  expect(desktopChain(['box-none', 'none'])).toBe('none')
  expect(desktopChain(['box-none', 'box-none'])).toBe('none')
})

test('a style without a shorthand passes through as the same object', () => {
  const style = {flexShrink: 1, paddingTop: 2}
  expect(box2DesktopStyleForTest({direction: 'vertical', gap: 'tiny', gapStart: true, noShrink: true, style})).toBe(style)
})
