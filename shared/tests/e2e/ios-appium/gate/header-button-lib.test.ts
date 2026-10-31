import {measuredButtonAmong} from './header-button-lib'

const screen = {height: 874, width: 402}
const button = {height: 44, width: 70, x: 16, y: 10}
const windowTop = 62

test('the one element at the measured frame, placed by the modal window top, is picked', () => {
  expect(measuredButtonAmong(button, [{...button, x: 300, y: 72}, {...button, y: 72}], screen, windowTop)).toBe(1)
})

test('a same-size button at the same x but another y (a hidden screen behind) is not picked', () => {
  expect(measuredButtonAmong(button, [{...button, y: 20}], screen, windowTop)).toBeUndefined()
  expect(measuredButtonAmong(button, [{...button, y: 20}, {...button, y: 72}], screen, windowTop)).toBe(1)
})

test('two elements at the placed frame make it ambiguous', () => {
  expect(measuredButtonAmong(button, [{...button, y: 72}, {...button, y: 72.5}], screen, windowTop)).toBeUndefined()
})

test('an element below the header band or off screen is not picked', () => {
  expect(measuredButtonAmong({...button, y: 250}, [{...button, y: 312}], screen, windowTop)).toBeUndefined()
  expect(measuredButtonAmong(button, [{...button, y: -5}], screen, -15)).toBeUndefined()
})

test('a measured frame off screen picks nothing', () => {
  expect(measuredButtonAmong({...button, x: -20}, [{...button, x: -20, y: 72}], screen, windowTop)).toBeUndefined()
})

test('an element of another size is not the button', () => {
  expect(measuredButtonAmong(button, [{...button, width: 90, y: 72}], screen, windowTop)).toBeUndefined()
})
