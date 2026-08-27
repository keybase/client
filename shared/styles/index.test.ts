/// <reference types="jest" />
import type * as StylesIndex from './index'
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
    // toEqual ignores undefined properties, so the override has to be asserted strictly
    expect(collapseStylesDesktop([{color: 'red'}, {color: undefined}])).toStrictEqual({color: undefined})
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

// collapseStyles picks its implementation off isMobile at module load, so the mobile
// branch (the one that actually ships on RN) needs a freshly required copy
describe('collapseStyles on mobile', () => {
  type StylesModule = typeof StylesIndex
  let mobile: StylesModule
  const originalIsMobile = global.isMobile

  beforeAll(() => {
    global.isMobile = true
    jest.resetModules()
    mobile = require('./index') as StylesModule
  })

  afterAll(() => {
    global.isMobile = originalIsMobile
    jest.resetModules()
  })

  test('is undefined when nothing contributes', () => {
    expect(mobile.collapseStyles([])).toBeUndefined()
    expect(mobile.collapseStyles([undefined, null, false, 0, ''])).toBeUndefined()
    expect(mobile.collapseStyles([{}, {}])).toBeUndefined()
  })

  test('returns the same object for a single style so it does not render thrash', () => {
    const only = {color: 'red'}
    expect(mobile.collapseStyles([only])).toBe(only)
    expect(mobile.collapseStyles([only, false, undefined])).toBe(only)
  })

  test('hands the array itself to RN rather than merging', () => {
    const styles = [{color: 'red'}, {width: 1}]
    expect(mobile.collapseStyles(styles)).toBe(styles)
  })

  test('keeps falsey entries in the array it hands back', () => {
    const styles = [{color: 'red'}, false, {width: 1}]
    expect(mobile.collapseStyles(styles)).toBe(styles)
  })

  test('normalize/unnormalizePath add and strip the file scheme', () => {
    expect(mobile.normalizePath('/tmp/a.png')).toBe('file:///tmp/a.png')
    expect(mobile.normalizePath('file:///tmp/a.png')).toBe('file:///tmp/a.png')
    expect(mobile.unnormalizePath('file:///tmp/a.png')).toBe('/tmp/a.png')
    expect(mobile.unnormalizePath('/tmp/a.png')).toBe('/tmp/a.png')
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

describe('escaping a local file path for a media uri, on mobile', () => {
  type StylesModule = typeof StylesIndex
  let mobile: StylesModule
  const originalIsMobile = global.isMobile

  beforeAll(() => {
    global.isMobile = true
    jest.resetModules()
    mobile = require('./index') as StylesModule
  })

  afterAll(() => {
    global.isMobile = originalIsMobile
    jest.resetModules()
  })

  // urlEscapeFilePath only escapes a path that already carries the file:// prefix,
  // and normalizePath is what adds it, so callers must normalize first
  test('normalizing before escaping escapes the whole path', () => {
    expect(mobile.urlEscapeFilePath(mobile.normalizePath('/tmp/my dir/my clip.mp4'))).toBe(
      'file:///tmp/my%20dir/my%20clip.mp4'
    )
  })

  test('escaping before normalizing leaves the path unescaped', () => {
    expect(mobile.normalizePath(mobile.urlEscapeFilePath('/tmp/my dir/my clip.mp4'))).toBe(
      'file:///tmp/my dir/my clip.mp4'
    )
  })
})
