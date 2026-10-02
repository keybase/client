/// <reference types="jest" />
import {makeDesktopEnginePair} from '@/test/desktop-engine-pair'

test('a renderer call reaches the service through node', () => {
  const pair = makeDesktopEnginePair()
  pair.renderer.invoke('keybase.1.config.getBootstrapStatus', [{}], () => {})
  expect(pair.serviceReceived().map(m => m[2])).toEqual(['keybase.1.config.getBootstrapStatus'])
})

// Both reproduced against the live app (dev Electron + keybase ctl stop/start); fixed by the connection-lifetime change.
test.failing('a renderer call in flight when the service dies settles', async () => {
  const pair = makeDesktopEnginePair()
  const cb = jest.fn()
  pair.renderer.invoke('keybase.1.config.waitForClient', [{clientType: 0, timeout: 120}], cb)
  pair.serviceDies()
  await new Promise(resolve => setImmediate(resolve))
  expect(cb).toHaveBeenCalledTimes(1)
})

test.failing('a renderer call made while the service is down is not sent to the next service before its handshake', () => {
  const pair = makeDesktopEnginePair()
  pair.serviceDies()
  const cb = jest.fn()
  pair.renderer.invoke('keybase.1.config.getBootstrapStatus', [{}], cb)
  pair.serviceComesBack()
  expect(pair.serviceReceived().map(m => m[2])).not.toContain('keybase.1.config.getBootstrapStatus')
  expect(cb).toHaveBeenCalledTimes(1)
})
