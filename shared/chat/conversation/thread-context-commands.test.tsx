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
import {act, cleanup, fireEvent, renderHook, screen} from '@testing-library/react'
import {getInboxConversationMeta, metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {
  deleteMessage,
  dismissJourneycard,
  removeUnfurl,
  replyPrivately,
  toggleCollapse,
  toggleReaction,
} from './message-commands'
import {Collapsed} from './messages/attachment/shared'
import {
  ConversationThreadProvider,
  useConversationThreadActions,
  useConversationThreadStore,
  useConversationThreadUnfurlResolvePrompt,
} from './thread-context'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
let rpc: FakeChatRpc
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
  const row = (ordinal: T.Chat.Ordinal) => ({ordinal, thread: result.current.actions})
  cmd = {
    dismissJourneycard: (cardType, ordinal) => dismissJourneycard(conversationIDKey, cardType, row(ordinal)),
    messageDelete: ordinal => deleteMessage(conversationIDKey, row(ordinal)),
    messageReplyPrivately: ordinal => replyPrivately(row(ordinal)),
    toggleMessageCollapse: (messageID, ordinal) => toggleCollapse(conversationIDKey, row(ordinal), messageID),
    toggleMessageReaction: (ordinal, emoji) => toggleReaction(conversationIDKey, row(ordinal), emoji),
    unfurlRemove: messageID => removeUnfurl(conversationIDKey, messageID),
  }
  return {message, result}
}

// The message commands under test, issued against the rendered thread.
type Commands = {
  dismissJourneycard: (cardType: T.RPCChat.JourneycardType, ordinal: T.Chat.Ordinal) => void
  messageDelete: (ordinal: T.Chat.Ordinal) => void
  messageReplyPrivately: (ordinal: T.Chat.Ordinal) => void
  toggleMessageCollapse: (messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => void
  toggleMessageReaction: (ordinal: T.Chat.Ordinal, emoji: string) => void
  unfurlRemove: (messageID: T.Chat.MessageID) => void
}
let cmd: Commands

const run = async (f: () => void) => {
  await act(async () => {
    f()
    await flushPromises()
  })
}

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  rpc = installFakeChatRpc()
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
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('retryMessage', () => {
  test('asks the service to retry the outbox entry', async () => {
    const {result} = renderThread()
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    await run(() => result.current.actions.retryMessage(outboxID))
    expect(rpc.calls('retryPost')).toEqual([[outboxID]])
  })
})

describe('messageDelete', () => {
  test('a sent message is marked deleting and deleted by id', async () => {
    const pending = deferred<undefined>()
    rpc.on('postDelete', async () => pending.promise)
    const {message} = renderThread([textAt(10), textAt(11)])

    act(() => {
      cmd.messageDelete(T.Chat.numberToOrdinal(10))
    })
    expect(message(10)?.submitState).toBe('deleting')
    await act(async () => {
      await flushPromises()
    })
    // the thread's own delete sends no clientPrev
    expect(rpc.params('postDelete')).toEqual([
      {conversationIDKey, messageID: T.Chat.numberToMessageID(10), tlfName},
    ])
    await act(async () => {
      pending.resolve(undefined)
      await flushPromises()
    })
    // success leaves the row to the service's delete notification
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('an unsent message cancels its outbox entry and drops the row', async () => {
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('cancelPost')).toEqual([[outboxID]])
    expect(rpc.calls('postDelete')).toEqual([])
    expect(message(10)).toBeUndefined()
  })

  test('a message with neither id reverts', async () => {
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0)})])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('cancelPost')).toEqual([])
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a service failure reverts the deleting state', async () => {
    rpc.fail('postDelete', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a failed cancel reverts and keeps the row', async () => {
    rpc.fail('cancelPost', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a non-service failure reverts and is rethrown to ignorePromise', async () => {
    rpc.fail('postDelete', new Error('bug'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })

  test('without meta nothing is sent and the state reverts', async () => {
    const {message} = renderThread([textAt(10)])
    act(() => {
      resetAllStores()
    })
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('postDelete')).toEqual([])
    expect(message(10)?.submitState).toBeUndefined()
  })
})

describe('unfurlRemove', () => {
  test('deletes the unfurl message by id', async () => {
    renderThread()
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(rpc.params('postDelete')).toEqual([
      {conversationIDKey, messageID: T.Chat.numberToMessageID(33), tlfName},
    ])
  })

  test('without meta nothing is sent', async () => {
    renderThread()
    act(() => {
      resetAllStores()
    })
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(rpc.calls('postDelete')).toEqual([])
  })
})

describe('toggleMessageCollapse', () => {
  // An attachment sent this session keeps its fractional outbox ordinal after it gets its id.
  const sentAttachment = (over?: Partial<T.Chat.MessageAttachment>) =>
    makeMessageAttachment({
      author: 'testuser',
      conversationIDKey,
      id: T.Chat.numberToMessageID(12),
      isCollapsed: true,
      ordinal: T.Chat.numberToOrdinal(10.001),
      ...over,
    })

  const clickCollapsed = async () => {
    await run(() => fireEvent.click(screen.getByText('Collapsed')))
  }

  const renderCollapsed = (message: T.Chat.MessageAttachment) => {
    const {result} = renderHook(useConversationThreadActions, {
      wrapper: ({children}: {children: React.ReactNode}) => (
        <ConversationThreadProvider id={conversationIDKey}>
          {children}
          <Collapsed isCollapsed={message.isCollapsed} ordinal={message.ordinal} />
        </ConversationThreadProvider>
      ),
    })
    act(() => result.current.addMessages([message]))
  }

  test('a collapsed attachment row toggles its own message by id, not by ordinal', async () => {
    renderCollapsed(sentAttachment())
    await clickCollapsed()
    expect(rpc.params('toggleCollapse')).toEqual([
      {collapse: false, conversationIDKey, messageID: T.Chat.numberToMessageID(12)},
    ])
  })

  test('a row with no id yet toggles nothing', async () => {
    renderCollapsed(sentAttachment({id: T.Chat.numberToMessageID(0)}))
    await clickCollapsed()
    expect(rpc.calls('toggleCollapse')).toEqual([])
  })

  test('a row whose ordinal is not its id reads its own collapsed state', async () => {
    renderThread([sentAttachment()])
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(12), T.Chat.numberToOrdinal(10.001)))
    expect(rpc.params('toggleCollapse')).toEqual([
      {collapse: false, conversationIDKey, messageID: T.Chat.numberToMessageID(12)},
    ])
  })

  test('a message collapses or expands itself', async () => {
    renderThread([textAt(10), textAt(11, {isCollapsed: true})])
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(11), T.Chat.numberToOrdinal(11)))
    expect(rpc.params('toggleCollapse')).toEqual([
      {collapse: true, conversationIDKey, messageID: T.Chat.numberToMessageID(10)},
      {collapse: false, conversationIDKey, messageID: T.Chat.numberToMessageID(11)},
    ])
  })

  test('an unfurl toggles against its own collapsed state', async () => {
    const unfurls = new Map([
      ['https://a.com', {isCollapsed: true, unfurlMessageID: T.Chat.numberToMessageID(40)}],
    ]) as unknown as T.Chat.MessageText['unfurls']
    renderThread([textAt(10, {unfurls})])
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(40), T.Chat.numberToOrdinal(10)))
    // an unfurl id the message does not carry reads as expanded
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(41), T.Chat.numberToOrdinal(10)))
    expect(rpc.params('toggleCollapse')).toEqual([
      {collapse: false, conversationIDKey, messageID: T.Chat.numberToMessageID(40)},
      {collapse: true, conversationIDKey, messageID: T.Chat.numberToMessageID(41)},
    ])
  })
})

describe('toggleMessageReaction', () => {
  test('posts with the thread clientPrev, the meta tlfName and the optimistic outbox id', async () => {
    const {result} = renderThread([textAt(10), textAt(12)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(rpc.params('postReaction')).toEqual([
      {
        clientPrev: T.Chat.numberToMessageID(12),
        conversationIDKey,
        emoji: ':+1:',
        messageID: T.Chat.numberToMessageID(10),
        outboxID: expect.any(Uint8Array),
        tlfName,
      },
    ])
    const outboxID = rpc.params('postReaction')[0]?.outboxID as Uint8Array
    expect([...result.current.store.getState().optimisticReactionMap.keys()]).toEqual([
      T.Chat.rpcOutboxIDToOutboxID(outboxID),
    ])
  })

  test('a failed post drops the optimistic reaction', async () => {
    rpc.fail('postReaction', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const {result} = renderThread([textAt(10)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
  })

  test('nothing is posted for an unsent or exploded message', async () => {
    renderThread([textAt(10, {id: T.Chat.numberToMessageID(0)}), textAt(11, {exploded: true})])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(11), ':+1:'))
    expect(rpc.calls('postReaction')).toEqual([])
  })
})

describe('messageReplyPrivately', () => {
  test('creates the adhoc conversation and opens it with the quote', async () => {
    const newConvID = new Uint8Array([9, 9, 9, 9])
    const newKey = T.Chat.conversationIDToKey(newConvID)
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: newConvID}}, uiConv: {}}) as never)
    jest
      .spyOn(Meta, 'inboxUIItemToConversationMeta')
      .mockReturnValue({...Meta.makeConversationMeta(), conversationIDKey: newKey, tlfname: tlfName})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    renderThread([textAt(10)])

    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))

    expect(rpc.calls('createAdhocConversation')).toEqual([
      [['testuser', 'testuser2'], Strings.waitingKeyChatCreating],
    ])
    expect(getInboxConversationMeta(newKey)).toBeDefined()
    expect(navigate).toHaveBeenCalledWith(newKey, 'createdMessagePrivately', {
      intent: {text: '> message 10\n', type: 'injectText'},
    })
  })

  test('a missing message creates nothing', async () => {
    renderThread()
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('createAdhocConversation')).toEqual([])
  })
})

describe('setMarkAsUnread', () => {
  const markReads = () => rpc.params('markRead')

  test('a loaded thread marks unread from the newest message below the line', async () => {
    const {result} = renderThread([textAt(10), textAt(15), textAt(20)])
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(rpc.calls('loadThread')).toEqual([])
    expect(markReads()).toEqual([
      {conversationIDKey, forceUnread: true, msgID: T.Chat.numberToMessageID(15)},
    ])
  })

  test('no read position uses the meta line', async () => {
    const {result} = renderThread([textAt(10), textAt(15), textAt(20)])
    await run(() => result.current.actions.setMarkAsUnread())
    expect(markReads()).toEqual([expect.objectContaining({msgID: T.Chat.numberToMessageID(15)})])
  })

  test('an empty thread asks the service for the second newest message', async () => {
    rpc.on('loadThread', async p => {
      p.onCachedThread?.(JSON.stringify({messages: [{valid: {messageID: 20}}, {valid: {messageID: 18}}]}))
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderThread()
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(rpc.params('loadThread')[0]?.pagination).toEqual({last: false, next: '', num: 2, previous: ''})
    expect(markReads()).toEqual([expect.objectContaining({msgID: T.Chat.numberToMessageID(18)})])
  })

  test('an empty thread whose load fails falls back to the line itself', async () => {
    rpc.fail('loadThread', new Error('offline'))
    const {result} = renderThread()
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(markReads()).toEqual([expect.objectContaining({msgID: T.Chat.numberToMessageID(20)})])
  })

  test('false and logged out do nothing', async () => {
    const {result} = renderThread([textAt(10)])
    await run(() => result.current.actions.setMarkAsUnread(false))
    useConfigState.setState({loggedIn: false})
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(markReads()).toEqual([])
  })
})

describe('setExplodingMode', () => {
  test('a local change is persisted to gregor, an incoming one is not', async () => {
    const {result} = renderThread()
    await run(() => result.current.actions.setExplodingMode(60, true))
    expect(rpc.calls('setExplodingMode')).toEqual([])
    expect(result.current.store.getState().explodingMode).toBe(60)

    await run(() => result.current.actions.setExplodingMode(300))
    expect(rpc.calls('setExplodingMode')).toEqual([[conversationIDKey, 300]])
    expect(result.current.store.getState().explodingMode).toBe(300)
  })
})

describe('journeycards and unfurl prompts', () => {
  test('dismissing a journeycard tells the service and drops the row', async () => {
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('dismissJourneycard')).toEqual([[conversationIDKey, T.RPCChat.JourneycardType.welcome]])
    expect(message(10)).toBeUndefined()
  })

  test('the row goes even when the service refuses', async () => {
    rpc.fail('dismissJourneycard', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    expect(message(10)).toBeUndefined()
  })

  test('resolving an unfurl prompt clears it locally and sends the answer', async () => {
    const {result} = renderThread()
    const messageID = T.Chat.numberToMessageID(50)
    act(() => {
      result.current.actions.showUnfurlPrompt(messageID, 'a.com')
    })
    const answer = {actionType: T.RPCChat.UnfurlPromptAction.always} as T.RPCChat.UnfurlPromptResult
    await run(() => result.current.resolveUnfurlPrompt(messageID, 'a.com', answer))
    expect(result.current.store.getState().unfurlPrompt.get(messageID)?.has('a.com')).toBe(false)
    expect(rpc.params('resolveUnfurlPrompt')).toEqual([{conversationIDKey, messageID, result: answer}])
  })
})

test('an attachment on the thread is no different for delete', async () => {
  const attachment = makeMessageAttachment({
    conversationIDKey,
    id: T.Chat.numberToMessageID(10),
    ordinal: T.Chat.numberToOrdinal(10),
  })
  renderThread([attachment])
  await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
  expect(rpc.params('postDelete')).toEqual([expect.objectContaining({messageID: T.Chat.numberToMessageID(10)})])
})

describe('messageDelete edges', () => {
  test('a message missing from the thread sends nothing', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(11)))
    expect(rpc.log).toEqual([])
    expect(warn).toHaveBeenCalledWith('Deleting invalid message')
  })

  test('only a text row shows deleting', async () => {
    const pending = deferred<undefined>()
    rpc.on('postDelete', async () => pending.promise)
    const attachment = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
    })
    const {message} = renderThread([attachment])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('postDelete')).toHaveLength(1)
    expect(message(10)?.submitState).toBeUndefined()
    await act(async () => {
      pending.resolve(undefined)
      await flushPromises()
    })
  })

  test('a service failure is logged as a warning', async () => {
    rpc.fail('postDelete', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error')
    renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('messageDelete: failed to delete: '))
    expect(error).not.toHaveBeenCalled()
  })

  test('the revert only undoes its own deleting state', async () => {
    const pending = deferred<undefined>()
    rpc.on('postDelete', async () => pending.promise)
    const {message, result} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    act(() => {
      result.current.actions.setMessageSubmitState(T.Chat.numberToOrdinal(10), 'failed')
    })
    await act(async () => {
      pending.reject(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
      await flushPromises()
    })
    expect(message(10)?.submitState).toBe('failed')
  })

  test('an unsent row stays, deleting, until the cancel lands', async () => {
    const pending = deferred<undefined>()
    rpc.on('cancelPost', async () => pending.promise)
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBe('deleting')
    await act(async () => {
      pending.resolve(undefined)
      await flushPromises()
    })
    expect(message(10)).toBeUndefined()
  })

  test('the tlfName is empty when the meta has none', async () => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, tlfname: ''}], undefined, {force: true})
    renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(rpc.params('postDelete')).toEqual([expect.objectContaining({tlfName: ''})])
  })
})

describe('toggleMessageReaction edges', () => {
  const reactionsBy = (...usernames: Array<string>): T.Chat.Reactions =>
    new Map([[':+1:', {decorated: ':+1:', users: usernames.map(username => ({timestamp: 1, username}))}]])

  test('the optimistic reaction records the add, the target and the user', async () => {
    const {result} = renderThread([textAt(10)])
    const before = Date.now()
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    const [reaction] = [...result.current.store.getState().optimisticReactionMap.values()]
    expect(reaction!.timestamp).toBeGreaterThanOrEqual(before)
    expect({...reaction, timestamp: 0}).toEqual({
      add: true,
      decorated: ':+1:',
      emoji: ':+1:',
      targetOrdinal: T.Chat.numberToOrdinal(10),
      timestamp: 0,
      username: 'testuser',
    })
  })

  test('an emoji you already reacted with is removed', async () => {
    const {result} = renderThread([textAt(10, {reactions: reactionsBy('testuser2', 'testuser')})])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    const [reaction] = [...result.current.store.getState().optimisticReactionMap.values()]
    expect(reaction?.add).toBe(false)
    expect(rpc.params('postReaction')).toEqual([expect.objectContaining({emoji: ':+1:'})])
  })

  test('someone else reacting with it is still an add', async () => {
    const {result} = renderThread([textAt(10, {reactions: reactionsBy('testuser2')})])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    const [reaction] = [...result.current.store.getState().optimisticReactionMap.values()]
    expect(reaction?.add).toBe(true)
  })

  test('a second toggle while the first is pending reads the optimistic state', async () => {
    const pending = deferred<undefined>()
    rpc.on('postReaction', async () => pending.promise)
    const {result} = renderThread([textAt(10)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect([...result.current.store.getState().optimisticReactionMap.values()].map(r => r.add)).toEqual([
      true,
      false,
    ])
    const [first, second] = rpc.params('postReaction')
    expect(first?.outboxID).not.toEqual(second?.outboxID)
    await act(async () => {
      pending.resolve(undefined)
      await flushPromises()
    })
  })

  test('the clientPrev skips trailing unsent messages', async () => {
    renderThread([textAt(10), textAt(12), textAt(13, {id: T.Chat.numberToMessageID(0)})])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(rpc.params('postReaction')).toEqual([
      expect.objectContaining({clientPrev: T.Chat.numberToMessageID(12)}),
    ])
  })

  test('nothing happens for an empty emoji, a missing message or no user', async () => {
    const {result} = renderThread([textAt(10)])
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ''))
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(11), ':+1:'))
    act(() => {
      useCurrentUserState.getState().dispatch.setBootstrap({
        deviceID: '',
        deviceName: '',
        uid: '',
        username: '',
      })
    })
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(rpc.calls('postReaction')).toEqual([])
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
  })

  test('a non-service failure also drops the reaction and is swallowed', async () => {
    rpc.fail('postReaction', new Error('bug'))
    const error = jest.spyOn(logger, 'error')
    const info = jest.spyOn(logger, 'info')
    const {result} = renderThread([textAt(10)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
    expect(error).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalledWith(expect.stringContaining('toggleReaction'))
  })

  test('a service failure is logged as info', async () => {
    rpc.fail('postReaction', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const info = jest.spyOn(logger, 'info')
    renderThread([textAt(10)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(info).toHaveBeenCalledWith(expect.stringContaining('toggleReaction: failed to post'))
  })

  test('without meta the tlfName is empty and the post still goes', async () => {
    renderThread([textAt(10)])
    act(() => {
      useInboxMetadataState.setState({metas: new Map()})
    })
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(rpc.params('postReaction')).toEqual([expect.objectContaining({tlfName: ''})])
  })
})

describe('messageReplyPrivately edges', () => {
  const newConvID = new Uint8Array([9, 9, 9, 9])
  const newKey = T.Chat.conversationIDToKey(newConvID)

  test('a non-text message makes the conversation but does not open it', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: newConvID}}, uiConv: {}}) as never)
    jest
      .spyOn(Meta, 'inboxUIItemToConversationMeta')
      .mockReturnValue({...Meta.makeConversationMeta(), conversationIDKey: newKey})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    const attachment = makeMessageAttachment({
      author: 'testuser2',
      conversationIDKey,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
    })
    renderThread([attachment])
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('createAdhocConversation')).toHaveLength(1)
    expect(navigate).not.toHaveBeenCalled()
    expect(getInboxConversationMeta(newKey)).toBeUndefined()
  })

  test('no meta for the new conversation, no navigation', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: newConvID}}, uiConv: {}}) as never)
    jest.spyOn(Meta, 'inboxUIItemToConversationMeta').mockReturnValue(undefined)
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(navigate).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('replyPrivately: unable to make meta')
  })

  test('an empty conversation id, no navigation', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: new Uint8Array()}}, uiConv: {}}) as never)
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(navigate).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith("replyPrivately: couldn't make a new conversation")
  })

  test('logged out it creates nothing and throws to ignorePromise', async () => {
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread([textAt(10)])
    act(() => {
      useCurrentUserState.getState().dispatch.setBootstrap({deviceID: '', deviceName: '', uid: '', username: ''})
    })
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('createAdhocConversation')).toEqual([])
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('collapse and unfurl edges', () => {
  test('a message missing from the thread reads as expanded', async () => {
    renderThread()
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    expect(rpc.params('toggleCollapse')).toEqual([
      {collapse: true, conversationIDKey, messageID: T.Chat.numberToMessageID(10)},
    ])
  })

  test('a failed collapse goes to ignorePromise', async () => {
    rpc.fail('toggleCollapse', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(RPCError))
  })

  test('a failed unfurl remove goes to ignorePromise', async () => {
    rpc.fail('postDelete', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread()
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(RPCError))
  })
})

describe('dismissJourneycard edges', () => {
  test('the row stays until the service answers', async () => {
    const pending = deferred<undefined>()
    rpc.on('dismissJourneycard', async () => pending.promise)
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    expect(message(10)).toBeDefined()
    await act(async () => {
      pending.resolve(undefined)
      await flushPromises()
    })
    expect(message(10)).toBeUndefined()
  })

  test('a service refusal is logged; any other failure is swallowed; the row goes either way', async () => {
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    rpc.failOnce('dismissJourneycard', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    rpc.failOnce('dismissJourneycard', new Error('bug'))
    const {message} = renderThread([textAt(10), textAt(11)])
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(11)))
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to dismiss journeycard: '))
    expect(message(10)).toBeUndefined()
    expect(message(11)).toBeUndefined()
  })
})
