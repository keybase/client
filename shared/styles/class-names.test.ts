/// <reference types="jest" />
import classNames from './class-names'

test('joins string arguments and skips falsey values', () => {
  expect(classNames('alpha', undefined, false, '', null, 'beta')).toBe('alpha beta')
})

test('includes truthy object-map keys in insertion order', () => {
  expect(
    classNames('alpha', {
      beta: true,
      delta: undefined,
      gamma: true,
    })
  ).toBe('alpha beta gamma')
})

test('flattens arrays of supported values', () => {
  expect(
    classNames(['alpha', undefined, {beta: true, gamma: false}, ['delta', false]], 'epsilon')
  ).toBe('alpha beta delta epsilon')
})

test('only includes own enumerable object-map keys', () => {
  const proto = {shared: true}
  const value = Object.create(proto) as Record<string, boolean>

  value['local'] = true

  expect(classNames(value)).toBe('local')
})

test('returns an empty string when nothing contributes a class name', () => {
  expect(classNames(undefined, false, null, '', {})).toBe('')
})
