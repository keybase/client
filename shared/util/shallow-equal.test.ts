/// <reference types="jest" />
import shallowEqual from './shallow-equal'

test('returns true for the same reference', () => {
  const value = {a: 1}

  expect(shallowEqual(value, value)).toBe(true)
})

test('returns false when either side is null or a primitive', () => {
  expect(shallowEqual(null, {})).toBe(false)
  expect(shallowEqual({}, null)).toBe(false)
  expect(shallowEqual(1, 1)).toBe(true)
  expect(shallowEqual(1, 2)).toBe(false)
  expect(shallowEqual(1, {})).toBe(false)
})

test('compares arrays shallowly', () => {
  expect(shallowEqual([1, 2], [1, 2])).toBe(true)
  expect(shallowEqual([1, {nested: true}], [1, {nested: true}])).toBe(false)
})

test('only compares own enumerable keys', () => {
  const proto = {shared: 1}
  const a = Object.create(proto) as {local?: number}
  const b = Object.create(proto) as {local?: number}

  a.local = 2
  b.local = 2

  expect(shallowEqual(a, b)).toBe(true)

  const withOwnShared = {shared: 1, local: 2}
  expect(shallowEqual(a, withOwnShared)).toBe(false)
})

test('ignores non-enumerable properties', () => {
  const a = {visible: 1}
  const b = {visible: 1}

  Object.defineProperty(a, 'hidden', {enumerable: false, value: 1})
  Object.defineProperty(b, 'hidden', {enumerable: false, value: 2})

  expect(shallowEqual(a, b)).toBe(true)
})

test('uses strict equality for leaf values', () => {
  expect(shallowEqual({a: Number.NaN}, {a: Number.NaN})).toBe(false)
  expect(shallowEqual({a: undefined}, {a: undefined})).toBe(true)
})
