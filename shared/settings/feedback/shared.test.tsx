/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import logger from '@/logger'
import {version} from '@/constants/platform'
import {resetAllStores} from '@/util/zustand'
import {getExtraChatLogsForLogSend, useSendFeedback} from './shared'

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('feedback without logs skips the log dump and only reports the version', async () => {
  const dump = jest.spyOn(logger, 'dump').mockResolvedValue(undefined as never)
  const logSend = jest.spyOn(T.RPCGen, 'configLogSendRpcPromise').mockResolvedValue('log-id' as never)

  const {result} = renderHook(() => useSendFeedback())

  act(() => {
    result.current.sendFeedback('the app is slow', false, false)
  })

  await waitFor(() => expect(logSend).toHaveBeenCalled())
  expect(dump).not.toHaveBeenCalled()

  const [args] = logSend.mock.calls[0] as [
    {feedback: string; sendLogs: boolean; sendMaxBytes: boolean; statusJSON: string},
  ]
  expect(args.feedback).toBe('the app is slow')
  expect(args.sendLogs).toBe(false)
  expect(args.sendMaxBytes).toBe(false)
  expect(JSON.parse(args.statusJSON)).toEqual({version})
  expect(result.current.error).toBe('')
})

test('sending logs dumps them first and mixes in the extra chat logs', async () => {
  const order = new Array<string>()
  jest.spyOn(logger, 'dump').mockImplementation(async () => {
    order.push('dump')
    await Promise.resolve()
    return undefined as never
  })
  const logSend = jest.spyOn(T.RPCGen, 'configLogSendRpcPromise').mockImplementation(async () => {
    order.push('logSend')
    await Promise.resolve()
    return 'log-id' as never
  })

  const {result} = renderHook(() => useSendFeedback())

  act(() => {
    result.current.sendFeedback('', true, true)
  })

  await waitFor(() => expect(logSend).toHaveBeenCalled())
  expect(order).toEqual(['dump', 'logSend'])

  const [args] = logSend.mock.calls[0] as [
    {feedback: string; sendLogs: boolean; sendMaxBytes: boolean; statusJSON: string},
  ]
  expect(args.sendLogs).toBe(true)
  expect(args.sendMaxBytes).toBe(true)
  expect(JSON.parse(args.statusJSON)).toEqual({...getExtraChatLogsForLogSend(), version})
})

test('rpc failures surface the service description', async () => {
  jest.spyOn(logger, 'warn').mockImplementation(() => {})
  jest
    .spyOn(T.RPCGen, 'configLogSendRpcPromise')
    .mockRejectedValue(new RPCError('log send blew up', T.RPCGen.StatusCode.scgeneric))

  const {result} = renderHook(() => useSendFeedback())

  act(() => {
    result.current.sendFeedback('help', false, false)
  })

  await waitFor(() => expect(result.current.error).toBe('log send blew up'))
})

test('non-rpc failures are ignored rather than shown to the user', async () => {
  const logSend = jest
    .spyOn(T.RPCGen, 'configLogSendRpcPromise')
    .mockRejectedValue(new Error('some js bug'))

  const {result} = renderHook(() => useSendFeedback())

  act(() => {
    result.current.sendFeedback('help', false, false)
  })

  await waitFor(() => expect(logSend).toHaveBeenCalled())
  expect(result.current.error).toBe('')
})
