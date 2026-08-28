/// <reference types="jest" />
import {produce} from 'immer'
import {mapFilterByKey, mapGetEnsureValue} from './map'

describe('mapGetEnsureValue', () => {
  test('inserts and returns the default when the key is missing', () => {
    const m = new Map<string, Array<number>>()
    const value = mapGetEnsureValue(m, 'a', [])
    value.push(1)
    expect(m.get('a')).toBe(value)
    expect(m.get('a')).toEqual([1])
  })

  test('returns the existing value and does not overwrite it', () => {
    const existing = [1]
    const m = new Map<string, Array<number>>([['a', existing]])
    expect(mapGetEnsureValue(m, 'a', [2])).toBe(existing)
    expect(m.get('a')).toBe(existing)
  })

  test('treats a stored undefined as missing', () => {
    const m = new Map<string, number | undefined>([['a', undefined]])
    expect(mapGetEnsureValue(m, 'a', 5)).toBe(5)
    expect(m.get('a')).toBe(5)
  })

  test('a stored falsey value is not treated as missing', () => {
    const m = new Map<string, number>([
      ['zero', 0],
      ['nan', Number.NaN],
    ])
    expect(mapGetEnsureValue(m, 'zero', 9)).toBe(0)
    expect(mapGetEnsureValue(m, 'nan', 9)).toBeNaN()
  })

  test('mutates an immer draft in place', () => {
    const before = new Map<string, Array<number>>()
    const after = produce(before, draft => {
      mapGetEnsureValue(draft, 'a', []).push(1)
      mapGetEnsureValue(draft, 'a', []).push(2)
    })
    expect(after.get('a')).toEqual([1, 2])
    expect(before.size).toBe(0)
  })
})

describe('mapFilterByKey', () => {
  test('keeps only the listed keys', () => {
    const m = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    expect([...mapFilterByKey(m, new Set(['a', 'c'])).entries()]).toEqual([
      ['a', 1],
      ['c', 3],
    ])
  })

  test('ignores keys that are not in the map', () => {
    const m = new Map([['a', 1]])
    expect([...mapFilterByKey(m, new Set(['a', 'missing'])).entries()]).toEqual([['a', 1]])
  })

  test('returns a new map and leaves the original alone', () => {
    const m = new Map([['a', 1]])
    const filtered = mapFilterByKey(m, new Set<string>())
    expect(filtered).not.toBe(m)
    expect(filtered.size).toBe(0)
    expect(m.size).toBe(1)
  })

  test('preserves insertion order of the source map', () => {
    const m = new Map([
      ['c', 3],
      ['a', 1],
      ['b', 2],
    ])
    expect([...mapFilterByKey(m, new Set(['a', 'b', 'c'])).keys()]).toEqual(['c', 'a', 'b'])
  })
})
