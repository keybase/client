/// <reference types="jest" />
import {fitContainer} from './fitContainer'

const container = {height: 200, width: 100}

test('fills the width when the resulting height fits', () => {
  expect(fitContainer(1, container)).toEqual({height: 100, width: 100})
  expect(fitContainer(2, container)).toEqual({height: 50, width: 100})
})

test('falls back to filling the height when the width-first fit is too tall', () => {
  expect(fitContainer(0.25, container)).toEqual({height: 200, width: 50})
})

test('exactly filling both dimensions stays width-first', () => {
  expect(fitContainer(0.5, container)).toEqual({height: 200, width: 100})
})

test('preserves the aspect ratio of the result', () => {
  for (const ar of [0.1, 0.5, 1, 1.777, 4]) {
    const out = fitContainer(ar, container)
    expect(out.width / out.height).toBeCloseTo(ar, 10)
    expect(out.width).toBeLessThanOrEqual(container.width + 1e-9)
    expect(out.height).toBeLessThanOrEqual(container.height + 1e-9)
  }
})

test('a square container just applies the ratio', () => {
  expect(fitContainer(2, {height: 100, width: 100})).toEqual({height: 50, width: 100})
  expect(fitContainer(0.5, {height: 100, width: 100})).toEqual({height: 100, width: 50})
})

test('a zero sized container collapses to zero', () => {
  expect(fitContainer(1, {height: 0, width: 0})).toEqual({height: 0, width: 0})
})
