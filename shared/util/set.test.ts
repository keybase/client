/// <reference types="jest" />
import {intersect} from './set'

test('keeps only the shared members', () => {
  expect([...intersect(new Set([1, 2, 3]), new Set([2, 3, 4]))].sort()).toEqual([2, 3])
})

test('gives the same answer whichever set is larger', () => {
  const small = new Set(['a'])
  const large = new Set(['a', 'b', 'c'])
  expect([...intersect(small, large)]).toEqual(['a'])
  expect([...intersect(large, small)]).toEqual(['a'])
})

test('is empty when nothing overlaps or either side is empty', () => {
  expect(intersect(new Set([1]), new Set([2])).size).toBe(0)
  expect(intersect(new Set<number>(), new Set([1, 2])).size).toBe(0)
  expect(intersect(new Set([1, 2]), new Set<number>()).size).toBe(0)
})

test('returns a new set and does not mutate the inputs', () => {
  const a = new Set([1, 2])
  const b = new Set([2])
  const out = intersect(a, b)
  expect(out).not.toBe(a)
  expect(out).not.toBe(b)
  expect(a.size).toBe(2)
  expect(b.size).toBe(1)
})

test('compares by reference for objects', () => {
  const shared = {}
  expect(intersect(new Set([shared, {}]), new Set([shared])).size).toBe(1)
  expect(intersect(new Set([{}]), new Set([{}])).size).toBe(0)
})
