/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useBotCommandsUpdateState} from './commands'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const notifyBotCommandsStatus = (
  conversationIDKey: T.Chat.ConversationIDKey,
  status: T.RPCChat.UIBotCommandsUpdateStatus
) => {
  act(() => {
    notifyEngineActionListeners({
      payload: {params: {convID: conversationIDKey, status}},
      type: 'chat.1.chatUi.chatBotCommandsUpdateStatus',
    } as never)
  })
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('useBotCommandsUpdateState ignores other conversations and applies uptodate settings', () => {
  const {result} = renderHook(({id}) => useBotCommandsUpdateState(id), {
    initialProps: {id: convID},
  })

  notifyBotCommandsStatus(otherConvID, {typ: T.RPCChat.UIBotCommandsUpdateStatusTyp.updating})

  expect(result.current.status).toBe(T.RPCChat.UIBotCommandsUpdateStatusTyp.blank)
  expect(result.current.settings.size).toBe(0)

  const botSettings = {cmds: false, convs: [convID], mentions: true}
  notifyBotCommandsStatus(convID, {
    typ: T.RPCChat.UIBotCommandsUpdateStatusTyp.uptodate,
    uptodate: {settings: {helperbot: botSettings}},
  })

  expect(result.current.status).toBe(T.RPCChat.UIBotCommandsUpdateStatusTyp.uptodate)
  expect(result.current.settings.get('helperbot')).toEqual(botSettings)
})

test('useBotCommandsUpdateState preserves settings during non-uptodate updates and blanks on conv changes', () => {
  const {rerender, result} = renderHook(({id}) => useBotCommandsUpdateState(id), {
    initialProps: {id: convID},
  })
  const botSettings = {cmds: true, mentions: false}

  notifyBotCommandsStatus(convID, {
    typ: T.RPCChat.UIBotCommandsUpdateStatusTyp.uptodate,
    uptodate: {settings: {helperbot: botSettings}},
  })
  notifyBotCommandsStatus(convID, {typ: T.RPCChat.UIBotCommandsUpdateStatusTyp.failed})

  expect(result.current.status).toBe(T.RPCChat.UIBotCommandsUpdateStatusTyp.failed)
  expect(result.current.settings.get('helperbot')).toEqual(botSettings)

  rerender({id: otherConvID})

  expect(result.current.status).toBe(T.RPCChat.UIBotCommandsUpdateStatusTyp.blank)
  expect(result.current.settings.size).toBe(0)
})
