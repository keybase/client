/// <reference types="jest" />
import {controlsInsets, noInsets, sameInsets} from './window-controls-overlay.desktop'

const rect = (x: number, width: number, height = 40) => ({height, width, x})

test('a hidden overlay covers nothing', () => {
  expect(controlsInsets(false, rect(0, 862), 1000)).toBe(noInsets)
})

test('controls on the right take the space right of the title bar area', () => {
  expect(controlsInsets(true, rect(0, 862), 1000)).toEqual({height: 40, left: 0, right: 138})
  expect(controlsInsets(true, rect(0, 861.6, 39.6), 1000)).toEqual({height: 40, left: 0, right: 138})
})

test('controls on the left take the space left of the title bar area', () => {
  expect(controlsInsets(true, rect(110, 890, 36), 1000)).toEqual({height: 36, left: 110, right: 0})
})

test('controls on both sides reserve both', () => {
  expect(controlsInsets(true, rect(90, 772), 1000)).toEqual({height: 40, left: 90, right: 138})
})

test('a title bar area spanning the whole width covers nothing', () => {
  expect(controlsInsets(true, rect(0, 1000), 1000)).toBe(noInsets)
  expect(controlsInsets(true, rect(-1, 1002), 1000)).toBe(noInsets)
})

test('insets compare by value', () => {
  expect(sameInsets({height: 40, left: 0, right: 138}, {height: 40, left: 0, right: 138})).toBe(true)
  expect(sameInsets({height: 40, left: 0, right: 138}, {height: 36, left: 0, right: 138})).toBe(false)
  expect(sameInsets(noInsets, {height: 40, left: 90, right: 0})).toBe(false)
})
