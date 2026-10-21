/// <reference types="jest" />
import {controlsRightInset} from './window-controls-overlay.desktop'

const overlay = (visible: boolean, x: number, width: number) =>
  Object.assign(new EventTarget(), {getTitlebarAreaRect: () => ({width, x}), visible})

test('no overlay or a hidden one covers nothing', () => {
  expect(controlsRightInset(undefined, 1000)).toBe(0)
  expect(controlsRightInset(overlay(false, 0, 862), 1000)).toBe(0)
})

test('the controls take the space right of the title bar area', () => {
  expect(controlsRightInset(overlay(true, 0, 862), 1000)).toBe(138)
  // controls on both sides (some Linux button layouts): only the right side counts
  expect(controlsRightInset(overlay(true, 90, 772), 1000)).toBe(138)
  expect(controlsRightInset(overlay(true, 0, 861.6), 1000)).toBe(138)
})

test('a title bar area that reaches the right edge covers nothing', () => {
  expect(controlsRightInset(overlay(true, 90, 910), 1000)).toBe(0)
  expect(controlsRightInset(overlay(true, 0, 1001), 1000)).toBe(0)
})
