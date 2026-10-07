/// <reference types="jest" />
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError, type CancelReason} from '@/util/errors'
import {ignorePromise} from './utils'

afterEach(() => {
  jest.restoreAllMocks()
})

const settle = async (failure: unknown) => {
  const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
  const logged = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const fails = async () => {
    await Promise.resolve()
    throw failure
  }
  ignorePromise(fails())
  await new Promise(resolve => setTimeout(resolve, 0))
  return {info, logged}
}

test.each(['caller', 'accountChange', 'service'] as const)(
  'a call cancelled by %s is logged as info, not as an error',
  async (reason: CancelReason) => {
    const error = new RPCError('cancelled', T.RPCGen.StatusCode.sccanceled, null, undefined, 'keybase.1.test.call', {
      reason,
      type: 'cancelled',
    })
    const {info, logged} = await settle(error)
    expect(logged).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledWith('ignorePromise cancelled', reason, 'Error code 237 in method keybase.1.test.call')
  }
)

test.each([
  [
    'a lost link',
    new RPCError('lost', 101, null, 'EOF', undefined, {reason: 'disconnect', type: 'cancelled'}),
  ],
  ["the service's error", new RPCError('nope', T.RPCGen.StatusCode.scgeneric)],
  ['a plain Error', new Error('boom')],
])('%s is logged as an error', async (_, error) => {
  const {logged} = await settle(error)
  expect(logged).toHaveBeenCalledWith('ignorePromise error', error)
})
