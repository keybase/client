/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pickSimulator} from './app.ts'

test('a simulator name maps to its one udid, and a shared name is refused with each udid listed', () => {
  const devices = {
    'iOS-26': [{name: 'iPhoneTest', state: 'Booted', udid: 'A'}],
    'iOS-27': [
      {name: 'iPad (A16)', state: 'Booted', udid: 'B'},
      {name: 'iPad (A16)', state: 'Shutdown', udid: 'C'},
    ],
  }
  assert.equal(pickSimulator(devices, 'iPhoneTest'), 'A')
  assert.throws(() => pickSimulator(devices, 'iPad (A16)'), /2 simulators are named iPad \(A16\) \(B Booted, C Shutdown\); set KB_IOS_UDID/)
  assert.throws(() => pickSimulator(devices, 'nope'), /Simulator not found: nope/)
})
