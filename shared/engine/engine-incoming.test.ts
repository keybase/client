/// <reference types="jest" />
import type {PayloadType} from './rpc-transport'

let incoming: ((p: PayloadType) => void) | undefined
jest.mock('./index.platform', () => ({
  createClient: (inc: (p: PayloadType) => void) => {
    incoming = inc
    return {invoke: jest.fn(), transport: {}}
  },
  resetClient: jest.fn(),
  rpcLog: jest.fn(),
}))

import {Engine} from '.'

const makeEngine = () => {
  const actions: Array<unknown> = []
  new Engine(
    () => {},
    () => {},
    a => actions.push(a)
  )
  return actions
}

test('a rekey refresh with no session is answered and dispatched', () => {
  const actions = makeEngine()
  const response = {error: jest.fn(), result: jest.fn(), seqid: 7}
  const param = {problemSetDevices: {}, sessionID: 0}
  incoming!({method: 'keybase.1.rekeyUI.refresh', param: [param], response})
  expect(response.result).toHaveBeenCalledTimes(1)
  expect(actions).toEqual([expect.objectContaining({type: 'keybase.1.rekeyUI.refresh'})])
})

// Go reads a nil result as session id 0, so later rekey calls carry no session and take the
// auto-answered path above. Answered here on every platform, with or without a listener.
test('delegateRekeyUI is answered by the engine with no value', () => {
  const actions = makeEngine()
  const response = {error: jest.fn(), result: jest.fn(), seqid: 8}
  incoming!({method: 'keybase.1.rekeyUI.delegateRekeyUI', param: [{}], response})
  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith()
  expect(response.error).not.toHaveBeenCalled()
  expect(actions).toEqual([
    expect.objectContaining({
      payload: {params: {}},
      type: 'keybase.1.rekeyUI.delegateRekeyUI',
    }),
  ])
})

test('a oneway rekeySendEvent with session 0 is dispatched', () => {
  const actions = makeEngine()
  const param = {event: {eventType: 0}, sessionID: 0}
  expect(() => incoming!({method: 'keybase.1.rekeyUI.rekeySendEvent', param: [param]})).not.toThrow()
  expect(actions).toEqual([
    expect.objectContaining({
      payload: {params: param},
      type: 'keybase.1.rekeyUI.rekeySendEvent',
    }),
  ])
})
