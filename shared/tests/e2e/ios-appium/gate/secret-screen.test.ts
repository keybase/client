import {clearSecretOnScreen, failureCapture, markSecretOnScreen, requireNoSecretOnScreen, secretOnScreen} from './secret-screen'

afterEach(() => {
  clearSecretOnScreen('the join field')
  clearSecretOnScreen('the paper key screen')
})

test('nothing marked: steps run and a failure takes its screenshot', () => {
  expect(secretOnScreen()).toBeUndefined()
  expect(() => requireNoSecretOnScreen()).not.toThrow()
  expect(failureCapture(true)).toBe('screenshot')
  expect(failureCapture(false)).toBe('none')
})

test('while a secret is marked, a step refuses and a failure withholds its screenshot', () => {
  markSecretOnScreen('the join field')
  expect(() => requireNoSecretOnScreen()).toThrow('no step while a secret is on screen (the join field)')
  expect(failureCapture(true)).toBe('withheld')
  expect(failureCapture(false)).toBe('none')
  clearSecretOnScreen('the join field')
  expect(failureCapture(true)).toBe('screenshot')
  expect(() => requireNoSecretOnScreen()).not.toThrow()
})

test("a flow's clear leaves another flow's mark in place", () => {
  markSecretOnScreen('the paper key screen')
  markSecretOnScreen('the join field')
  clearSecretOnScreen('the join field')
  expect(secretOnScreen()).toBe('the paper key screen')
  expect(failureCapture(true)).toBe('withheld')
  clearSecretOnScreen('the paper key screen')
  expect(secretOnScreen()).toBeUndefined()
})
