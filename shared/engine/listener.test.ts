/// <reference types="jest" />
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {installListenerEngine, uninstallListenerEngine} from '@/test/fake-listener-engine'

afterEach(() => {
  uninstallListenerEngine()
  resetAllStores()
})

test('a listener RPC the service fails rejects with the RPCError and its code', async () => {
  const engine = installListenerEngine()
  const ended = T.RPCGen.pgpPgpKeyGenDefaultRpcListener({
    incomingCallMap: {},
    params: {createUids: {ids: [], useDefault: true}},
  }).catch((e: unknown) => e)
  engine.fail('keybase.1.pgp.pgpKeyGenDefault', T.RPCGen.StatusCode.scgeneric, 'boom')
  const err = await ended
  expect(err).toBeInstanceOf(RPCError)
  expect(err).toMatchObject({code: T.RPCGen.StatusCode.scgeneric, desc: 'boom'})
})

test('a listener RPC settled with a non-RPC value still rejects with an Error', async () => {
  const engine = installListenerEngine()
  const ended = T.RPCGen.pgpPgpKeyGenDefaultRpcListener({
    incomingCallMap: {},
    params: {createUids: {ids: [], useDefault: true}},
  }).catch((e: unknown) => e)
  engine.pending('keybase.1.pgp.pgpKeyGenDefault').callback('broken' as never)
  const err = await ended
  expect(err).toBeInstanceOf(Error)
  expect((err as Error).message).toBe('broken')
})
