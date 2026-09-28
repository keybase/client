/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as OrangeLine from './orange-line-context'
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import logger from '@/logger'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {
  hideConversation,
  joinConversation,
  markConversationUnread,
  muteConversation,
  muteConversationPromise,
} from './status-actions'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

const threadWithIDs = (ids: ReadonlyArray<number>) =>
  JSON.stringify({messages: ids.map(messageID => ({valid: {messageID}}))})

let rpc: FakeChatRpc
let navigateToInbox: jest.SpyInstance
let setChatRootParams: jest.SpyInstance
let setOrangeLine: jest.SpyInstance

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  rpc = installFakeChatRpc()
  navigateToInbox = jest.spyOn(Router, 'navigateToInbox').mockImplementation(() => {})
  setChatRootParams = jest.spyOn(Router, 'setChatRootParams').mockImplementation(() => true)
  setOrangeLine = jest.spyOn(OrangeLine, 'setConversationOrangeLine').mockImplementation(() => {})
})

afterEach(() => {
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('joinConversation', () => {
  test('joining a conversation refreshes its participants', async () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

    joinConversation(conversationIDKey)
    await flushPromises()

    expect(rpc.calls('joinConversation')).toEqual([[conversationIDKey]])
    expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
  })

  test('a failed join never claims the participants are fresh', async () => {
    rpc.fail('joinConversation', new Error('cannot join'))
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})

    joinConversation(conversationIDKey)
    await flushPromises()

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
    // the failure is not handled here; it lands in ignorePromise's catch-all
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('conversation status', () => {
  const expectStatus = (status: T.RPCChat.ConversationStatus) =>
    expect(rpc.calls('setConversationStatus')).toContainEqual([conversationIDKey, status])

  test('hiding ignores the conversation and leaves it for the inbox', async () => {
    hideConversation(conversationIDKey, true)
    await flushPromises()

    expectStatus(T.RPCChat.ConversationStatus.ignored)
    expect(navigateToInbox).toHaveBeenCalledTimes(1)
    // not a phone: the desktop root also forgets the info panel for this conversation
    expect(setChatRootParams).toHaveBeenCalledWith({conversationIDKey, infoPanel: undefined})
  })

  test('unhiding refiles the conversation without navigating', async () => {
    hideConversation(conversationIDKey, false)
    await flushPromises()

    expectStatus(T.RPCChat.ConversationStatus.unfiled)
    expect(navigateToInbox).not.toHaveBeenCalled()
    expect(setChatRootParams).not.toHaveBeenCalled()
  })

  test('muting and unmuting set muted and unfiled', async () => {
    muteConversation(conversationIDKey, true)
    await flushPromises()
    expectStatus(T.RPCChat.ConversationStatus.muted)

    muteConversation(conversationIDKey, false)
    await flushPromises()
    expectStatus(T.RPCChat.ConversationStatus.unfiled)
    expect(rpc.calls('setConversationStatus')).toHaveLength(2)
  })

  test('the promise form of mute resolves once the status is set', async () => {
    await muteConversationPromise(conversationIDKey, true)
    expectStatus(T.RPCChat.ConversationStatus.muted)

    await muteConversationPromise(conversationIDKey, false)
    expectStatus(T.RPCChat.ConversationStatus.unfiled)
  })

  test('the promise form of mute rejects with the service error', async () => {
    rpc.fail('setConversationStatus', new Error('nope'))
    await expect(muteConversationPromise(conversationIDKey, true)).rejects.toThrow('nope')
  })

  test('a failed fire-and-forget status change is swallowed by ignorePromise', async () => {
    rpc.fail('setConversationStatus', new Error('nope'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    muteConversation(conversationIDKey, true)
    await flushPromises()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('markConversationUnread', () => {
  const markReads = () => rpc.params('markRead')
  const loads = () => rpc.params('loadThread')

  beforeEach(() => {
    rpc.on('loadThread', async p => {
      p.onFullThread?.(threadWithIDs([90, 80, 70]))
      await Promise.resolve()
      return {offline: false}
    })
  })

  test('an explicit read position is used directly, with no thread load', async () => {
    markConversationUnread(conversationIDKey, T.Chat.numberToMessageID(42))
    await flushPromises()

    expect(setOrangeLine).toHaveBeenCalledWith(conversationIDKey, T.Chat.numberToOrdinal(42))
    expect(loads()).toEqual([])
    expect(markReads()).toContainEqual({
      conversationIDKey,
      forceUnread: true,
      msgID: T.Chat.numberToMessageID(42),
    })
  })

  test('without a read position it draws the line at the newest visible message and marks the second newest', async () => {
    metasReceived(
      [{...Meta.makeConversationMeta(), conversationIDKey, maxVisibleMsgID: T.Chat.numberToMessageID(90)}],
      undefined,
      {force: true}
    )
    markConversationUnread(conversationIDKey)
    await flushPromises()

    expect(setOrangeLine).toHaveBeenCalledWith(conversationIDKey, T.Chat.numberToOrdinal(90))
    expect(loads()).toHaveLength(1)
    const params = loads()[0]
    expect(params?.pagination).toEqual({last: false, next: '', num: 2, previous: ''})
    expect(params?.conversationIDKey).toEqual(conversationIDKey)
    expect(params?.messageIDControl ?? null).toBeNull()
    expect(markReads()).toContainEqual({
      conversationIDKey,
      forceUnread: true,
      msgID: T.Chat.numberToMessageID(80),
    })
  })

  test('without meta there is no orange line but the load still decides the position', async () => {
    markConversationUnread(conversationIDKey)
    await flushPromises()

    expect(setOrangeLine).not.toHaveBeenCalled()
    expect(markReads()).toContainEqual({
      conversationIDKey,
      forceUnread: true,
      msgID: T.Chat.numberToMessageID(80),
    })
  })

  test('a thread too short to have a second message marks nothing', async () => {
    rpc.on('loadThread', async p => {
      p.onFullThread?.(threadWithIDs([90]))
      await Promise.resolve()
      return {offline: false}
    })
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(markReads()).toEqual([])
  })

  test('a failed thread load marks nothing', async () => {
    rpc.fail('loadThread', new Error('offline'))
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(markReads()).toEqual([])
  })

  test('a load is not issued while the chat session is not ready', async () => {
    useConfigState.setState({loggedIn: false})
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(loads()).toEqual([])
    expect(markReads()).toEqual([])
  })
})
