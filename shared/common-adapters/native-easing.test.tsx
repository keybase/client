/// <reference types="jest" />
import type * as RN from 'react-native'
import type * as NativeEasing from './native-easing'
import {easeInOutEasing, linearEasing} from './native-easing'

test('linearEasing is the identity', () => {
  expect([0, 0.25, 1].map(linearEasing)).toEqual([0, 0.25, 1])
})

test('easeInOutEasing eases in and out, symmetric about the middle', () => {
  expect(easeInOutEasing(0)).toBe(0)
  expect(easeInOutEasing(0.5)).toBe(0.5)
  expect(easeInOutEasing(1)).toBe(1)
  // the ease curve, cubic-bezier(0.42, 0, 1, 1), at 0.5, halved
  expect(easeInOutEasing(0.25)).toBeCloseTo(0.1577, 4)
  expect(easeInOutEasing(0.75)).toBeCloseTo(1 - easeInOutEasing(0.25), 10)
})

test('easeInOutEasing builds its curve on first use, and only once', () => {
  jest.isolateModules(() => {
    const {Easing} = require('react-native') as typeof RN
    const inOut = jest.spyOn(Easing, 'inOut')
    const fresh = require('./native-easing') as typeof NativeEasing
    expect(inOut).not.toHaveBeenCalled()
    fresh.easeInOutEasing(0.3)
    fresh.easeInOutEasing(0.6)
    expect(inOut).toHaveBeenCalledTimes(1)
    inOut.mockRestore()
  })
})
