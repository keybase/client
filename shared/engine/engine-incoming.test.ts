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

test('a rekey refresh with no session is answered and dispatched', () => {
  const actions: Array<unknown> = []
  new Engine(
    () => {},
    () => {},
    a => actions.push(a)
  )
  const response = {error: jest.fn(), result: jest.fn(), seqid: 7}
  incoming!({
    method: 'keybase.1.rekeyUI.refresh',
    param: [{problemSetDevices: {}, sessionID: 0}],
    response,
  } as any)
  expect(response.result).toHaveBeenCalledTimes(1)
  expect(actions).toEqual([expect.objectContaining({type: 'keybase.1.rekeyUI.refresh'})])
})
