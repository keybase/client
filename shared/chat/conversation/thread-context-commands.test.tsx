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
import {makeMessageAttachment, makeMessageDeleted, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {
  deleteMessage,
  dismissJourneycard,
  pinMessage,
  removeUnfurl,
  replyPrivately,
  toggleCollapse,
  toggleReaction,
} from './message-commands'
import {Collapsed} from './messages/attachment/shared'
import {useConversationAttachmentActions} from './attachment-actions'
import {useConversationSendActions} from './send-actions'
import {applyFailedMessageToThread} from './thread-engine'
import {
  ConversationThreadProvider,
  getConversationThreadDisplayMessage,
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
  // the row as the thread shows it
  const message = (n: number) =>
    getConversationThreadDisplayMessage(result.current.store.getState(), T.Chat.numberToOrdinal(n))
  const row = (ordinal: T.Chat.Ordinal) => ({conversationIDKey, ordinal, thread: result.current.actions})
  cmd = {
    dismissJourneycard: (cardType, ordinal) => dismissJourneycard(row(ordinal), cardType),
    messageDelete: ordinal => deleteMessage(row(ordinal)),
    messageReplyPrivately: ordinal => replyPrivately(row(ordinal)),
    toggleMessageCollapse: (messageID, ordinal) => toggleCollapse(row(ordinal), messageID),
    toggleMessageReaction: (ordinal, emoji) => toggleReaction(row(ordinal), emoji),
    unfurlRemove: messageID => removeUnfurl(row(T.Chat.numberToOrdinal(0)), messageID),
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
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {result} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID, submitState: 'failed'})])
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
      {conversationIDKey, messageID: T.Chat.numberToMessageID(10), outboxID: expect.any(Uint8Array), tlfName},
    ])
    await act(async () => {
      pending.resolve(undefined)
      await flushPromises()
    })
    // success leaves the row to the service's delete notification
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('a sent message with an edit in flight shows deleting too; an unsent one keeps its state', () => {
    rpc.on('postDelete', async () => deferred<undefined>().promise)
    rpc.on('cancelPost', async () => deferred<undefined>().promise)
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([
      textAt(10, {submitState: 'editing'}),
      textAt(11, {id: T.Chat.numberToMessageID(0), outboxID, submitState: 'pending'}),
      textAt(12, {id: T.Chat.numberToMessageID(0), outboxID: T.Chat.stringToOutboxID('0c0d'), submitState: 'failed'}),
    ])
    act(() => {
      cmd.messageDelete(T.Chat.numberToOrdinal(10))
      cmd.messageDelete(T.Chat.numberToOrdinal(11))
      cmd.messageDelete(T.Chat.numberToOrdinal(12))
    })
    expect(message(10)?.submitState).toBe('deleting')
    expect(message(11)?.submitState).toBe('pending')
    expect(message(12)?.submitState).toBe('failed')
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

  test('without meta the delete still posts, with an empty tlfName, and the row shows deleting', async () => {
    const {message} = renderThread([textAt(10)])
    act(() => {
      metasReceived([], [conversationIDKey])
    })
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(rpc.params('postDelete')).toEqual([expect.objectContaining({tlfName: ''})])
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('without meta an unsent message is still cancelled: a cancel needs no tlfName', async () => {
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})])
    act(() => {
      metasReceived([], [conversationIDKey])
    })
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('cancelPost')).toEqual([[outboxID]])
    expect(message(10)).toBeUndefined()
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

  test('an empty thread asks the service for the messages around the line', async () => {
    rpc.on('loadThread', async p => {
      const valid = (messageID: number) => ({state: T.RPCChat.MessageUnboxedState.valid, valid: {messageID}})
      p.onCachedThread?.(JSON.stringify({messages: [valid(20), valid(18)]}))
      await Promise.resolve()
      return {offline: false}
    })
    const {result} = renderThread()
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(rpc.params('loadThread')[0]?.messageIDControl).toEqual({
      mode: T.RPCChat.MessageIDControlMode.centered,
      num: 3,
      pivot: T.Chat.numberToMessageID(20),
    })
    expect(markReads()).toEqual([expect.objectContaining({msgID: T.Chat.numberToMessageID(18)})])
  })

  test('an empty thread whose load fails marks nothing', async () => {
    rpc.fail('loadThread', new Error('offline'))
    const {result} = renderThread()
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(markReads()).toEqual([])
  })

  test('logged out it does nothing', async () => {
    const {result} = renderThread([textAt(10), textAt(20)])
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
    expect(warn).toHaveBeenCalledWith('deleteMessage: message not in the thread')
  })

  test('an attachment row shows deleting, like a text row', async () => {
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
    expect(message(10)?.submitState).toBe('deleting')
    await act(async () => {
      pending.resolve(undefined)
      await flushPromises()
    })
  })

  test('a failed attachment delete reverts its deleting state', async () => {
    const pending = deferred<undefined>()
    rpc.on('postDelete', async () => pending.promise)
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const attachment = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
    })
    const {message} = renderThread([attachment])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBe('deleting')
    await act(async () => {
      pending.reject(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
      await flushPromises()
    })
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a failed upload whose cancel fails is failed again, not sent', async () => {
    rpc.fail('cancelPost', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const attachment = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(0),
      ordinal: T.Chat.numberToOrdinal(10),
      outboxID,
      submitState: 'failed',
    })
    const {message} = renderThread([attachment])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('cancelPost')).toEqual([[outboxID]])
    expect(message(10)?.submitState).toBe('failed')
  })

  test('a pending text whose cancel fails is pending again', async () => {
    rpc.fail('cancelPost', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([
      textAt(10, {id: T.Chat.numberToMessageID(0), outboxID, submitState: 'pending'}),
    ])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBe('pending')
  })

  test('a failed text with neither id is failed again', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), submitState: 'failed'})])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBe('failed')
  })

  test('a service failure is logged as a warning', async () => {
    rpc.fail('postDelete', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error')
    renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deleteMessage: failed to delete: '))
    expect(error).not.toHaveBeenCalled()
  })

  test('a server update to the row while its delete is in flight keeps it deleting', async () => {
    const pending = deferred<undefined>()
    rpc.on('postDelete', async () => pending.promise)
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {message, result} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    act(() => {
      result.current.actions.addMessages([textAt(10, {text: new HiddenString('unfurled')})], {liveUpdate: true})
    })
    const updated = message(10)
    expect(updated?.submitState).toBe('deleting')
    expect(updated?.type === 'text' && updated.text.stringValue()).toBe('unfurled')
    await act(async () => {
      pending.reject(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
      await flushPromises()
    })
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a failed delete undoes only its own mark: a second delete of the row still pending keeps it deleting', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const second = deferred<undefined>()
    rpc.once('postDelete', () => undefined)
    rpc.once('postDelete', async () => second.promise)
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    await act(async () => {
      second.reject(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
      await flushPromises()
    })
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('a delete the service queued and then failed stops showing deleting', async () => {
    const {message, result} = renderThread([textAt(10), textAt(11)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBe('deleting')
    const deleteOutboxID = rpc.params('postDelete')[0]?.outboxID
    act(() => {
      applyFailedMessageToThread(
        conversationIDKey,
        {
          isEphemeralPurge: false,
          outboxRecords: [
            {
              convID: T.Chat.keyToConversationID(conversationIDKey),
              outboxID: deleteOutboxID,
              state: {error: {message: 'nope', typ: T.RPCChat.OutboxErrorType.misc}, state: T.RPCChat.OutboxStateType.error},
            } as unknown as T.RPCChat.OutboxRecord,
          ],
        },
        result.current.actions
      )
    })
    expect(message(10)?.submitState).toBeUndefined()
    expect(message(11)?.submitState).toBeUndefined()
  })

  // A thread load never carries a queued delete (the service sprinkles only unsent text and
  // attachments from its outbox into a thread), so a load still holding the row says nothing about
  // whether the delete will happen: offline or slow, the delete may still be waiting to go out.
  test('a thread load carrying the row, cached or full, keeps it deleting while the delete is queued', async () => {
    const {message, result} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    const load = (prune: boolean) =>
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(10)],
        moreToLoad: false,
        reconcile: {carried: new Set(), prune},
        scrollDirection: 'none',
      })
    act(() => load(false))
    expect(message(10)?.submitState).toBe('deleting')
    act(() => load(true))
    expect(message(10)?.submitState).toBe('deleting')
    act(() => {
      result.current.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [makeMessageDeleted({conversationIDKey, id: T.Chat.numberToMessageID(10), ordinal: T.Chat.numberToOrdinal(10)})],
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
    expect(message(10)?.submitState).toBeUndefined()
    expect(result.current.store.getState().pendingDeleteMap.size).toBe(0)
  })

  test('a reaction or unfurl update to the row mid-delete keeps it deleting', async () => {
    const {message, result} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    act(() => {
      result.current.actions.updateReactions([
        {
          reactions: new Map([[':+1:', {decorated: ':+1:', users: [{timestamp: 1, username: 'testuser2'}]}]]),
          targetMsgID: T.Chat.numberToMessageID(10),
        },
      ])
      result.current.actions.addMessages([textAt(10, {text: new HiddenString('unfurled')})], {liveUpdate: true})
    })
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('the delete notification removes the row and its pending delete', async () => {
    const {message, result} = renderThread([textAt(10), textAt(11)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(11)))
    act(() => {
      result.current.actions.deleteMessages({liveUpdate: true, messageIDs: [T.Chat.numberToMessageID(10)]})
      result.current.actions.explodeMessages([T.Chat.numberToMessageID(11)], 'testuser', true)
    })
    expect(message(10)).toBeUndefined()
    expect(message(11)?.submitState).toBeUndefined()
    expect(result.current.store.getState().pendingDeleteMap.size).toBe(0)
  })

  // a live update can carry the delete: a deleted placeholder takes the row out, and an exploding
  // message's delete comes back as the row itself, exploded
  test.each([
    [
      'a deleted placeholder',
      makeMessageDeleted({
        conversationIDKey,
        id: T.Chat.numberToMessageID(10),
        ordinal: T.Chat.numberToOrdinal(10),
      }),
    ],
    ['the row exploded', textAt(10, {exploded: true, explodedBy: 'testuser', exploding: true})],
  ])('a delete landing in a live update as %s clears its pending delete', async (_, update) => {
    const {message, result} = renderThread([textAt(10, {exploding: true}), textAt(11)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(11)))
    act(() => {
      result.current.actions.addMessages([update], {liveUpdate: true})
    })
    expect(message(10)?.submitState).toBeUndefined()
    expect([...result.current.store.getState().pendingDeleteMap.values()]).toEqual([T.Chat.numberToOrdinal(11)])
    expect(message(11)?.submitState).toBe('deleting')
  })

  test('clearing the thread drops its pending deletes', async () => {
    const {result} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    act(() => {
      result.current.actions.messagesClear()
    })
    expect(result.current.store.getState().pendingDeleteMap.size).toBe(0)
  })

  // the renderers read pending and failed (an unsent video does not play, an unsent audio has no
  // url), so a row being cancelled keeps its state until the cancel removes it
  test.each(['pending', 'failed'] as const)(
    'an unsent %s upload keeps its state until the cancel lands',
    async submitState => {
      const pending = deferred<undefined>()
      rpc.on('cancelPost', async () => pending.promise)
      const outboxID = T.Chat.stringToOutboxID('0a0b')
      const {message} = renderThread([
        makeMessageAttachment({
          conversationIDKey,
          id: T.Chat.numberToMessageID(0),
          ordinal: T.Chat.numberToOrdinal(10),
          outboxID,
          submitState,
        }),
      ])
      await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
      expect(message(10)?.submitState).toBe(submitState)
      await act(async () => {
        pending.resolve(undefined)
        await flushPromises()
      })
      expect(message(10)).toBeUndefined()
    }
  )

  test('only a sent row shows deleting', async () => {
    rpc.on('cancelPost', async () => new Promise<undefined>(() => {}))
    rpc.on('postDelete', async () => new Promise<undefined>(() => {}))
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([
      textAt(10, {id: T.Chat.numberToMessageID(0), outboxID}),
      textAt(11, {submitState: 'editing'}),
      textAt(12),
    ])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(11)))
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(12)))
    expect([message(10)?.submitState, message(11)?.submitState, message(12)?.submitState]).toEqual([
      undefined,
      'deleting',
      'deleting',
    ])
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

  test('a non-service failure also drops the reaction and is logged as an error', async () => {
    const bug = new Error('bug')
    rpc.fail('postReaction', bug)
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {result} = renderThread([textAt(10)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
    expect(error).toHaveBeenCalledWith('toggleReaction: failed to post', bug)
  })

  test('a service failure is logged as info', async () => {
    rpc.fail('postReaction', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const info = jest.spyOn(logger, 'info')
    renderThread([textAt(10)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(info).toHaveBeenCalledWith(expect.stringContaining('toggleReaction: failed to post'))
  })

  // the service fills an empty tlfName from the conversation (Sender.Prepare)
  test('without meta the post goes with an empty tlfName and shows the reaction', async () => {
    const {result} = renderThread([textAt(10)])
    act(() => {
      useInboxMetadataState.setState({metas: new Map()})
    })
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(rpc.params('postReaction')).toEqual([expect.objectContaining({tlfName: ''})])
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(1)
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

  test('logged out it creates nothing: the thread has retired', async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread([textAt(10)])
    act(() => {
      useCurrentUserState.getState().dispatch.setBootstrap({deviceID: '', deviceName: '', uid: '', username: ''})
    })
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(rpc.calls('createAdhocConversation')).toEqual([])
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

  test('a service refusal of a collapse is logged; any other failure goes to ignorePromise', async () => {
    rpc.failOnce('toggleCollapse', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    rpc.failOnce('toggleCollapse', new Error('bug'))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('toggleCollapse: failed to toggle collapse: '))
    expect(error).not.toHaveBeenCalled()
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    expect(error).toHaveBeenCalledWith('ignorePromise error', new Error('bug'))
  })

  test('a service refusal of an unfurl remove is logged; any other failure goes to ignorePromise', async () => {
    rpc.failOnce('postDelete', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    rpc.failOnce('postDelete', new Error('bug'))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread()
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('removeUnfurl: failed to remove unfurl: '))
    expect(error).not.toHaveBeenCalled()
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(error).toHaveBeenCalledWith('ignorePromise error', new Error('bug'))
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

// An account switch keeps logged-in screens up, and the provider rebuilds the thread for the next
// account only on its next render. Until then the old screen's callbacks are still wired to its
// conversation id, which the next account shares for a team's channels.
describe('a screen kept through an account switch, before the provider rebuilds it', () => {
  const nextAccount = () => {
    act(() => {
      useCurrentUserState
        .getState()
        .dispatch.setBootstrap({deviceID: 'device-id2', deviceName: 'testuser-mac', uid: 'uid2', username: 'testuser2'})
    })
  }
  const giphy = {targetUrl: 'https://giphy.example/g.gif'} as T.RPCChat.GiphySearchResult
  const renderScreen = () => {
    const rendered = renderHook(
      () => ({
        actions: useConversationThreadActions(),
        attachments: useConversationAttachmentActions(),
        resolveUnfurlPrompt: useConversationThreadUnfurlResolvePrompt(),
        send: useConversationSendActions(),
      }),
      {wrapper}
    )
    act(() => {
      rendered.result.current.actions.addMessages([
        textAt(10, {author: 'testuser'}),
        makeMessageAttachment({conversationIDKey, id: T.Chat.numberToMessageID(11), ordinal: T.Chat.numberToOrdinal(11)}),
      ])
    })
    return rendered.result.current
  }
  const sent = () =>
    (
      [
        'downloadAttachment',
        'makeAudioPreview',
        'makeUploadTempFile',
        'pinMessage',
        'postAttachment',
        'postDelete',
        'postEdit',
        'postText',
        'resolveUnfurlPrompt',
        'trackGiphySelect',
      ] as const
    ).flatMap(method => rpc.calls(method).map(() => method))

  test('its commands, sends and attachment actions ask the service nothing', async () => {
    const screen = renderScreen()
    const row = {conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread: screen.actions}
    nextAccount()
    await run(() => {
      screen.send.sendMessage('hi')
      screen.send.sendMessage('edited', {editingOrdinal: T.Chat.numberToOrdinal(10)})
      screen.send.sendGiphyResult(giphy)
      screen.attachments.attachmentDownload(T.Chat.numberToOrdinal(11))
      screen.resolveUnfurlPrompt(T.Chat.numberToMessageID(10), 'example.com', {
        actionType: T.RPCChat.UnfurlPromptAction.never,
      } as T.RPCChat.UnfurlPromptResult)
      screen.attachments.pasteAttachment(new Uint8Array([1]))
      removeUnfurl(row, T.Chat.numberToMessageID(12))
      pinMessage(row)
      // the thread's rpc never answers once it has retired, so nothing awaits this
      void screen.send.sendAudioRecording('/tmp/a.m4a', 1000, [1])
    })
    expect(sent()).toEqual([])
  })

  test('before the switch its paste uploads the image', async () => {
    const screen = renderScreen()
    await run(() => {
      screen.attachments.pasteAttachment(new Uint8Array([1]))
    })
    expect(sent()).toEqual(['makeUploadTempFile'])
  })

  test('a giphy or audio send that was waiting on the service when the account left posts nothing', async () => {
    const tracked = deferred<undefined>()
    const preview = deferred<T.RPCChat.MakePreviewRes>()
    rpc.on('trackGiphySelect', async () => tracked.promise)
    rpc.on('makeAudioPreview', async () => preview.promise)
    const screen = renderScreen()
    let audio: Promise<void> | undefined
    await run(() => {
      screen.send.sendGiphyResult(giphy)
      audio = screen.send.sendAudioRecording('/tmp/a.m4a', 1000, [1])
    })
    nextAccount()
    await act(async () => {
      tracked.resolve(undefined)
      preview.resolve({} as T.RPCChat.MakePreviewRes)
      await audio
      await flushPromises()
    })
    expect(rpc.calls('postText')).toEqual([])
    expect(rpc.calls('postAttachment')).toEqual([])
  })
})
