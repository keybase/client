/// <reference types="jest" />
import type * as BoxModule from './box'
import type * as RN from 'react-native'
import * as fs from 'fs'
import * as path from 'path'

// The native path: the platform globals are read as the style modules load, so they are flipped
// before any is required. Nothing in Box2 differs between iOS and Android; isIOS stays off because the
// iOS theme needs DynamicColorIOS, which the react-native mock lacks.
const g = globalThis as unknown as {isAndroid: boolean; isElectron: boolean; isIOS: boolean; isMobile: boolean}
g.isMobile = true
g.isIOS = false
g.isAndroid = false
g.isElectron = false

/* eslint-disable @typescript-eslint/no-require-imports */
const {box2SharedPropsForTest} = require('./box') as typeof BoxModule
const {StyleSheet} = require('react-native') as typeof RN
/* eslint-enable @typescript-eslint/no-require-imports */

type Props = BoxModule.Box2Props
type Style = {[key: string]: unknown}

const fixturePath = path.join(__dirname, 'box2-native-styles.fixture.json')

// Order matters: the fixture stores one style index per combination in this enumeration order.
const axes = {
  direction: ['horizontal', 'horizontalReverse', 'vertical', 'verticalReverse'],
  fullWidth: [false, true],
  fullHeight: [false, true],
  alignSelf: [undefined, 'center', 'flex-start', 'flex-end', 'stretch'],
  alignItems: [undefined, 'center', 'flex-start', 'flex-end', 'stretch'],
  centerChildren: [false, true],
  flex: [undefined, 1, 2],
  padding: [undefined, 'small'],
  gap: [undefined, 'tiny'],
  gapStart: [false, true],
} as const

type AxisName = keyof typeof axes
type Combo = Partial<Record<AxisName, string | number | boolean>>
const axisNames = Object.keys(axes) as Array<AxisName>

const combinations = (): Array<Combo> => {
  let out: Array<Combo> = [{}]
  for (const name of axisNames) {
    out = out.flatMap(c => axes[name].map(v => ({...c, [name]: v})))
  }
  return out
}

const comboKey = (c: Combo) =>
  axisNames.map(n => `${n}=${c[n] === undefined ? '-' : String(c[n])}`).join(' ')

const sortKeys = (s: Style): Style =>
  Object.fromEntries(Object.keys(s).sort().map(k => [k, s[k]]))

// Undefined values are dropped, as JSON would drop them.
const flatStyle = (c: Combo): Style => {
  // flatten returns undefined when every style entry is empty, which its typing omits
  const flat =
    (StyleSheet.flatten(box2SharedPropsForTest(c as Props).style as RN.StyleProp<RN.ViewStyle>) as
      | Style
      | undefined) ?? {}
  return sortKeys(Object.fromEntries(Object.entries(flat).filter(([, v]) => v !== undefined)))
}

// The flattened style of every combination, split losslessly in two: the alignment keys, and every
// other key (sizing, flex, padding, gaps). Each half is deduplicated on its own, which keeps the
// fixture small; a combination is stored as one base-36 index into each list.
const alignmentKeys = new Set(['alignItems', 'alignSelf', 'flexDirection', 'justifyContent'])
const halves = ['alignment', 'sizing'] as const
type Half = (typeof halves)[number]
const split = (s: Style): Record<Half, Style> => ({
  alignment: Object.fromEntries(Object.entries(s).filter(([k]) => alignmentKeys.has(k))),
  sizing: Object.fromEntries(Object.entries(s).filter(([k]) => !alignmentKeys.has(k))),
})

type Fixture = {
  axes: Record<string, ReadonlyArray<unknown>>
  alignment: Array<Style>
  sizing: Array<Style>
  // Per combination, in enumeration order: the alignment index then the sizing index, each
  // zero-padded to a fixed width. Wrapped into rows of ROW combinations.
  indices: Array<string>
}

const ROW = 50
const indexWidth = (count: number) => Math.max(1, Math.ceil(Math.log(count) / Math.log(36)))

// undefined is not JSON; the fixture records it as null so a reordered or edited axis is caught.
const jsonAxes = () =>
  Object.fromEntries(axisNames.map(n => [n, axes[n].map(v => (v === undefined ? null : v))]))

const build = (): Fixture => {
  const lists: Record<Half, Array<Style>> = {alignment: [], sizing: []}
  const seen: Record<Half, Map<string, number>> = {alignment: new Map(), sizing: new Map()}
  const order = combinations().map(c => {
    const parts = split(flatStyle(c))
    return halves.map(h => {
      const k = JSON.stringify(parts[h])
      let i = seen[h].get(k)
      if (i === undefined) {
        i = lists[h].length
        seen[h].set(k, i)
        lists[h].push(parts[h])
      }
      return i
    })
  })
  const widths = halves.map(h => indexWidth(lists[h].length))
  const codes = order.map(ix => ix.map((i, n) => i.toString(36).padStart(widths[n] ?? 1, '0')).join(''))
  const indices: Array<string> = []
  for (let i = 0; i < codes.length; i += ROW) indices.push(codes.slice(i, i + ROW).join(''))
  return {axes: jsonAxes(), indices, alignment: lists.alignment, sizing: lists.sizing}
}

const decode = (f: Fixture): Array<Style> => {
  const [wl, ws] = halves.map(h => indexWidth(f[h].length)) as [number, number]
  const all = f.indices.join('')
  const out: Array<Style> = []
  for (let i = 0; i < all.length; i += wl + ws) {
    const l = f.alignment[parseInt(all.slice(i, i + wl), 36)]
    const s = f.sizing[parseInt(all.slice(i + wl, i + wl + ws), 36)]
    if (!l || !s) throw new Error(`fixture index ${all.slice(i, i + wl + ws)} has no style`)
    out.push(sortKeys({...l, ...s}))
  }
  return out
}

// One style per line keeps the fixture reviewable and its diffs readable.
const serialize = (f: Fixture) => {
  const lines = (xs: ReadonlyArray<unknown>) => xs.map(x => `    ${JSON.stringify(x)}`).join(',\n')
  const axesLines = Object.entries(f.axes)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(',\n')
  return [
    `{\n  "axes": {\n${axesLines}\n  },`,
    `  "alignment": [\n${lines(f.alignment)}\n  ],`,
    `  "sizing": [\n${lines(f.sizing)}\n  ],`,
    `  "indices": [\n${lines(f.indices)}\n  ]\n}\n`,
  ].join('\n')
}

test('Box2 native styles match the committed fixture for every prop combination', () => {
  if (process.env['KB_UPDATE_BOX2_FIXTURE'] === '1') {
    fs.writeFileSync(fixturePath, serialize(build()))
  }
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`${fixturePath} is missing; generate it with KB_UPDATE_BOX2_FIXTURE=1`)
  }
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Fixture
  expect(fixture.axes).toEqual(jsonAxes())

  const expected = decode(fixture)
  const combos = combinations()
  expect(expected).toHaveLength(combos.length)

  const changed: Array<string> = []
  combos.forEach((c, i) => {
    const now = flatStyle(c)
    if (JSON.stringify(now) !== JSON.stringify(expected[i])) {
      changed.push(`${comboKey(c)}\n      fixture ${JSON.stringify(expected[i])}\n      now     ${JSON.stringify(now)}`)
    }
  })
  if (changed.length) {
    const shown = changed.slice(0, 20).join('\n')
    throw new Error(`${changed.length} of ${combos.length} combinations changed:\n${shown}`)
  }
})

test('the matrix runs the native style path', () => {
  // Desktop styles carry display:flex and collapse to one merged object; native keeps the array.
  expect(flatStyle({direction: 'vertical'})).not.toHaveProperty('display')
  expect(Array.isArray(box2SharedPropsForTest({direction: 'vertical', fullWidth: true}).style)).toBe(true)
})
