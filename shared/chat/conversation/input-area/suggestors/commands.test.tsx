/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {transformer, useBotCommandsUpdateState} from './commands'

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

describe('transformer', () => {
  const tData = (text: string, start: number, end: number) => ({
    position: {end, start},
    text,
  })

  const command = (name: string, username?: string): T.RPCChat.ConversationCommand => ({
    description: '',
    hasHelpText: false,
    name,
    usage: '',
    username,
  })

  test('service commands are inserted with a slash', () => {
    expect(transformer(command('giphy'), undefined, tData('/gi', 0, 3), false).text).toBe('/giphy ')
  })

  test('bot commands are inserted with a bang', () => {
    expect(transformer(command('roll', 'testuser-mac'), undefined, tData('!ro', 0, 3), false).text).toBe(
      '!roll '
    )
  })

  test('a previewed command is inserted without the trailing space', () => {
    const {selection, text} = transformer(command('giphy'), undefined, tData('/gi', 0, 3), true)
    expect(text).toBe('/giphy')
    expect(selection).toEqual({end: 6, start: 6})
  })
})
