/** @jest-environment jsdom */
/// <reference types="jest" />
// The message-command module against a plain thread handle: which target picks which path, and
// exactly what each path asks of the thread.
import * as Meta from '@/constants/chat/meta'
import {act} from 'react'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import logger from '@/logger'
import {metasReceived} from '@/chat/inbox/metadata'
import {makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {settle} from '@/test/flush'
import {installNavigation, renders, stateShowing} from '@/test/navigation'
import {consumeInputIntent} from './input-intent-store'
import {makeThreadChatRpc} from './chat-rpc'
import type {ConversationThreadState} from './thread-context'
import type {OptimisticReaction} from './thread-message-state'
import {
  deleteMessage,
  dismissJourneycard,
  formatTextForQuoting,
  pinMessage,
  removeUnfurl,
  replyPrivately,
  toggleCollapse,
  toggleReaction,
  unfurlMessage,
  type MessageCommandThread,
} from './message-commands'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)
const tlfName = 'testuser,testuser2'
const chatGui = T.RPCGen.TLFIdentifyBehavior.chatGui
const postDelete = 'chat.1.local.postDeleteNonblock'
const postReaction = 'chat.1.local.postReactionNonblock'
let fake: FakeEngine

const newConvID = new Uint8Array([9, 9, 9, 9])
const newKey = T.Chat.conversationIDToKey(newConvID)
// The new conversation's inbox item, as the service returns it
const newConvItem = {
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
  name: 'testuser,testuser2',
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
}

const textAt = (n: number, over?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    author: 'testuser2',
    conversationIDKey,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    ...over,
  })

// A thread handle over a plain state, recording every write the commands make through it.
const makeThread = (messages: ReadonlyArray<T.Chat.Message>) => {
  let state = {
    messageMap: new Map(messages.map(m => [m.ordinal, m])),
    messageOrdinals: messages.map(m => m.ordinal),
    optimisticReactionMap: new Map<T.Chat.OutboxID, OptimisticReaction>(),
    pendingDeleteMap: new Map<T.Chat.OutboxID, T.Chat.Ordinal>(),
    unfurlPrompt: new Map<T.Chat.MessageID, Set<string>>(),
  } as unknown as ConversationThreadState
  const writes: Array<ReadonlyArray<unknown>> = []
  const thread: MessageCommandThread = {
    addOptimisticReaction: (outboxID, reaction) => {
      writes.push(['addOptimisticReaction', reaction])
      const optimisticReactionMap = new Map(state.optimisticReactionMap)
      optimisticReactionMap.set(outboxID, reaction)
      state = {...state, optimisticReactionMap}
    },
    clearUnfurlPrompt: (messageID, domain) => {
      writes.push(['clearUnfurlPrompt', messageID, domain])
    },
    deleteMessages: p => {
      writes.push(['deleteMessages', p])
    },
    getSnapshot: () => state,
    removeOptimisticReaction: outboxID => {
      writes.push(['removeOptimisticReaction'])
      const optimisticReactionMap = new Map(state.optimisticReactionMap)
      optimisticReactionMap.delete(outboxID)
      state = {...state, optimisticReactionMap}
    },
    addPendingDelete: (outboxID, ordinal) => {
      writes.push(['addPendingDelete', ordinal])
      const pendingDeleteMap = new Map(state.pendingDeleteMap)
      pendingDeleteMap.set(outboxID, ordinal)
      state = {...state, pendingDeleteMap}
    },
    removePendingDelete: outboxID => {
      writes.push(['removePendingDelete', state.pendingDeleteMap.get(outboxID)])
      const pendingDeleteMap = new Map(state.pendingDeleteMap)
      pendingDeleteMap.delete(outboxID)
      state = {...state, pendingDeleteMap}
    },
    rpc: makeThreadChatRpc(() => false),
  }
  const setUnfurlPrompts = (messageID: T.Chat.MessageID, domains: ReadonlyArray<string>) => {
    state = {...state, unfurlPrompt: new Map([[messageID, new Set(domains)]])}
  }
  return {setUnfurlPrompts, thread, writes}
}

beforeEach(() => {
  fake = installFakeEngine()
  for (const m of [
    postDelete,
    postReaction,
    'chat.1.local.CancelPost',
    'chat.1.local.toggleMessageCollapse',
    'chat.1.local.pinMessage',
    'chat.1.local.unfurlMessage',
    'chat.1.local.dismissJourneycard',
  ]) {
    fake.answer(m, () => ({}))
  }
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
        maxVisibleMsgID: T.Chat.numberToMessageID(55),
        tlfname: tlfName,
      },
    ],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('formatTextForQuoting', () => {
  test('quotes every line, each ending in a newline', () => {
    expect(formatTextForQuoting('a\nb')).toBe('> a\n> b\n')
    expect(formatTextForQuoting('')).toBe('> \n')
    expect(formatTextForQuoting('a\n')).toBe('> a\n> \n')
  })
})

describe('deleteMessage', () => {
  test('both paths send the same delete; only the thread path touches the thread', async () => {
    const {thread, writes} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    deleteMessage({conversationIDKey, message: textAt(10)})
    await settle()
    const sent = {
      clientPrev: 0,
      conversationID: convID,
      identifyBehavior: chatGui,
      outboxID: expect.any(Uint8Array),
      supersedes: 10,
      tlfName,
      tlfPublic: false,
    }
    expect(paramsOf(fake, postDelete)).toEqual([sent, sent])
    expect(writes).toEqual([['addPendingDelete', T.Chat.numberToOrdinal(10)]])
  })

  test('the thread path marks the delete pending, under the outbox id it sends, before the service is asked', async () => {
    const {thread} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    const pending = [...thread.getSnapshot().pendingDeleteMap]
    expect(pending.map(([, ordinal]) => ordinal)).toEqual([T.Chat.numberToOrdinal(10)])
    await settle()
    const sent = paramsOf(fake, postDelete)[0]?.outboxID as Uint8Array
    expect(pending.map(([outboxID]) => outboxID)).toEqual([T.Chat.rpcOutboxIDToOutboxID(sent)])
  })

  test('a failed thread delete writes the revert through the handle', async () => {
    fake.answer(postDelete, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {thread, writes} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    await settle()
    expect(writes).toEqual([
      ['addPendingDelete', T.Chat.numberToOrdinal(10)],
      ['removePendingDelete', T.Chat.numberToOrdinal(10)],
    ])
  })

  test('a failed delete is logged as a warning on both paths', async () => {
    fake.answer(postDelete, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {thread} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    deleteMessage({conversationIDKey, message: textAt(10)})
    await settle()
    expect(warn.mock.calls.map(c => String(c[0]))).toEqual([
      expect.stringContaining('deleteMessage: failed to delete: '),
      expect.stringContaining('deleteMessage: failed to delete: '),
    ])
    expect(error).not.toHaveBeenCalled()
  })

  test('cancelling an unsent message drops the row only on the thread path', async () => {
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    const unsent = textAt(10, {id: T.Chat.numberToMessageID(0), outboxID})
    const {thread, writes} = makeThread([unsent])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    deleteMessage({conversationIDKey, message: unsent})
    await settle()
    const cancelled = {outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)}
    expect(paramsOf(fake, 'chat.1.local.CancelPost')).toEqual([cancelled, cancelled])
    expect(writes).toContainEqual(['deleteMessages', {ordinals: [T.Chat.numberToOrdinal(10)]}])
  })

  test('with no meta both paths still post, with an empty tlfName the service fills in', async () => {
    resetAllStores()
    const {thread, writes} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    deleteMessage({conversationIDKey, message: textAt(10)})
    await settle()
    expect(paramsOf(fake, postDelete)).toEqual([
      expect.objectContaining({tlfName: ''}),
      expect.objectContaining({tlfName: ''}),
    ])
    expect(writes).toEqual([['addPendingDelete', T.Chat.numberToOrdinal(10)]])
  })

  test('the storeless path takes its tlfName from the caller first', async () => {
    deleteMessage({conversationIDKey, message: textAt(10), tlfName: 'team.name'})
    await settle()
    expect(paramsOf(fake, postDelete)).toEqual([expect.objectContaining({tlfName: 'team.name'})])
  })
})

describe('toggleReaction', () => {
  test('the thread path takes clientPrev from its rows, the storeless path from the meta', async () => {
    const {thread} = makeThread([textAt(10), textAt(12)])
    toggleReaction({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, ':+1:')
    toggleReaction({conversationIDKey, message: textAt(10)}, ':+1:')
    toggleReaction({conversationIDKey, messageID: T.Chat.numberToMessageID(10)}, ':+1:')
    await settle()
    expect(paramsOf(fake, postReaction).map(p => p.clientPrev)).toEqual([12, 55, 55])
  })

  test('the thread path shows the reaction first, under the outbox id it sends; the storeless one sends a fresh one', async () => {
    const {thread, writes} = makeThread([textAt(10)])
    toggleReaction({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, ':+1:')
    expect(writes.map(w => w[0])).toEqual(['addOptimisticReaction'])
    toggleReaction({conversationIDKey, message: textAt(10)}, ':+1:')
    await settle()
    const [threaded, storeless] = paramsOf(fake, postReaction).map(p =>
      T.Chat.rpcOutboxIDToOutboxID(p.outboxID as Uint8Array)
    )
    expect([...thread.getSnapshot().optimisticReactionMap.keys()]).toEqual([threaded])
    expect(storeless).toEqual(expect.any(String))
    expect(storeless).not.toBe(threaded)
    expect(writes.map(w => w[0])).toEqual(['addOptimisticReaction'])
  })

  test('a failed thread reaction is taken back through the handle', async () => {
    fake.answer(postReaction, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
    const {thread, writes} = makeThread([textAt(10)])
    toggleReaction({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, ':+1:')
    await settle()
    expect(writes.map(w => w[0])).toEqual(['addOptimisticReaction', 'removeOptimisticReaction'])
    expect(thread.getSnapshot().optimisticReactionMap.size).toBe(0)
  })

  test('an exploded message is refused on both message paths; an id alone cannot tell', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const exploded = textAt(10, {exploded: true})
    const {thread, writes} = makeThread([exploded])
    toggleReaction({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, ':+1:')
    toggleReaction({conversationIDKey, message: exploded}, ':+1:')
    toggleReaction({conversationIDKey, messageID: exploded.id}, ':+1:')
    await settle()
    expect(paramsOf(fake, postReaction)).toEqual([expect.objectContaining({supersedes: 10})])
    expect(writes).toEqual([])
  })
})

describe('replyPrivately', () => {
  test('both paths open the same conversation with the same quote', async () => {
    fake.answer('chat.1.local.newConversationLocal', () => ({conv: {info: {id: newConvID}}, uiConv: newConvItem}))
    const {thread} = makeThread([textAt(10)])
    // Each path from the thread it was issued in: where the app lands, and the quote waiting for
    // the new thread's composer (taken here, as the composer would on mount)
    const opened = async (reply: () => void) => {
      const nav = installNavigation({rootState: stateShowing('chatRoot', {params: {conversationIDKey}})})
      await act(async () => {
        reply()
        await settle()
        await renders()
      })
      return {intent: consumeInputIntent(newKey, ['injectText']), visible: nav.visibleScreen()}
    }
    const expected = {
      intent: {text: '> message 10\n', type: 'injectText'},
      visible: expect.objectContaining({name: 'chatRoot', params: expect.objectContaining({conversationIDKey: newKey})}),
    }

    expect(await opened(() => replyPrivately({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}))).toEqual(
      expected
    )
    expect(await opened(() => replyPrivately({conversationIDKey, message: textAt(10)}))).toEqual(expected)
    expect(paramsOf(fake, 'chat.1.local.newConversationLocal').map(p => p.tlfName)).toEqual([
      'testuser,testuser2',
      'testuser,testuser2',
    ])
  })

  test('the thread path reads the message from the thread when it runs', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {thread} = makeThread([])
    replyPrivately({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    await settle()
    expect(fake.calls).toEqual([])
    expect(warn).toHaveBeenCalledWith(
      "replyPrivately: can't find message to reply to",
      T.Chat.numberToOrdinal(10)
    )
  })
})

describe('the thread-only and storeless-only commands', () => {
  test('toggleCollapse flips what the thread shows', async () => {
    const {thread} = makeThread([textAt(10, {isCollapsed: true})])
    toggleCollapse({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, T.Chat.numberToMessageID(10))
    await settle()
    expect(paramsOf(fake, 'chat.1.local.toggleMessageCollapse')).toEqual([{collapse: false, convID, msgID: 10}])
  })

  test('removeUnfurl deletes the unfurl message with the meta tlfName and no clientPrev', async () => {
    const {thread} = makeThread([textAt(10)])
    removeUnfurl({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, T.Chat.numberToMessageID(33))
    await settle()
    expect(paramsOf(fake, postDelete)).toEqual([
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

  test('pinMessage pins by id: a thread row by the id it holds, otherwise the id given', async () => {
    const {thread} = makeThread([textAt(10)])
    pinMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    pinMessage({conversationIDKey, messageID: T.Chat.numberToMessageID(12)})
    await settle()
    expect(paramsOf(fake, 'chat.1.local.pinMessage')).toEqual([
      {convID, msgID: 10},
      {convID, msgID: 12},
    ])
  })

  test('unfurlMessage unfurls by id: a thread row by the id it holds, otherwise the id given', async () => {
    const {setUnfurlPrompts, thread, writes} = makeThread([textAt(10)])
    setUnfurlPrompts(T.Chat.numberToMessageID(10), ['a.com', 'b.com'])
    unfurlMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    unfurlMessage({conversationIDKey, messageID: T.Chat.numberToMessageID(12)})
    await settle()
    expect(paramsOf(fake, 'chat.1.local.unfurlMessage')).toEqual([
      {convID, identifyBehavior: chatGui, msgID: 10},
      {convID, identifyBehavior: chatGui, msgID: 12},
    ])
    // the thread row's open prompts are answered by the unfurl
    expect(writes).toEqual([
      ['clearUnfurlPrompt', T.Chat.numberToMessageID(10), 'a.com'],
      ['clearUnfurlPrompt', T.Chat.numberToMessageID(10), 'b.com'],
    ])
  })

  test('dismissJourneycard drops the row only when given one', async () => {
    const {thread, writes} = makeThread([textAt(10)])
    dismissJourneycard({conversationIDKey}, T.RPCChat.JourneycardType.welcome)
    dismissJourneycard(
      {conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread},
      T.RPCChat.JourneycardType.welcome
    )
    await settle()
    const dismissed = {cardType: T.RPCChat.JourneycardType.welcome, convID}
    expect(paramsOf(fake, 'chat.1.local.dismissJourneycard')).toEqual([dismissed, dismissed])
    expect(writes).toEqual([['deleteMessages', {ordinals: [T.Chat.numberToOrdinal(10)]}]])
  })
})
