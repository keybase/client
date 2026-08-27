/// <reference types="jest" />
import {collapseStyles, collapseStylesDesktop, normalizePath, padding, unnormalizePath} from './index'

describe('collapseStylesDesktop', () => {
  test('is undefined when nothing contributes', () => {
    expect(collapseStylesDesktop([])).toBeUndefined()
    expect(collapseStylesDesktop([undefined, null, false, 0, ''])).toBeUndefined()
  })

  test('treats an empty object as nothing', () => {
    expect(collapseStylesDesktop([{}])).toBeUndefined()
    expect(collapseStylesDesktop([{}, {}])).toBeUndefined()
  })

  test('returns the same object for a single style so it does not render thrash', () => {
    const only = {color: 'red'}
    expect(collapseStylesDesktop([only])).toBe(only)
    expect(collapseStylesDesktop([only, false, undefined])).toBe(only)
  })

  test('merges several styles', () => {
    expect(collapseStylesDesktop([{color: 'red'}, {width: 1}])).toEqual({color: 'red', width: 1})
  })

  test('later styles win', () => {
    expect(collapseStylesDesktop([{color: 'red'}, {color: 'blue'}])).toEqual({color: 'blue'})
  })

  test('a key set to undefined still counts as a style', () => {
    const only = {color: undefined}
    expect(collapseStylesDesktop([only])).toBe(only)
  })

  test('an undefined value from a later style overrides an earlier one', () => {
    expect(collapseStylesDesktop([{color: 'red'}, {color: undefined}])).toEqual({color: undefined})
  })

  test('flattens one level of nesting when merging', () => {
    expect(collapseStylesDesktop([[{color: 'red'}], {width: 1}])).toEqual({color: 'red', width: 1})
  })

  test('skips falsey entries while merging', () => {
    expect(collapseStylesDesktop([{color: 'red'}, false, {width: 1}, undefined])).toEqual({
      color: 'red',
      width: 1,
    })
  })
})

test('collapseStyles is the desktop implementation off mobile', () => {
  expect(isMobile).toBe(false)
  const only = {color: 'red'}
  expect(collapseStyles([only])).toBe(only)
  expect(collapseStyles([{color: 'red'}, {width: 1}])).toEqual({color: 'red', width: 1})
  expect(collapseStyles([undefined, false])).toBeUndefined()
})

describe('padding', () => {
  test('mirrors css shorthand for one, two, three and four arguments', () => {
    expect(padding(1)).toEqual({paddingBottom: 1, paddingLeft: 1, paddingRight: 1, paddingTop: 1})
    expect(padding(1, 2)).toEqual({paddingBottom: 1, paddingLeft: 2, paddingRight: 2, paddingTop: 1})
    expect(padding(1, 2, 3)).toEqual({paddingBottom: 3, paddingLeft: 2, paddingRight: 2, paddingTop: 1})
    expect(padding(1, 2, 3, 4)).toEqual({paddingBottom: 3, paddingLeft: 4, paddingRight: 2, paddingTop: 1})
  })

  test('a zero right is respected rather than falling back to top', () => {
    expect(padding(4, 0)).toEqual({paddingBottom: 4, paddingLeft: 0, paddingRight: 0, paddingTop: 4})
  })
})

test('normalize/unnormalizePath are identity off mobile', () => {
  expect(normalizePath('/tmp/a.png')).toBe('/tmp/a.png')
  expect(unnormalizePath('file:///tmp/a.png')).toBe('file:///tmp/a.png')
})
