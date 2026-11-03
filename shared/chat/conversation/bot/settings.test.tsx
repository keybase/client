/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {flush} from '@/test/flush'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {useBotSettings} from './settings'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const getBotSettings = 'chat.1.local.getBotMemberSettings'

let fake: FakeEngine
let info: jest.SpyInstance

beforeEach(() => {
  fake = installFakeEngine()
  info = jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('useBotSettings failures', () => {
  test('a failed getBotSettings (no waiting key) is logged and reported as failed, not loading', async () => {
    fake.answer(getBotSettings, () => fakeError(4, 'not a member'))

    const {result} = renderHook(() => useBotSettings(convID, 'helperbot'))

    expect(result.current.failed).toBe(false)
    await flush()

    expect(paramsOf(fake, getBotSettings)).toEqual([{convID: T.Chat.keyToConversationID(convID), username: 'helperbot'}])
    expect(result.current.failed).toBe(true)
    expect(result.current.settings).toBeUndefined()
    expect(info).toHaveBeenCalledWith(
      'useBotSettings: failed to refresh settings for helperbot: ERROR CODE 4 - not a member in method chat.1.local.getBotMemberSettings'
    )
  })

  test('a failure for a bot no longer shown is dropped without a log', async () => {
    let failHelper = () => {}
    fake.answer(getBotSettings, async (params: {username: string}) => {
      if (params.username === 'helperbot') {
        return new Promise(resolve => {
          failHelper = () => resolve(fakeError(5, 'late'))
        })
      }
      return {cmds: true, convs: null, mentions: true}
    })

    const {rerender, result} = renderHook(({username}) => useBotSettings(convID, username), {
      initialProps: {username: 'helperbot'},
    })
    rerender({username: 'otherbot'})
    await flush()
    failHelper()
    await flush()

    expect(result.current.failed).toBe(false)
    expect(result.current.settings).toEqual({cmds: true, convs: null, mentions: true})
    expect(info).not.toHaveBeenCalled()
  })

  test('a failure is not retried; a later setSettings clears it', async () => {
    fake.answer(getBotSettings, () => fakeError(4, 'not a member'))

    const {rerender, result} = renderHook(() => useBotSettings(convID, 'helperbot'))
    await flush()
    rerender()
    await flush()

    expect(paramsOf(fake, getBotSettings)).toHaveLength(1)
    expect(result.current.failed).toBe(true)

    act(() => {
      result.current.setSettings({cmds: false, convs: [convID], mentions: true})
    })
    expect(result.current.failed).toBe(false)
    expect(result.current.settings).toEqual({cmds: false, convs: [convID], mentions: true})
  })
})
