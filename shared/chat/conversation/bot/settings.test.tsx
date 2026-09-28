/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {useBotSettings} from './settings'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

let rpc: FakeChatRpc
let info: jest.SpyInstance

beforeEach(() => {
  rpc = installFakeChatRpc()
  info = jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('useBotSettings failures', () => {
  test('a failed getBotSettings (no waiting key) is logged and reported as failed, not loading', async () => {
    rpc.fail('getBotSettings', new RPCError('not a member', 4))

    const {result} = renderHook(() => useBotSettings(convID, 'helperbot'))

    expect(result.current.failed).toBe(false)
    await act(async () => {
      await flushPromises()
    })

    expect(rpc.calls('getBotSettings')).toEqual([[convID, 'helperbot']])
    expect(result.current.failed).toBe(true)
    expect(result.current.settings).toBeUndefined()
    expect(info).toHaveBeenCalledWith(
      'useBotSettings: failed to refresh settings for helperbot: ERROR CODE 4 - not a member'
    )
  })

  test('a failure for a bot no longer shown is dropped without a log', async () => {
    let rejectHelper: (e: unknown) => void = () => {}
    rpc.on('getBotSettings', async (_conversationIDKey, username) => {
      if (username === 'helperbot') {
        return new Promise<T.RPCGen.TeamBotSettings>((_resolve, reject) => {
          rejectHelper = reject
        })
      }
      return {cmds: true, convs: null, mentions: true}
    })

    const {rerender, result} = renderHook(({username}) => useBotSettings(convID, username), {
      initialProps: {username: 'helperbot'},
    })
    rerender({username: 'otherbot'})
    await act(async () => {
      await flushPromises()
    })
    await act(async () => {
      rejectHelper(new RPCError('late', 5))
      await flushPromises()
    })

    expect(result.current.failed).toBe(false)
    expect(result.current.settings).toEqual({cmds: true, convs: null, mentions: true})
    expect(info).not.toHaveBeenCalled()
  })

  test('a failure is not retried; a later setSettings clears it', async () => {
    rpc.fail('getBotSettings', new RPCError('not a member', 4))

    const {rerender, result} = renderHook(() => useBotSettings(convID, 'helperbot'))
    await act(async () => {
      await flushPromises()
    })
    rerender()
    await act(async () => {
      await flushPromises()
    })

    expect(rpc.calls('getBotSettings')).toHaveLength(1)
    expect(result.current.failed).toBe(true)

    act(() => {
      result.current.setSettings({cmds: false, convs: [convID], mentions: true})
    })
    expect(result.current.failed).toBe(false)
    expect(result.current.settings).toEqual({cmds: false, convs: [convID], mentions: true})
  })
})
