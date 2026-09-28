/** @jest-environment jsdom */
/// <reference types="jest" />
// The thread provider's commands that talk to the service: what each one sends, and what it does
// to the thread store around the call.
import * as Meta from '@/constants/chat/meta'
import * as Router from '@/constants/router'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import RPCError from '@/util/rpcerror'
import type * as React from 'react'
import logger from '@/logger'
import {act, cleanup, renderHook} from '@testing-library/react'
import {getInboxConversationMeta, metasReceived} from '@/chat/inbox/metadata'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {
  ConversationThreadProvider,
  useConversationThreadActions,
  useConversationThreadDismissJourneycard,
  useConversationThreadStore,
  useConversationThreadUnfurlResolvePrompt,
} from './thread-context'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)
const tlfName = 'testuser,testuser2'

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

const deferred = <V,>() => Promise.withResolvers<V>()

const textAt = (n: number, over?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    author: 'testuser2',
    conversationIDKey,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    ...over,
  })

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={conversationIDKey}>{children}</ConversationThreadProvider>
)

const renderThread = (messages: ReadonlyArray<T.Chat.Message> = []) => {
  const rendered = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      dismissJourneycard: useConversationThreadDismissJourneycard(),
      resolveUnfurlPrompt: useConversationThreadUnfurlResolvePrompt(),
      store: useConversationThreadStore(),
    }),
    {wrapper}
  )
  if (messages.length) {
    act(() => {
      rendered.result.current.actions.addMessages(messages)
    })
  }
  const result = rendered.result
  const message = (n: number) => result.current.store.getState().messageMap.get(T.Chat.numberToOrdinal(n))
  return {message, result}
}

const run = async (f: () => void) => {
  await act(async () => {
    f()
    await flushPromises()
  })
}

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived(
    [
      {
        ...Meta.makeConversationMeta(),
        conversationIDKey,
        maxVisibleMsgID: T.Chat.numberToMessageID(20),
        readMsgID: T.Chat.numberToMessageID(0),
        tlfname: tlfName,
      },
    ],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('retryMessage', () => {
  test('asks the service to retry the outbox entry', async () => {
    const retry = jest.spyOn(T.RPCChat, 'localRetryPostRpcPromise').mockResolvedValue(undefined)
    const {result} = renderThread()
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    await run(() => result.current.actions.retryMessage(outboxID))
    expect(retry).toHaveBeenCalledWith({outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)})
  })
})

describe('messageDelete', () => {
  test('a sent message is marked deleting and deleted by id', async () => {
    const pending = deferred<never>()
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise').mockReturnValue(pending.promise)
    const {message, result} = renderThread([textAt(10), textAt(11)])

    act(() => {
      result.current.actions.messageDelete(T.Chat.numberToOrdinal(10))
    })
    expect(message(10)?.submitState).toBe('deleting')
    await act(async () => {
      await flushPromises()
    })
    // the thread's own delete sends no clientPrev
    expect(del).toHaveBeenCalledWith({
      clientPrev: T.Chat.numberToMessageID(0),
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: null,
      supersedes: T.Chat.numberToMessageID(10),
      tlfName,
      tlfPublic: false,
    })
    await act(async () => {
      pending.resolve(undefined as never)
      await flushPromises()
    })
    // success leaves the row to the service's delete notification
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('an unsent message cancels its outbox entry and drops the row', async () => {
    const cancel = jest.spyOn(T.RPCChat, 'localCancelPostRpcPromise').mockResolvedValue(undefined)
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise')
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message, result} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})])
    await run(() => result.current.actions.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(cancel).toHaveBeenCalledWith({outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)})
    expect(del).not.toHaveBeenCalled()
    expect(message(10)).toBeUndefined()
  })

  test('a message with neither id reverts', async () => {
    const cancel = jest.spyOn(T.RPCChat, 'localCancelPostRpcPromise')
    const {message, result} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0)})])
    await run(() => result.current.actions.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(cancel).not.toHaveBeenCalled()
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a service failure reverts the deleting state', async () => {
    jest
      .spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const {message, result} = renderThread([textAt(10)])
    await run(() => result.current.actions.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a failed cancel reverts and keeps the row', async () => {
    jest
      .spyOn(T.RPCChat, 'localCancelPostRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message, result} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})])
    await run(() => result.current.actions.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a non-service failure reverts and is rethrown to ignorePromise', async () => {
    jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise').mockRejectedValue(new Error('bug'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {message, result} = renderThread([textAt(10)])
    await run(() => result.current.actions.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })

  test('without meta nothing is sent and the state reverts', async () => {
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise')
    const {message, result} = renderThread([textAt(10)])
    act(() => {
      resetAllStores()
    })
    await run(() => result.current.actions.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(del).not.toHaveBeenCalled()
    expect(message(10)?.submitState).toBeUndefined()
  })
})

describe('unfurlRemove', () => {
  test('deletes the unfurl message by id', async () => {
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise').mockResolvedValue({} as never)
    const {result} = renderThread()
    await run(() => result.current.actions.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(del).toHaveBeenCalledWith(
      expect.objectContaining({clientPrev: T.Chat.numberToMessageID(0), supersedes: 33, tlfName})
    )
  })

  test('without meta nothing is sent', async () => {
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise')
    const {result} = renderThread()
    act(() => {
      resetAllStores()
    })
    await run(() => result.current.actions.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(del).not.toHaveBeenCalled()
  })
})

describe('toggleMessageCollapse', () => {
  test('a message collapses or expands itself', async () => {
    const toggle = jest.spyOn(T.RPCChat, 'localToggleMessageCollapseRpcPromise').mockResolvedValue({} as never)
    const {result} = renderThread([textAt(10), textAt(11, {isCollapsed: true})])
    await run(() => result.current.actions.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    await run(() => result.current.actions.toggleMessageCollapse(T.Chat.numberToMessageID(11), T.Chat.numberToOrdinal(11)))
    expect(toggle.mock.calls).toEqual([
      [{collapse: true, convID, msgID: T.Chat.numberToMessageID(10)}],
      [{collapse: false, convID, msgID: T.Chat.numberToMessageID(11)}],
    ])
  })

  test('an unfurl toggles against its own collapsed state', async () => {
    const toggle = jest.spyOn(T.RPCChat, 'localToggleMessageCollapseRpcPromise').mockResolvedValue({} as never)
    const unfurls = new Map([
      ['https://a.com', {isCollapsed: true, unfurlMessageID: T.Chat.numberToMessageID(40)}],
    ]) as unknown as T.Chat.MessageText['unfurls']
    const {result} = renderThread([textAt(10, {unfurls})])
    await run(() => result.current.actions.toggleMessageCollapse(T.Chat.numberToMessageID(40), T.Chat.numberToOrdinal(10)))
    // an unfurl id the message does not carry reads as expanded
    await run(() => result.current.actions.toggleMessageCollapse(T.Chat.numberToMessageID(41), T.Chat.numberToOrdinal(10)))
    expect(toggle.mock.calls).toEqual([
      [{collapse: false, convID, msgID: T.Chat.numberToMessageID(40)}],
      [{collapse: true, convID, msgID: T.Chat.numberToMessageID(41)}],
    ])
  })
})

describe('toggleMessageReaction', () => {
  test('posts with the thread clientPrev, the meta tlfName and the optimistic outbox id', async () => {
    const react = jest.spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise').mockResolvedValue({} as never)
    const {result} = renderThread([textAt(10), textAt(12)])
    await run(() => result.current.actions.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(react).toHaveBeenCalledWith({
      body: ':+1:',
      clientPrev: T.Chat.numberToMessageID(12),
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: expect.any(Uint8Array),
      supersedes: T.Chat.numberToMessageID(10),
      tlfName,
      tlfPublic: false,
    })
    const outboxID = react.mock.calls[0]?.[0].outboxID as Uint8Array
    expect([...result.current.store.getState().optimisticReactionMap.keys()]).toEqual([
      T.Chat.rpcOutboxIDToOutboxID(outboxID),
    ])
  })

  test('a failed post drops the optimistic reaction', async () => {
    jest
      .spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const {result} = renderThread([textAt(10)])
    await run(() => result.current.actions.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
  })

  test('nothing is posted for an unsent or exploded message', async () => {
    const react = jest.spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise')
    const {result} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0)}), textAt(11, {exploded: true})])
    await run(() => result.current.actions.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    await run(() => result.current.actions.toggleMessageReaction(T.Chat.numberToOrdinal(11), ':+1:'))
    expect(react).not.toHaveBeenCalled()
  })
})

describe('messageReplyPrivately', () => {
  test('creates the adhoc conversation and opens it with the quote', async () => {
    const newConvID = new Uint8Array([9, 9, 9, 9])
    const newKey = T.Chat.conversationIDToKey(newConvID)
    const create = jest.spyOn(T.RPCChat, 'localNewConversationLocalRpcPromise').mockResolvedValue({
      conv: {info: {id: newConvID}},
      uiConv: {},
    } as never)
    jest
      .spyOn(Meta, 'inboxUIItemToConversationMeta')
      .mockReturnValue({...Meta.makeConversationMeta(), conversationIDKey: newKey, tlfname: tlfName})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    const {result} = renderThread([textAt(10)])

    await run(() => result.current.actions.messageReplyPrivately(T.Chat.numberToOrdinal(10)))

    expect(create).toHaveBeenCalledWith(
      {
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        membersType: T.RPCChat.ConversationMembersType.impteamnative,
        tlfName,
        tlfVisibility: T.RPCGen.TLFVisibility.private,
        topicType: T.RPCChat.TopicType.chat,
      },
      Strings.waitingKeyChatCreating
    )
    expect(getInboxConversationMeta(newKey)).toBeDefined()
    expect(navigate).toHaveBeenCalledWith(newKey, 'createdMessagePrivately', {
      intent: {text: '> message 10\n', type: 'injectText'},
    })
  })

  test('a missing message creates nothing', async () => {
    const create = jest.spyOn(T.RPCChat, 'localNewConversationLocalRpcPromise')
    const {result} = renderThread()
    await run(() => result.current.actions.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(create).not.toHaveBeenCalled()
  })
})

describe('setMarkAsUnread', () => {
  let markAsRead: jest.SpyInstance

  beforeEach(() => {
    markAsRead = jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
  })

  test('a loaded thread marks unread from the newest message below the line', async () => {
    const load = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
    const {result} = renderThread([textAt(10), textAt(15), textAt(20)])
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(load).not.toHaveBeenCalled()
    expect(markAsRead).toHaveBeenCalledWith({
      conversationID: convID,
      forceUnread: true,
      msgID: T.Chat.numberToMessageID(15),
    })
  })

  test('no read position uses the meta line', async () => {
    const {result} = renderThread([textAt(10), textAt(15), textAt(20)])
    await run(() => result.current.actions.setMarkAsUnread())
    expect(markAsRead).toHaveBeenCalledWith(expect.objectContaining({msgID: T.Chat.numberToMessageID(15)}))
  })

  test('an empty thread asks the service for the second newest message', async () => {
    const load = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({
        thread: JSON.stringify({messages: [{valid: {messageID: 20}}, {valid: {messageID: 18}}]}),
      })
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderThread()
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(load.mock.calls[0]?.[0].params.pagination).toEqual({last: false, next: '', num: 2, previous: ''})
    expect(markAsRead).toHaveBeenCalledWith(expect.objectContaining({msgID: T.Chat.numberToMessageID(18)}))
  })

  test('an empty thread whose load fails falls back to the line itself', async () => {
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockRejectedValue(new Error('offline'))
    const {result} = renderThread()
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(markAsRead).toHaveBeenCalledWith(expect.objectContaining({msgID: T.Chat.numberToMessageID(20)}))
  })

  test('false and logged out do nothing', async () => {
    const {result} = renderThread([textAt(10)])
    await run(() => result.current.actions.setMarkAsUnread(false))
    useConfigState.setState({loggedIn: false})
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(markAsRead).not.toHaveBeenCalled()
  })
})

describe('setExplodingMode', () => {
  test('a local change is persisted to gregor, an incoming one is not', async () => {
    const update = jest.spyOn(T.RPCGen, 'gregorUpdateCategoryRpcPromise').mockResolvedValue(new Uint8Array())
    const {result} = renderThread()
    await run(() => result.current.actions.setExplodingMode(60, true))
    expect(update).not.toHaveBeenCalled()
    expect(result.current.store.getState().explodingMode).toBe(60)

    await run(() => result.current.actions.setExplodingMode(300))
    expect(update).toHaveBeenCalledWith({
      body: '300',
      category: `exploding:${conversationIDKey}`,
      dtime: {offset: 0, time: 0},
    })
    expect(result.current.store.getState().explodingMode).toBe(300)
  })
})

describe('journeycards and unfurl prompts', () => {
  test('dismissing a journeycard tells the service and drops the row', async () => {
    const dismiss = jest.spyOn(T.RPCChat, 'localDismissJourneycardRpcPromise').mockResolvedValue(undefined)
    const {message, result} = renderThread([textAt(10)])
    await run(() => result.current.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    expect(dismiss).toHaveBeenCalledWith({cardType: T.RPCChat.JourneycardType.welcome, convID})
    expect(message(10)).toBeUndefined()
  })

  test('the row goes even when the service refuses', async () => {
    jest
      .spyOn(T.RPCChat, 'localDismissJourneycardRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {message, result} = renderThread([textAt(10)])
    await run(() => result.current.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    expect(message(10)).toBeUndefined()
  })

  test('resolving an unfurl prompt clears it locally and sends the answer', async () => {
    const resolve = jest.spyOn(T.RPCChat, 'localResolveUnfurlPromptRpcPromise').mockResolvedValue(undefined)
    const {result} = renderThread()
    const messageID = T.Chat.numberToMessageID(50)
    act(() => {
      result.current.actions.showUnfurlPrompt(messageID, 'a.com')
    })
    const answer = {actionType: T.RPCChat.UnfurlPromptAction.always} as T.RPCChat.UnfurlPromptResult
    await run(() => result.current.resolveUnfurlPrompt(messageID, 'a.com', answer))
    expect(result.current.store.getState().unfurlPrompt.get(messageID)?.has('a.com')).toBe(false)
    expect(resolve).toHaveBeenCalledWith({
      convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      msgID: 50,
      result: answer,
    })
  })
})

test('an attachment on the thread is no different for delete', async () => {
  const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise').mockResolvedValue({} as never)
  const attachment = makeMessageAttachment({
    conversationIDKey,
    id: T.Chat.numberToMessageID(10),
    ordinal: T.Chat.numberToOrdinal(10),
  })
  const {result} = renderThread([attachment])
  await run(() => result.current.actions.messageDelete(T.Chat.numberToOrdinal(10)))
  expect(del).toHaveBeenCalledWith(expect.objectContaining({supersedes: T.Chat.numberToMessageID(10)}))
})
