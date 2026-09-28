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

let navigateToInbox: jest.SpyInstance
let setChatRootParams: jest.SpyInstance
let setOrangeLine: jest.SpyInstance

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  navigateToInbox = jest.spyOn(Router, 'navigateToInbox').mockImplementation(() => {})
  setChatRootParams = jest.spyOn(Router, 'setChatRootParams').mockImplementation(() => true)
  setOrangeLine = jest.spyOn(OrangeLine, 'setConversationOrangeLine').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('joinConversation', () => {
  test('joining a conversation refreshes its participants', async () => {
    jest.spyOn(T.RPCChat, 'localJoinConversationByIDLocalRpcPromise').mockResolvedValue({} as never)
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

    joinConversation(conversationIDKey)
    await flushPromises()

    expect(T.RPCChat.localJoinConversationByIDLocalRpcPromise).toHaveBeenCalledWith({convID})
    expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
  })

  test('a failed join never claims the participants are fresh', async () => {
    jest
      .spyOn(T.RPCChat, 'localJoinConversationByIDLocalRpcPromise')
      .mockRejectedValue(new Error('cannot join'))
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
  let setStatus: jest.SpyInstance

  beforeEach(() => {
    setStatus = jest
      .spyOn(T.RPCChat, 'localSetConversationStatusLocalRpcPromise')
      .mockResolvedValue({} as never)
  })

  const expectStatus = (status: T.RPCChat.ConversationStatus) =>
    expect(setStatus).toHaveBeenCalledWith({
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      status,
    })

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
    expect(setStatus).toHaveBeenCalledTimes(2)
  })

  test('the promise form of mute resolves once the status is set', async () => {
    await muteConversationPromise(conversationIDKey, true)
    expectStatus(T.RPCChat.ConversationStatus.muted)

    await muteConversationPromise(conversationIDKey, false)
    expectStatus(T.RPCChat.ConversationStatus.unfiled)
  })

  test('the promise form of mute rejects with the service error', async () => {
    setStatus.mockRejectedValue(new Error('nope'))
    await expect(muteConversationPromise(conversationIDKey, true)).rejects.toThrow('nope')
  })

  test('a failed fire-and-forget status change is swallowed by ignorePromise', async () => {
    setStatus.mockRejectedValue(new Error('nope'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    muteConversation(conversationIDKey, true)
    await flushPromises()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('markConversationUnread', () => {
  let markAsRead: jest.SpyInstance
  let loadThread: jest.SpyInstance

  beforeEach(() => {
    markAsRead = jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
    loadThread = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: threadWithIDs([90, 80, 70])})
      await Promise.resolve()
      return {offline: false}
    })
  })

  test('an explicit read position is used directly, with no thread load', async () => {
    markConversationUnread(conversationIDKey, T.Chat.numberToMessageID(42))
    await flushPromises()

    expect(setOrangeLine).toHaveBeenCalledWith(conversationIDKey, T.Chat.numberToOrdinal(42))
    expect(loadThread).not.toHaveBeenCalled()
    expect(markAsRead).toHaveBeenCalledWith({
      conversationID: convID,
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
    expect(loadThread).toHaveBeenCalledTimes(1)
    const params = (loadThread.mock.calls[0]?.[0] as {params: T.RPCChat.MessageTypes['chat.1.local.getThreadNonblock']['inParam']}).params
    expect(params.pagination).toEqual({last: false, next: '', num: 2, previous: ''})
    expect(params.conversationID).toEqual(convID)
    expect(params.query?.messageIDControl).toBeNull()
    expect(markAsRead).toHaveBeenCalledWith({
      conversationID: convID,
      forceUnread: true,
      msgID: T.Chat.numberToMessageID(80),
    })
  })

  test('without meta there is no orange line but the load still decides the position', async () => {
    markConversationUnread(conversationIDKey)
    await flushPromises()

    expect(setOrangeLine).not.toHaveBeenCalled()
    expect(markAsRead).toHaveBeenCalledWith({
      conversationID: convID,
      forceUnread: true,
      msgID: T.Chat.numberToMessageID(80),
    })
  })

  test('a thread too short to have a second message marks nothing', async () => {
    loadThread.mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: threadWithIDs([90])})
      await Promise.resolve()
      return {offline: false}
    })
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(markAsRead).not.toHaveBeenCalled()
  })

  test('a failed thread load marks nothing', async () => {
    loadThread.mockRejectedValue(new Error('offline'))
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(markAsRead).not.toHaveBeenCalled()
  })

  test('a load is not issued while the chat session is not ready', async () => {
    useConfigState.setState({loggedIn: false})
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(loadThread).not.toHaveBeenCalled()
    expect(markAsRead).not.toHaveBeenCalled()
  })
})
