/** @jest-environment jsdom */
/// <reference types="jest" />
// The thread provider's commands that talk to the service: what each one sends, and what it does
// to the thread store around the call.
import * as Meta from '@/constants/chat/meta'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import type * as React from 'react'
import logger from '@/logger'
import {act, cleanup, fireEvent, renderHook, screen} from '@testing-library/react'
import {getInboxConversationMeta, metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {makeMessageAttachment, makeMessageDeleted, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {answerThreadLoads, getThreadNonblock, holdHandlerTimers, paramsOf, threadLoaded} from '@/test/fake-thread-load'
import {flush, settle} from '@/test/flush'
import {useWaitingState} from '@/stores/waiting'
import {navigationWrapper, type InstalledNavigation} from '@/test/navigation'
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
import {peekInputIntent} from './input-intent-store'
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
const convID = T.Chat.keyToConversationID(conversationIDKey)
let fake: FakeEngine
const tlfName = 'testuser,testuser2'
const chatGui = T.RPCGen.TLFIdentifyBehavior.chatGui

// The service methods the thread's commands reach
const M = {
  cancelPost: 'chat.1.local.CancelPost',
  dismissJourneycard: 'chat.1.local.dismissJourneycard',
  downloadAttachment: 'chat.1.local.DownloadFileAttachmentLocal',
  makeAudioPreview: 'chat.1.local.makeAudioPreview',
  makeUploadTempFile: 'chat.1.local.makeUploadTempFile',
  markRead: 'chat.1.local.markAsReadLocal',
  newConversation: 'chat.1.local.newConversationLocal',
  pinMessage: 'chat.1.local.pinMessage',
  postAttachment: 'chat.1.local.postFileAttachmentLocalNonblock',
  postDelete: 'chat.1.local.postDeleteNonblock',
  postEdit: 'chat.1.local.postEditNonblock',
  postReaction: 'chat.1.local.postReactionNonblock',
  postText: 'chat.1.local.postTextNonblock',
  resolveUnfurlPrompt: 'chat.1.local.resolveUnfurlPrompt',
  retryPost: 'chat.1.local.RetryPost',
  toggleCollapse: 'chat.1.local.toggleMessageCollapse',
  trackGiphySelect: 'chat.1.local.trackGiphySelect',
  updateCategory: 'keybase.1.gregor.updateCategory',
} as const
const sent = (method: keyof typeof M) => paramsOf(fake, M[method])
const serviceError = () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope')
// Holds every call of the method until the test answers it
const holdCalls = (method: keyof typeof M) => fake.hold(M[method])
// Fails every call on a lost link: the engine reports it as a service error
const dropLink = async () => {
  fake.drop()
  await settle()
}

const newConvID = new Uint8Array([9, 9, 9, 9])
const newKey = T.Chat.conversationIDToKey(newConvID)
// The new conversation's inbox item, as the service returns it
const newConvItem = (over?: object) => ({
  botAliases: {},
  botCommands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
  channel: '',
  commands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
  convID: newKey,
  headline: '',
  headlineDecorated: '',
  isDefaultConv: false,
  isEmpty: true,
  isPublic: false,
  localVersion: 1,
  maxMsgID: 0,
  maxVisibleMsgID: 0,
  memberStatus: T.RPCChat.ConversationMemberStatus.active,
  membersType: T.RPCChat.ConversationMembersType.impteamnative,
  name: tlfName,
  readMsgID: 0,
  snippet: '',
  snippetDecorated: '',
  snippetDecoration: T.RPCChat.SnippetDecoration.none,
  status: T.RPCChat.ConversationStatus.unfiled,
  teamType: T.RPCChat.TeamType.none,
  time: 0,
  tlfID: '',
  topicType: T.RPCChat.TopicType.chat,
  version: 1,
  visibility: T.RPCGen.TLFVisibility.private,
  ...over,
})
const created = (uiConv: object = newConvItem(), id = newConvID) => {
  fake.answer(M.newConversation, () => ({conv: {info: {id}}, uiConv}))
}
// meta conversion only takes private conversations, so a public one has no meta
const noMeta = () => newConvItem({visibility: T.RPCGen.TLFVisibility.public})

const textAt = (n: number, over?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    author: 'testuser2',
    conversationIDKey,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    ...over,
  })

let Nav: ReturnType<typeof navigationWrapper>['wrapper']
let nav: Omit<InstalledNavigation, 'setRootState' | 'unmount'>
const wrapper = ({children}: {children: React.ReactNode}) => (
  <Nav>
    <ConversationThreadProvider id={conversationIDKey}>{children}</ConversationThreadProvider>
  </Nav>
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

// Each call crosses the wire both ways, and a chained one again
const run = async (f: () => void) => {
  act(() => {
    f()
  })
  await flush(8)
}

beforeEach(() => {
  const {wrapper, ...recorder} = navigationWrapper({params: {conversationIDKey}, route: 'chatRoot'})
  Nav = wrapper
  nav = recorder
  useConfigState.setState({loggedIn: true})
  fake = installFakeEngine()
  // the calls that answer nothing
  for (const m of [
    M.cancelPost,
    M.dismissJourneycard,
    M.markRead,
    M.pinMessage,
    M.postDelete,
    M.postEdit,
    M.postReaction,
    M.postText,
    M.resolveUnfurlPrompt,
    M.retryPost,
    M.toggleCollapse,
    M.trackGiphySelect,
  ]) {
    fake.answer(m, () => ({}))
  }
  fake.answer(M.updateCategory, () => new Uint8Array())
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
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {result} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID, submitState: 'failed'})])
    await run(() => result.current.actions.retryMessage(outboxID))
    expect(sent('retryPost')).toEqual([{outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)}])
  })
})

describe('messageDelete', () => {
  test('a sent message is marked deleting and deleted by id', async () => {
    const held = holdCalls('postDelete')
    const {message} = renderThread([textAt(10), textAt(11)])

    act(() => {
      cmd.messageDelete(T.Chat.numberToOrdinal(10))
    })
    expect(message(10)?.submitState).toBe('deleting')
    await flush()
    // the thread's own delete sends no clientPrev
    expect(sent('postDelete')).toEqual([
      {
        clientPrev: 0,
        conversationID: convID,
        identifyBehavior: chatGui,
        outboxID: expect.any(Uint8Array),
        supersedes: 10,
        tlfName,
        tlfPublic: false,
      },
    ])
    held[0]!.reply({})
    await flush()
    // success leaves the row to the service's delete notification
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('a sent message with an edit in flight shows deleting too; an unsent one keeps its state', () => {
    holdCalls('postDelete')
    holdCalls('cancelPost')
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
    expect(sent('cancelPost')).toEqual([{outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)}])
    expect(sent('postDelete')).toEqual([])
    expect(message(10)).toBeUndefined()
  })

  test('a message with neither id reverts', async () => {
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0)})])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(sent('cancelPost')).toEqual([])
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a service failure reverts the deleting state', async () => {
    fake.answer(M.postDelete, serviceError)
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a failed cancel reverts and keeps the row', async () => {
    fake.answer(M.cancelPost, serviceError)
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
  })

  // Every failure the engine reports is a service error, a lost link included
  test('a delete on a lost service link reverts and is logged as a failed delete', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {message} = renderThread([textAt(10)])
    await dropLink()
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deleteMessage: failed to delete: '))
  })

  test('without meta the delete still posts, with an empty tlfName, and the row shows deleting', async () => {
    const {message} = renderThread([textAt(10)])
    act(() => {
      metasReceived([], [conversationIDKey])
    })
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(sent('postDelete')).toEqual([expect.objectContaining({tlfName: ''})])
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('without meta an unsent message is still cancelled: a cancel needs no tlfName', async () => {
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const {message} = renderThread([textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})])
    act(() => {
      metasReceived([], [conversationIDKey])
    })
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(sent('cancelPost')).toEqual([{outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)}])
    expect(message(10)).toBeUndefined()
  })
})

describe('unfurlRemove', () => {
  test('deletes the unfurl message by id', async () => {
    renderThread()
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(sent('postDelete')).toEqual([
      {
        clientPrev: 0,
        conversationID: convID,
        identifyBehavior: chatGui,
        outboxID: null,
        supersedes: 33,
        tlfName,
        tlfPublic: false,
      },
    ])
  })

  test('without meta nothing is sent', async () => {
    renderThread()
    act(() => {
      resetAllStores()
    })
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(sent('postDelete')).toEqual([])
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
        <Nav>
          <ConversationThreadProvider id={conversationIDKey}>
            {children}
            <Collapsed isCollapsed={message.isCollapsed} ordinal={message.ordinal} />
          </ConversationThreadProvider>
        </Nav>
      ),
    })
    act(() => result.current.addMessages([message]))
  }

  test('a collapsed attachment row toggles its own message by id, not by ordinal', async () => {
    renderCollapsed(sentAttachment())
    await clickCollapsed()
    expect(sent('toggleCollapse')).toEqual([{collapse: false, convID, msgID: 12}])
  })

  test('a row with no id yet toggles nothing', async () => {
    renderCollapsed(sentAttachment({id: T.Chat.numberToMessageID(0)}))
    await clickCollapsed()
    expect(sent('toggleCollapse')).toEqual([])
  })

  test('a row whose ordinal is not its id reads its own collapsed state', async () => {
    renderThread([sentAttachment()])
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(12), T.Chat.numberToOrdinal(10.001)))
    expect(sent('toggleCollapse')).toEqual([{collapse: false, convID, msgID: 12}])
  })

  test('a message collapses or expands itself', async () => {
    renderThread([textAt(10), textAt(11, {isCollapsed: true})])
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(11), T.Chat.numberToOrdinal(11)))
    expect(sent('toggleCollapse')).toEqual([
      {collapse: true, convID, msgID: 10},
      {collapse: false, convID, msgID: 11},
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
    expect(sent('toggleCollapse')).toEqual([
      {collapse: false, convID, msgID: 40},
      {collapse: true, convID, msgID: 41},
    ])
  })
})

describe('toggleMessageReaction', () => {
  test('posts with the thread clientPrev, the meta tlfName and the optimistic outbox id', async () => {
    const {result} = renderThread([textAt(10), textAt(12)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(sent('postReaction')).toEqual([
      {
        body: ':+1:',
        clientPrev: 12,
        conversationID: convID,
        identifyBehavior: chatGui,
        outboxID: expect.any(Uint8Array),
        supersedes: 10,
        tlfName,
        tlfPublic: false,
      },
    ])
    const outboxID = sent('postReaction')[0]?.outboxID as Uint8Array
    expect([...result.current.store.getState().optimisticReactionMap.keys()]).toEqual([
      T.Chat.rpcOutboxIDToOutboxID(outboxID),
    ])
  })

  test('a failed post drops the optimistic reaction', async () => {
    fake.answer(M.postReaction, serviceError)
    const {result} = renderThread([textAt(10)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
  })

  test('nothing is posted for an unsent or exploded message', async () => {
    renderThread([textAt(10, {id: T.Chat.numberToMessageID(0)}), textAt(11, {exploded: true})])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(11), ':+1:'))
    expect(sent('postReaction')).toEqual([])
  })
})

describe('messageReplyPrivately', () => {
  test('creates the adhoc conversation and opens it with the quote', async () => {
    const held = fake.hold(M.newConversation)
    renderThread([textAt(10)])

    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(useWaitingState.getState().counts.get(Strings.waitingKeyChatCreating)).toBe(1)
    held[0]!.reply({conv: {info: {id: newConvID}}, uiConv: newConvItem()})
    await flush(8)

    expect(sent('newConversation')).toEqual([expect.objectContaining({tlfName})])
    expect(getInboxConversationMeta(newKey)).toBeDefined()
    expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey: newKey}})
    expect(peekInputIntent(newKey, ['injectText'])).toEqual({text: '> message 10\n', type: 'injectText'})
  })

  test('a missing message creates nothing', async () => {
    renderThread()
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(fake.calls).toEqual([])
  })
})

describe('setMarkAsUnread', () => {
  const markReads = () => sent('markRead')
  // the messages the service streams back for a centered load around the line
  const valid = (messageID: number) => ({state: T.RPCChat.MessageUnboxedState.valid, valid: {messageID}})

  test('a loaded thread marks unread from the newest message below the line', async () => {
    const {result} = renderThread([textAt(10), textAt(15), textAt(20)])
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    expect(paramsOf(fake, getThreadNonblock)).toEqual([])
    expect(markReads()).toEqual([{conversationID: convID, forceUnread: true, msgID: 15}])
  })

  test('no read position uses the meta line', async () => {
    const {result} = renderThread([textAt(10), textAt(15), textAt(20)])
    await run(() => result.current.actions.setMarkAsUnread())
    expect(markReads()).toEqual([expect.objectContaining({msgID: 15})])
  })

  // the service streams the cached pass, then answers once that has been handed to its handler
  test('an empty thread asks the service for the messages around the line', async () => {
    answerThreadLoads(fake, async l => {
      await l.cached(JSON.stringify({messages: [valid(20), valid(18)]}))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const {result} = renderThread()
    await run(() => result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20)))
    await act(settle)
    await flush(8)
    expect(paramsOf(fake, getThreadNonblock)[0]?.query.messageIDControl).toEqual({
      mode: T.RPCChat.MessageIDControlMode.centered,
      num: 3,
      pivot: 20,
    })
    expect(markReads()).toEqual([expect.objectContaining({msgID: 18})])
  })

  // loadConversationMessageIDs (data-hooks) reads the ids the passes streamed as soon as the load
  // resolves. The listener hands each pass to its handler on a 0ms timer after the session acked
  // it, so the service can answer first; the load still resolves only after the pass is read.
  test('an empty thread marks unread around the line when the service answers at once', async () => {
    answerThreadLoads(fake, async l => {
      const timers = holdHandlerTimers()
      await l.cached(JSON.stringify({messages: [valid(20), valid(18)]}))
      return timers.replyFirst(threadLoaded)
    })
    const {result} = renderThread()
    act(() => {
      result.current.actions.setMarkAsUnread(T.Chat.numberToMessageID(20))
    })
    await act(settle)
    await flush(8)
    expect(paramsOf(fake, getThreadNonblock)).toHaveLength(1)
    expect(markReads()).toEqual([expect.objectContaining({msgID: 18})])
  })

  test('an empty thread whose load fails marks nothing', async () => {
    answerThreadLoads(fake, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))
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
    expect(sent('updateCategory')).toEqual([])
    expect(result.current.store.getState().explodingMode).toBe(60)

    await run(() => result.current.actions.setExplodingMode(300))
    expect(sent('updateCategory')).toEqual([
      {body: '300', category: `exploding:${conversationIDKey}`, dtime: {offset: 0, time: 0}},
    ])
    expect(result.current.store.getState().explodingMode).toBe(300)
  })
})

describe('journeycards and unfurl prompts', () => {
  test('dismissing a journeycard tells the service and drops the row', async () => {
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    expect(sent('dismissJourneycard')).toEqual([{cardType: T.RPCChat.JourneycardType.welcome, convID}])
    expect(message(10)).toBeUndefined()
  })

  test('the row goes even when the service refuses', async () => {
    fake.answer(M.dismissJourneycard, serviceError)
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
    expect(sent('resolveUnfurlPrompt')).toEqual([
      {convID, identifyBehavior: chatGui, msgID: 50, result: {actionType: T.RPCChat.UnfurlPromptAction.always}},
    ])
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
  expect(sent('postDelete')).toEqual([expect.objectContaining({supersedes: 10})])
})

describe('messageDelete edges', () => {
  test('a message missing from the thread sends nothing', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(11)))
    expect(fake.calls).toEqual([])
    expect(warn).toHaveBeenCalledWith('deleteMessage: message not in the thread')
  })

  test('an attachment row shows deleting, like a text row', async () => {
    const held = holdCalls('postDelete')
    const attachment = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
    })
    const {message} = renderThread([attachment])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(sent('postDelete')).toHaveLength(1)
    expect(message(10)?.submitState).toBe('deleting')
    held[0]!.reply({})
    await flush()
  })

  test('a failed attachment delete reverts its deleting state', async () => {
    const held = holdCalls('postDelete')
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const attachment = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
    })
    const {message} = renderThread([attachment])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBe('deleting')
    held[0]!.reply(serviceError())
    await flush()
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a failed upload whose cancel fails is failed again, not sent', async () => {
    fake.answer(M.cancelPost, serviceError)
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
    expect(sent('cancelPost')).toEqual([{outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)}])
    expect(message(10)?.submitState).toBe('failed')
  })

  test('a pending text whose cancel fails is pending again', async () => {
    fake.answer(M.cancelPost, serviceError)
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
    fake.answer(M.postDelete, serviceError)
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error')
    renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deleteMessage: failed to delete: '))
    expect(error).not.toHaveBeenCalled()
  })

  test('a server update to the row while its delete is in flight keeps it deleting', async () => {
    const held = holdCalls('postDelete')
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {message, result} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    act(() => {
      result.current.actions.addMessages([textAt(10, {text: new HiddenString('unfurled')})], {liveUpdate: true})
    })
    const updated = message(10)
    expect(updated?.submitState).toBe('deleting')
    expect(updated?.type === 'text' && updated.text.stringValue()).toBe('unfurled')
    held[0]!.reply(serviceError())
    await flush()
    expect(message(10)?.submitState).toBeUndefined()
  })

  test('a failed delete undoes only its own mark: a second delete of the row still pending keeps it deleting', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const held = holdCalls('postDelete')
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    held[0]!.reply({})
    held[1]!.reply(serviceError())
    await flush()
    expect(message(10)?.submitState).toBe('deleting')
  })

  test('a delete the service queued and then failed stops showing deleting', async () => {
    const {message, result} = renderThread([textAt(10), textAt(11)])
    await run(() => cmd.messageDelete(T.Chat.numberToOrdinal(10)))
    expect(message(10)?.submitState).toBe('deleting')
    const deleteOutboxID = sent('postDelete')[0]?.outboxID as Uint8Array
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
      const held = holdCalls('cancelPost')
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
      held[0]!.reply({})
      await flush()
      expect(message(10)).toBeUndefined()
    }
  )

  test('only a sent row shows deleting', async () => {
    holdCalls('cancelPost')
    holdCalls('postDelete')
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
    expect(sent('postDelete')).toEqual([expect.objectContaining({tlfName: ''})])
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
    expect(sent('postReaction')).toEqual([expect.objectContaining({body: ':+1:'})])
  })

  test('someone else reacting with it is still an add', async () => {
    const {result} = renderThread([textAt(10, {reactions: reactionsBy('testuser2')})])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    const [reaction] = [...result.current.store.getState().optimisticReactionMap.values()]
    expect(reaction?.add).toBe(true)
  })

  test('a second toggle while the first is pending reads the optimistic state', async () => {
    const held = holdCalls('postReaction')
    const {result} = renderThread([textAt(10)])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect([...result.current.store.getState().optimisticReactionMap.values()].map(r => r.add)).toEqual([
      true,
      false,
    ])
    const [first, second] = sent('postReaction')
    expect(first?.outboxID).not.toEqual(second?.outboxID)
    held.forEach(h => h.reply({}))
    await flush()
  })

  test('the clientPrev skips trailing unsent messages', async () => {
    renderThread([textAt(10), textAt(12), textAt(13, {id: T.Chat.numberToMessageID(0)})])
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(sent('postReaction')).toEqual([expect.objectContaining({clientPrev: 12})])
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
    expect(sent('postReaction')).toEqual([])
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
  })

  // Every failure the engine reports is a service error, a lost link included, so the error-level
  // branch is for a bug in the app's own code and the service cannot reach it
  test('a lost service link also drops the reaction and is logged as info', async () => {
    const info = jest.spyOn(logger, 'info')
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {result} = renderThread([textAt(10)])
    await dropLink()
    await run(() => cmd.toggleMessageReaction(T.Chat.numberToOrdinal(10), ':+1:'))
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
    expect(info).toHaveBeenCalledWith(expect.stringContaining('toggleReaction: failed to post'))
    expect(error).not.toHaveBeenCalled()
  })

  test('a service failure is logged as info', async () => {
    fake.answer(M.postReaction, serviceError)
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
    expect(sent('postReaction')).toEqual([expect.objectContaining({tlfName: ''})])
    expect(result.current.store.getState().optimisticReactionMap.size).toBe(1)
  })
})

describe('messageReplyPrivately edges', () => {
  test('a non-text message makes the conversation but does not open it', async () => {
    created()
    const attachment = makeMessageAttachment({
      author: 'testuser2',
      conversationIDKey,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
    })
    renderThread([attachment])
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(sent('newConversation')).toHaveLength(1)
    expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey}})
    expect(getInboxConversationMeta(newKey)).toBeUndefined()
  })

  test('no meta for the new conversation, no navigation', async () => {
    created(noMeta())
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey}})
    expect(warn).toHaveBeenCalledWith('replyPrivately: unable to make meta')
  })

  test('an empty conversation id, no navigation', async () => {
    created(newConvItem(), new Uint8Array())
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey}})
    expect(warn).toHaveBeenCalledWith("replyPrivately: couldn't make a new conversation")
  })

  test('logged out it creates nothing: the thread has retired', async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread([textAt(10)])
    act(() => {
      useCurrentUserState.getState().dispatch.setBootstrap({deviceID: '', deviceName: '', uid: '', username: ''})
    })
    await run(() => cmd.messageReplyPrivately(T.Chat.numberToOrdinal(10)))
    expect(fake.calls).toEqual([])
  })
})

describe('collapse and unfurl edges', () => {
  test('a message missing from the thread reads as expanded', async () => {
    renderThread()
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    expect(sent('toggleCollapse')).toEqual([{collapse: true, convID, msgID: 10}])
  })

  // Every failure the engine reports is a service error, a lost link included, so the
  // ignorePromise branch is for a bug in the app's own code and the service cannot reach it
  test('a service refusal of a collapse, or a lost link, is logged as a failed toggle', async () => {
    fake.answer(M.toggleCollapse, serviceError)
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread([textAt(10)])
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    await dropLink()
    await run(() => cmd.toggleMessageCollapse(T.Chat.numberToMessageID(10), T.Chat.numberToOrdinal(10)))
    expect(warn.mock.calls.filter(c => String(c[0]).startsWith('toggleCollapse'))).toEqual([
      [expect.stringContaining('toggleCollapse: failed to toggle collapse: ')],
      [expect.stringContaining('toggleCollapse: failed to toggle collapse: ')],
    ])
    expect(error).not.toHaveBeenCalled()
  })

  test('a service refusal of an unfurl remove, or a lost link, is logged as a failed remove', async () => {
    fake.answer(M.postDelete, serviceError)
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderThread()
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    await dropLink()
    await run(() => cmd.unfurlRemove(T.Chat.numberToMessageID(33)))
    expect(warn.mock.calls.filter(c => String(c[0]).startsWith('removeUnfurl'))).toEqual([
      [expect.stringContaining('removeUnfurl: failed to remove unfurl: ')],
      [expect.stringContaining('removeUnfurl: failed to remove unfurl: ')],
    ])
    expect(error).not.toHaveBeenCalled()
  })
})

describe('dismissJourneycard edges', () => {
  test('the row stays until the service answers', async () => {
    const held = holdCalls('dismissJourneycard')
    const {message} = renderThread([textAt(10)])
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    expect(message(10)).toBeDefined()
    held[0]!.reply({})
    await flush()
    expect(message(10)).toBeUndefined()
  })

  // Every failure the engine reports is a service error, a lost link included
  test('a service refusal and a lost link are both logged; the row goes either way', async () => {
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    fake.answer(M.dismissJourneycard, serviceError)
    const {message} = renderThread([textAt(10), textAt(11)])
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(10)))
    await dropLink()
    await run(() => cmd.dismissJourneycard(T.RPCChat.JourneycardType.welcome, T.Chat.numberToOrdinal(11)))
    expect(error.mock.calls).toEqual([
      [expect.stringContaining('Failed to dismiss journeycard: ')],
      [expect.stringContaining('Failed to dismiss journeycard: ')],
    ])
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
  const asked = () => fake.calls.map(c => c.method)

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
    expect(asked()).toEqual([])
  })

  test('before the switch its paste uploads the image', async () => {
    fake.hold(M.makeUploadTempFile)
    const screen = renderScreen()
    await run(() => {
      screen.attachments.pasteAttachment(new Uint8Array([1]))
    })
    expect(asked()).toEqual([M.makeUploadTempFile])
  })

  test('a giphy or audio send that was waiting on the service when the account left posts nothing', async () => {
    const tracked = fake.hold(M.trackGiphySelect)
    const preview = fake.hold(M.makeAudioPreview)
    const screen = renderScreen()
    let audio: Promise<void> | undefined
    await run(() => {
      screen.send.sendGiphyResult(giphy)
      audio = screen.send.sendAudioRecording('/tmp/a.m4a', 1000, [1])
    })
    nextAccount()
    tracked[0]!.reply({})
    preview[0]!.reply({filename: 'preview.png', mimeType: 'image/png', previewMimeType: 'image/png'})
    await act(async () => {
      await audio
    })
    await flush(8)
    expect(sent('postText')).toEqual([])
    expect(sent('postAttachment')).toEqual([])
  })
})
