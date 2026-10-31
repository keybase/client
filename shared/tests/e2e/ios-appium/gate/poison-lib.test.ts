import {clearGatePoison, gatePoisoned, poisonGate, requireGateNotPoisoned} from './poison-lib'

afterEach(() => {
  clearGatePoison('the proxy settings')
  clearGatePoison('lockdown mode')
})

test('an unpoisoned gate runs', () => {
  expect(gatePoisoned()).toBeUndefined()
  expect(() => requireGateNotPoisoned()).not.toThrow()
})

test('a poisoned gate refuses with every owner action, until each setting is put back', () => {
  poisonGate('the proxy settings', 'choose No proxy in Settings > Advanced')
  poisonGate('lockdown mode', 'turn it off in Settings > Advanced')
  expect(() => requireGateNotPoisoned()).toThrow(
    /^refusing to run: an earlier flow could not put back the proxy settings \(choose No proxy in Settings > Advanced\); lockdown mode \(turn it off in Settings > Advanced\), /
  )
  clearGatePoison('the proxy settings')
  expect(gatePoisoned()).toMatch(/lockdown mode/)
  expect(gatePoisoned()).not.toMatch(/proxy/)
  clearGatePoison('lockdown mode')
  expect(() => requireGateNotPoisoned()).not.toThrow()
})

test('poisoning the same setting twice keeps one entry, with the latest owner action', () => {
  poisonGate('lockdown mode', 'first')
  poisonGate('lockdown mode', 'second')
  expect(gatePoisoned()).toBe(
    'refusing to run: an earlier flow could not put back lockdown mode (second), so the phone may be broken for every later flow; put it back by hand and run the gate again'
  )
})
