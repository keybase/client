/// <reference types="jest" />
import type * as Styles from '@/styles'
import {allPositions, heightVar, offsetVar, popupPlacement, widthVar, type Placement} from './placement.desktop'

const VW = 1000
const VH = 700

type Rect = {left: number; top: number; width: number; height: number}
type Case = {
  anchor: Rect
  width: number
  height: number
  position: Styles.Position
  fallbacks?: ReadonlyArray<Styles.Position>
  matchDimension?: boolean
  offset?: number
}

// The placement the JS positioner computed before anchor positioning replaced it: the position,
// then each fallback in order, keeping the first inside the viewport, else pushing the last one
// back into it by twice the offset.
const previousPlacement = (c: Case) => {
  const {anchor: a, width: w, height: h, offset = 0} = c
  const place = (position: Styles.Position) => {
    let left: number
    let top: number
    if (position.includes('right')) {
      left = VW - Math.round(VW - (a.left + a.width) + offset) - w
    } else if (position.includes('left')) {
      left = Math.round(a.left + offset)
    } else if (c.matchDimension) {
      left = Math.round(a.left)
    } else {
      left = Math.round(a.left + (a.width - w) / 2)
    }
    if (position.includes('top')) {
      top = VH - Math.round(VH - a.top - offset) - h
    } else if (position.includes('bottom')) {
      top = Math.round(a.top + a.height - offset)
    } else {
      top = Math.round(a.top + a.height - (a.height + h) / 2)
      if (!c.matchDimension && position.includes('right')) {
        left += w + 8
      } else if (!c.matchDimension && position.includes('left')) {
        left -= w + 8
      }
    }
    return {left, top}
  }
  const inView = (p: {left: number; top: number}) => p.left >= 0 && p.top >= 0 && p.left + w <= VW && p.top + h <= VH
  let placed = place(c.position)
  for (const fallback of c.fallbacks ?? allPositions) {
    if (inView(placed)) {
      break
    }
    placed = place(fallback)
  }
  if (!inView(placed)) {
    const push = (at: number, size: number, max: number) =>
      at < 0 ? 2 * offset : at + size > max ? max - size - 2 * offset : at
    placed = {left: push(placed.left, w, VW), top: push(placed.top, h, VH)}
  }
  return placed
}

// CSS round() rounds half up, like Math.round
const cssFunctions: Record<string, (...args: Array<number>) => number> = {
  calc: v => v,
  max: Math.max,
  round: (v, step) => Math.round(v / step) * step,
  sign: Math.sign,
}

// Evaluates arithmetic over numbers and the functions above
const calculate = (expression: string) => {
  const tokens = expression.match(/\d*\.?\d+|[a-z]+|[-+*/(),]/g) ?? []
  let i = 0
  const next = () => tokens[i++] ?? ''
  const sum = (): number => {
    let value = product()
    while (tokens[i] === '+' || tokens[i] === '-') {
      value = next() === '+' ? value + product() : value - product()
    }
    return value
  }
  const product = (): number => {
    let value = unary()
    while (tokens[i] === '*' || tokens[i] === '/') {
      value = next() === '*' ? value * unary() : value / unary()
    }
    return value
  }
  const unary = (): number => {
    const token = next()
    if (token === '-') {
      return -unary()
    }
    if (token === '(') {
      const value = sum()
      next()
      return value
    }
    const fn = cssFunctions[token]
    if (fn) {
      next()
      const args = [sum()]
      while (next() === ',') {
        args.push(sum())
      }
      return fn(...args)
    }
    return Number(token)
  }
  return sum()
}

// Evaluates the CSS math this module emits, as the browser would for one inset
const evaluate = (expression: string, c: Case, side: 'top' | 'right' | 'bottom' | 'left') => {
  const horizontal = side === 'left' || side === 'right'
  const extent = horizontal ? VW : VH
  const {anchor: a} = c
  const coordinates: Record<string, number> = horizontal
    ? {center: a.left + a.width / 2, left: a.left, right: a.left + a.width}
    : {bottom: a.top + a.height, center: a.top + a.height / 2, top: a.top}
  const vars: Record<string, number> = {
    [heightVar]: c.height,
    [offsetVar]: c.offset ?? 0,
    [widthVar]: c.width,
  }
  return calculate(
    expression
      .replace(/var\((--[\w-]+), 0px\)/g, (_, name: string) => `(${vars[name] ?? 0})`)
      // anchor() measures from the side of the property it is in
      .replace(/anchor\((\w+)\)/g, (_, s: string) => {
        const at = coordinates[s] ?? NaN
        return `(${side === 'right' || side === 'bottom' ? extent - at : at})`
      })
      .replace(/100%/g, `(${extent})`)
      .replace(/px/g, '')
  )
}

// Where the browser puts the popup: the base, then each option, keeping the first whose box fits
// the space its insets leave
const anchoredPlacement = (c: Case) => {
  const {base, rules, tryOptions} = popupPlacement(c.position, !!c.matchDimension, c.fallbacks)
  const options = tryOptions.split(', ').map(name => {
    const rule = rules.split('\n').find(r => r.startsWith(`@position-try ${name} `))
    if (!rule) {
      throw new Error(`no rule for ${name}`)
    }
    const value = (property: string) => new RegExp(`[{;] ${property}: ([^;]+);`).exec(rule)?.[1] ?? ''
    return {
      alignSelf: value('align-self'),
      bottom: value('bottom'),
      justifySelf: value('justify-self'),
      left: value('left'),
      right: value('right'),
      top: value('top'),
      width: value('width'),
    }
  })
  // Chromium tries at most five options
  expect(options.length).toBeLessThanOrEqual(5)
  const layout = (p: Placement) => {
    const stretched = p.left === 'anchor(left)'
    const left = stretched ? c.anchor.left : evaluate(p.left, c, 'left')
    const right = VW - evaluate(p.right, c, 'right')
    const top = evaluate(p.top, c, 'top')
    const bottom = VH - evaluate(p.bottom, c, 'bottom')
    const fits = (stretched || left + c.width <= right) && top + c.height <= bottom
    return {fits, left, top}
  }
  const chosen = [base, ...options].map(layout).find(l => l.fits) ?? layout(base)
  return {left: chosen.left, top: chosen.top}
}

const anchors: ReadonlyArray<Rect> = [
  {height: 20, left: 200, top: 300, width: 50},
  {height: 30, left: 0, top: 0, width: 80},
  {height: 24, left: 940, top: 660, width: 60},
  {height: 40, left: 480, top: 10, width: 40},
  {height: 18, left: 10, top: 640, width: 300},
  {height: 100, left: 600, top: 280, width: 200},
]
const sizes: ReadonlyArray<[number, number]> = [
  [100, 60],
  [250, 400],
  [600, 120],
  [180, 650],
  [960, 40],
]
const fallbackLists: ReadonlyArray<ReadonlyArray<Styles.Position> | undefined> = [
  undefined,
  [],
  ['bottom center'],
  ['top center', 'bottom center'],
  ['bottom center', 'left center'],
  ['left center', 'top left'],
]

describe('popupPlacement', () => {
  test('places every position as the JS positioner did, with the same fallbacks and push', () => {
    for (const anchor of anchors) {
      for (const [width, height] of sizes) {
        for (const position of allPositions) {
          for (const fallbacks of fallbackLists) {
            for (const offset of [0, 4, 10]) {
              const c = {anchor, fallbacks, height, offset, position, width}
              expect({...c, placed: anchoredPlacement(c)}).toEqual({...c, placed: previousPlacement(c)})
            }
          }
        }
      }
    }
  })

  test('matchDimension spans the anchor and only picks where it goes vertically', () => {
    for (const anchor of anchors) {
      for (const height of [60, 400, 650]) {
        for (const fallbacks of [['bottom center'], ['top center', 'bottom center'], []] as const) {
          const c = {anchor, fallbacks, height, matchDimension: true, position: 'top center', width: anchor.width} as const
          expect({...c, placed: anchoredPlacement(c)}).toEqual({...c, placed: previousPlacement(c)})
        }
      }
    }
    const {base} = popupPlacement('top center', true, undefined)
    expect(base.left).toBe('anchor(left)')
    expect(base.right).toBe('anchor(right)')
  })

  test('every position list fits in the five options Chromium tries', () => {
    for (const position of allPositions) {
      for (const fallbacks of fallbackLists) {
        const {rules, tryOptions} = popupPlacement(position, false, fallbacks)
        const names = tryOptions.split(', ')
        expect(names.length).toBeLessThanOrEqual(5)
        for (const name of names) {
          expect(rules).toContain(`@position-try ${name} {`)
        }
      }
    }
  })

  test('runs of positions sharing an axis share an option, and the last one is pushed', () => {
    expect(popupPlacement('bottom left', false, undefined).tryOptions).toBe(
      [
        '--kb-popup-top-left_top-right',
        '--kb-popup-bottom-right_bottom-left',
        '--kb-popup-right-center_left-center',
        '--kb-popup-top-center_bottom-center_center-center',
        '--kb-popup-center-center-pushed',
      ].join(', ')
    )
    expect(popupPlacement('top center', false, ['bottom center', 'left center']).tryOptions).toBe(
      '--kb-popup-bottom-center, --kb-popup-left-center-pushed'
    )
    expect(popupPlacement('top center', true, []).tryOptions).toBe('--kb-popup-top-center-match-pushed')
  })

  test('builds each placement once', () => {
    const fallbacks = ['top left', 'bottom left'] as const
    expect(popupPlacement('top left', false, [...fallbacks])).toBe(popupPlacement('top left', false, [...fallbacks]))
    expect(popupPlacement('top left', false, undefined)).toBe(popupPlacement('top left', false, undefined))
    expect(popupPlacement('top left', false, ['top left'])).not.toBe(popupPlacement('top left', false, [...fallbacks]))
    expect(popupPlacement('top left', false, [])).not.toBe(popupPlacement('top left', false, undefined))
    expect(popupPlacement('top left', true, undefined)).not.toBe(popupPlacement('top left', false, undefined))
  })
})
