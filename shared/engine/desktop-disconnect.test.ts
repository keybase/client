/// <reference types="jest" />
import {makeDesktopEnginePair, type DesktopEnginePair} from '@/test/desktop-engine-pair'
import {tick} from '@/test/flush'
import {StatusCode} from '@/constants/rpc/rpc-gen'

const methodsReceived = (pair: DesktopEnginePair) => pair.serviceReceived().map(m => m[2])

test('a renderer call reaches the service through node, and its answer comes back', async () => {
  const pair = makeDesktopEnginePair()
  const cb = jest.fn()
  pair.renderer.invoke('keybase.1.config.getBootstrapStatus', [{}], cb)
  await tick()
  expect(methodsReceived(pair)).toEqual(['keybase.1.config.getBootstrapStatus'])
  const [, seqid] = pair.serviceReceived()[0]!
  pair.serviceSends([1, seqid, null, {ok: true}])
  await tick()
  expect(cb).toHaveBeenCalledWith(null, {ok: true})
})

test('after the service comes back a fresh call reaches the new service and is answered', async () => {
  const pair = makeDesktopEnginePair()
  pair.serviceDies()
  pair.serviceComesBack()
  await tick()
  const cb = jest.fn()
  pair.renderer.invoke('keybase.1.config.getBootstrapStatus', [{}], cb)
  await tick()
  expect(methodsReceived(pair)).toEqual(['keybase.1.config.getBootstrapStatus'])
  const [, seqid] = pair.serviceReceived()[0]!
  pair.serviceSends([1, seqid, null, {ok: true}])
  await tick()
  expect(cb).toHaveBeenCalledWith(null, {ok: true})
})

test('the app is told once per link change', async () => {
  const pair = makeDesktopEnginePair()
  pair.serviceDies()
  pair.serviceComesBack()
  await tick()
  pair.serviceDies()
  pair.serviceComesBack()
  await tick()
  expect(pair.linkChanges).toEqual([true, false, true, false, true])
})

test('the app hearing its listeners are ready again is not told the link is up again', () => {
  const pair = makeDesktopEnginePair()
  pair.listenersReadyAgain()
  expect(pair.linkChanges).toEqual([true])
})

test('a renderer call still crossing IPC when the service restarts never reaches the new service', async () => {
  const pair = makeDesktopEnginePair()
  pair.renderer.invoke('keybase.1.config.getBootstrapStatus', [{}], () => {})
  pair.serviceDies()
  pair.serviceComesBack()
  await tick()
  expect(methodsReceived(pair)).toEqual([])
})

// Each pins a desktop disconnect bug seen in the live app when the service stops and restarts.
test('a renderer call in flight when the service dies settles', async () => {
  const pair = makeDesktopEnginePair()
  const cb = jest.fn()
  pair.renderer.invoke('keybase.1.config.waitForClient', [{clientType: 0, timeout: 120}], cb)
  pair.serviceDies()
  await tick()
  expect(cb).toHaveBeenCalledTimes(1)
})

test('a renderer call made while the service is down is not sent to the next service before its handshake', () => {
  const pair = makeDesktopEnginePair()
  pair.serviceDies()
  const cb = jest.fn()
  pair.renderer.invoke('keybase.1.config.getBootstrapStatus', [{}], cb)
  pair.serviceComesBack()
  expect(pair.serviceReceived().map(m => m[2])).not.toContain('keybase.1.config.getBootstrapStatus')
  expect(cb).toHaveBeenCalledTimes(1)
})

test('a service restarting twice in quick succession fails a call in flight once and reaches neither new service with it', async () => {
  const pair = makeDesktopEnginePair()
  const inFlight = jest.fn()
  pair.renderer.invoke('keybase.1.config.waitForClient', [{clientType: 0, timeout: 120}], inFlight)
  pair.serviceDies()
  pair.serviceComesBack()
  pair.serviceDies()
  pair.serviceComesBack()
  await tick()
  expect(inFlight).toHaveBeenCalledTimes(1)
  expect(inFlight).toHaveBeenCalledWith({code: StatusCode.sccanceled, desc: 'The service connection was lost'}, {})
  expect(methodsReceived(pair)).toEqual([])
  expect(pair.linkChanges).toEqual([true, false, true, false, true])
})

test('a renderer call made once it knows the service is down is refused at once and never sent', async () => {
  const pair = makeDesktopEnginePair()
  pair.serviceDies()
  await tick()
  const cb = jest.fn()
  pair.renderer.invoke('keybase.1.config.getBootstrapStatus', [{}], cb)
  expect(cb).toHaveBeenCalledTimes(1)
  pair.serviceComesBack()
  await tick()
  expect(methodsReceived(pair)).toEqual([])
  expect(cb).toHaveBeenCalledTimes(1)
})

test('link changes before the app has its listeners ready are not announced', async () => {
  const pair = makeDesktopEnginePair({listenersReady: false})
  pair.serviceDies()
  await tick()
  expect(pair.linkChanges).toEqual([])
  pair.serviceComesBack()
  await tick()
  pair.listenersReadyAgain()
  expect(pair.linkChanges).toEqual([true])
})
