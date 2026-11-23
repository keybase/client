/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {approveKeybaseLinks} from './sim-links.mts'

// From iOS 27 a simulator asks "Open in “Keybase”?" for every simctl openurl, and the answer is not
// remembered; an approval in launchservices' defaults for simctl's opener skips the ask.
test('approveKeybaseLinks approves the keybase scheme and the bundle id for simctl openurl', () => {
  const calls: Array<ReadonlyArray<string>> = []
  approveKeybaseLinks('U', (file, args) => {
    calls.push([file, ...args])
    return ''
  })
  assert.deepEqual(calls, [
    ['xcrun', 'simctl', 'spawn', 'U', 'defaults', 'write', 'com.apple.launchservices.schemeapproval', 'com.apple.CoreSimulator.CoreSimulatorBridge-->keybase', '-string', 'keybase.ios'],
    ['xcrun', 'simctl', 'spawn', 'U', 'defaults', 'write', 'com.apple.launchservices.schemeapproval', 'com.apple.CoreSimulator.CoreSimulatorBridge-->keybase.ios', '-string', 'keybase.ios'],
  ])
})
