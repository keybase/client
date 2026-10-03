/** @jest-environment jsdom */
/// <reference types="jest" />
import {expect, jest, test} from '@jest/globals'
import {renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {RPCError, type CancelReason} from './errors'
import useRPC from './use-rpc'

const cancelledBy = (reason: CancelReason) =>
  new RPCError('cancelled', T.RPCGen.StatusCode.sccanceled, null, undefined, undefined, {reason, type: 'cancelled'})

const submitRejecting = async (error: unknown) => {
  const call = jest.fn<() => Promise<void>>().mockRejectedValue(error)
  const {result} = renderHook(() => useRPC(call))
  const setError = jest.fn()
  result.current([], () => {}, setError)
  await new Promise(resolve => setTimeout(resolve, 0))
  return setError
}

// The client cancelled it, so the action did not fail
test.each(['caller', 'accountChange', 'service'] as const)('a call cancelled by %s does not reach setError', async reason => {
  expect(await submitRejecting(cancelledBy(reason))).not.toHaveBeenCalled()
})

// The action did not happen, and a caller resets what it showed in its error callback
test.each([
  ['a lost link', cancelledBy('disconnect')],
  ["the service's error", new RPCError('nope', T.RPCGen.StatusCode.scgeneric)],
])('%s reaches setError', async (_, error) => {
  expect(await submitRejecting(error)).toHaveBeenCalledWith(error)
})
