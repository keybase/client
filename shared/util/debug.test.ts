/// <reference types="jest" />
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from './errors'
import {wrapErrors} from './debug'

afterEach(() => {
  jest.restoreAllMocks()
})

const run = async (failure: unknown) => {
  const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
  const logged = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const f = wrapErrors(async () => {
    await Promise.resolve()
    throw failure
  }, 'work')
  await expect(f()).rejects.toBe(failure)
  return {info, logged}
}

test('a cancelled call is logged as info and still rethrown', async () => {
  const {info, logged} = await run(
    new RPCError('cancelled', T.RPCGen.StatusCode.sccanceled, null, undefined, undefined, {
      reason: 'accountChange',
      type: 'cancelled',
    })
  )
  expect(logged).not.toHaveBeenCalled()
  expect(info).toHaveBeenCalledWith('Cancelled wrapped call', 'work', 'accountChange')
})

test('any other failure is logged as an error and rethrown', async () => {
  const {logged} = await run(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
  expect(logged.mock.calls[0]?.slice(0, 2)).toEqual(['Error in wrapped call', 'work'])
})
