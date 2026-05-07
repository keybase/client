/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useBotSettings} from '../bot/settings'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('useBotSettings refreshes settings for the visible bot and supports local updates after edits', async () => {
  const initialSettings = {cmds: true, convs: ['old-conv'], mentions: false}
  const editedSettings = {cmds: true, convs: [convID, 'old-conv'], mentions: false}
  jest.spyOn(T.RPCChat, 'localGetBotMemberSettingsRpcPromise').mockResolvedValue(initialSettings)

  const {result} = renderHook(() => useBotSettings(convID, 'helperbot'))

  await act(async () => {
    await flushPromises()
  })

  expect(T.RPCChat.localGetBotMemberSettingsRpcPromise).toHaveBeenCalledWith({
    convID: T.Chat.keyToConversationID(convID),
    username: 'helperbot',
  })
  expect(result.current.settings).toEqual(initialSettings)

  act(() => {
    result.current.setSettings(editedSettings)
  })

  expect(result.current.settings).toEqual(editedSettings)
})

test('useBotSettings clears visible settings while refreshing a different bot', async () => {
  jest.spyOn(T.RPCChat, 'localGetBotMemberSettingsRpcPromise').mockImplementation(
    async ({username}) => {
      await Promise.resolve()
      return username === 'helperbot'
        ? {cmds: true, convs: ['helper-conv'], mentions: false}
        : {cmds: false, convs: ['other-conv'], mentions: true}
    }
  )

  const {rerender, result} = renderHook(({username}) => useBotSettings(convID, username), {
    initialProps: {username: 'helperbot'},
  })

  await act(async () => {
    await flushPromises()
  })

  expect(result.current.settings).toEqual({cmds: true, convs: ['helper-conv'], mentions: false})

  rerender({username: 'otherbot'})

  expect(result.current.settings).toBeUndefined()

  await act(async () => {
    await flushPromises()
  })

  expect(result.current.settings).toEqual({cmds: false, convs: ['other-conv'], mentions: true})
})
