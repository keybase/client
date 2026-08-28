/// <reference types="jest" />
import {findLast} from './arrays'

// findLast has a hand rolled fallback for platforms without Array.prototype.findLast.
// An array-like without that method exercises it while the real array exercises the native path.
const arrayLike = <T>(items: ReadonlyArray<T>): ReadonlyArray<T> =>
  ({...items, length: items.length}) as unknown as ReadonlyArray<T>

describe.each([
  ['native path', <T,>(items: ReadonlyArray<T>) => items],
  ['fallback path', arrayLike],
])('findLast (%s)', (_name, make) => {
  test('returns the last matching element, not the first', () => {
    expect(findLast(make([1, 2, 3, 4]), n => n % 2 === 0)).toBe(4)
  })

  test('returns undefined when nothing matches', () => {
    expect(findLast(make([1, 3, 5]), n => n % 2 === 0)).toBeUndefined()
  })

  test('returns undefined for an empty list', () => {
    expect(findLast(make<number>([]), () => true)).toBeUndefined()
  })

  test('works when only the first element matches', () => {
    expect(findLast(make(['a', 'b', 'c']), s => s === 'a')).toBe('a')
  })

  test('finds objects by reference', () => {
    const first = {id: 1}
    const second = {id: 1}
    expect(findLast(make([first, second]), o => o.id === 1)).toBe(second)
  })
})

test('the fallback scans from the end and stops at the first hit', () => {
  const seen: Array<number> = []
  findLast(arrayLike([1, 2, 3, 4]), n => {
    seen.push(n)
    return n === 3
  })
  expect(seen).toEqual([4, 3])
})
