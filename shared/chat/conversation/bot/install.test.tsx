/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useBotSettings, useBotTeamRole} from './install'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

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

test('useBotTeamRole refreshes role for the selected conversation and ignores stale results', async () => {
  const resolvers = new Map<string, (role: T.RPCGen.TeamRole) => void>()
  jest.spyOn(T.RPCChat, 'localGetTeamRoleInConversationRpcPromise').mockImplementation(
    async ({username}) => {
      const role = await new Promise<T.RPCGen.TeamRole>(resolve => {
        resolvers.set(username, resolve)
      })
      return role
    }
  )

  const {rerender, result} = renderHook(
    ({botUsername, id}) => useBotTeamRole(id, botUsername),
    {initialProps: {botUsername: 'helperbot', id: convID}}
  )

  expect(T.RPCChat.localGetTeamRoleInConversationRpcPromise).toHaveBeenCalledWith({
    convID: T.Chat.keyToConversationID(convID),
    username: 'helperbot',
  })

  rerender({botUsername: 'otherbot', id: convID})
  expect(T.RPCChat.localGetTeamRoleInConversationRpcPromise).toHaveBeenLastCalledWith({
    convID: T.Chat.keyToConversationID(convID),
    username: 'otherbot',
  })

  await act(async () => {
    resolvers.get('helperbot')?.(T.RPCGen.TeamRole.bot)
    await flushPromises()
  })

  expect(result.current).toBeUndefined()

  await act(async () => {
    resolvers.get('otherbot')?.(T.RPCGen.TeamRole.restrictedbot)
    await flushPromises()
  })

  expect(result.current).toBe('restrictedbot')
})

test('useBotSettings refreshes only when enabled and hides stale conversation data', async () => {
  const settings = {cmds: true, convs: [convID], mentions: false}
  jest.spyOn(T.RPCChat, 'localGetBotMemberSettingsRpcPromise').mockResolvedValue(settings)

  const {rerender, result} = renderHook(
    ({enabled, id}) => useBotSettings(id, 'helperbot', enabled),
    {initialProps: {enabled: false, id: convID as T.Chat.ConversationIDKey | undefined}}
  )

  await act(async () => {
    await flushPromises()
  })

  expect(T.RPCChat.localGetBotMemberSettingsRpcPromise).not.toHaveBeenCalled()
  expect(result.current).toBeUndefined()

  rerender({enabled: true, id: convID})
  await act(async () => {
    await flushPromises()
  })

  expect(T.RPCChat.localGetBotMemberSettingsRpcPromise).toHaveBeenCalledWith({
    convID: T.Chat.keyToConversationID(convID),
    username: 'helperbot',
  })
  expect(result.current).toEqual(settings)

  rerender({enabled: true, id: otherConvID})

  expect(result.current).toBeUndefined()

  await act(async () => {
    await flushPromises()
  })

  expect(T.RPCChat.localGetBotMemberSettingsRpcPromise).toHaveBeenLastCalledWith({
    convID: T.Chat.keyToConversationID(otherConvID),
    username: 'helperbot',
  })
  expect(result.current).toEqual(settings)
})
