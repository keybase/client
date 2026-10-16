/// <reference types="jest" />
// The jest react-native mock has no Easing; this stands in with marked curves.
jest.mock('react-native', () => ({
  Easing: {
    ease: jest.fn((t: number) => t * t),
    inOut: jest.fn((f: (t: number) => number) => (t: number) => f(t) + 1000),
    linear: jest.fn((t: number) => t + 100),
  },
}))

import {Easing} from 'react-native'
import {easeInOutEasing, linearEasing} from './native-easing'

const {inOut} = Easing as unknown as {inOut: jest.Mock}

test('linearEasing is Easing.linear', () => {
  expect([0, 0.25].map(linearEasing)).toEqual([100, 100.25])
})

test('easeInOutEasing is inOut(ease), built on first use and only once', () => {
  expect(inOut).not.toHaveBeenCalled()
  expect([0.5, 0].map(easeInOutEasing)).toEqual([1000.25, 1000])
  easeInOutEasing(0.3)
  expect(inOut).toHaveBeenCalledTimes(1)
})
