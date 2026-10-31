import {measuredButtonAmong} from './header-button-lib'

const screen = {height: 874, width: 402}
const button = {height: 44, width: 70, x: 16, y: 10}

test('the one element the measured button matches is picked, down from the modal window', () => {
  expect(measuredButtonAmong(button, [{...button, x: 300}, {...button, y: 72}], screen)).toBe(1)
})

test('two elements at the measured button make it ambiguous', () => {
  expect(measuredButtonAmong(button, [{...button, y: 72}, {...button, y: 80}], screen)).toBeUndefined()
})

test('an element below the header band or off screen is not picked', () => {
  expect(measuredButtonAmong(button, [{...button, y: 300}], screen)).toBeUndefined()
  expect(measuredButtonAmong(button, [{...button, y: -5}], screen)).toBeUndefined()
})

test('a measured frame off screen picks nothing', () => {
  expect(measuredButtonAmong({...button, x: -20}, [{...button, x: -20}], screen)).toBeUndefined()
})

test('an element of another size is not the button', () => {
  expect(measuredButtonAmong(button, [{...button, width: 90, y: 72}], screen)).toBeUndefined()
})
