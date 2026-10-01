/// <reference types="jest" />
// The message-command module against a plain thread handle: which target picks which path, and
// exactly what each path asks of the thread.
import * as Meta from '@/constants/chat/meta'
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import RPCError from '@/util/rpcerror'
import logger from '@/logger'
import {metasReceived} from '@/chat/inbox/metadata'
import {makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
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
  type MessageCommandThread,
} from './message-commands'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const tlfName = 'testuser,testuser2'
let rpc: FakeChatRpc

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
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
  } as unknown as ConversationThreadState
  const writes: Array<ReadonlyArray<unknown>> = []
  const thread: MessageCommandThread = {
    addOptimisticReaction: (outboxID, reaction) => {
      writes.push(['addOptimisticReaction', reaction])
      const optimisticReactionMap = new Map(state.optimisticReactionMap)
      optimisticReactionMap.set(outboxID, reaction)
      state = {...state, optimisticReactionMap}
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
  return {thread, writes}
}

beforeEach(() => {
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
        maxVisibleMsgID: T.Chat.numberToMessageID(55),
        tlfname: tlfName,
      },
    ],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  restoreChatRpc()
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
    await flushPromises()
    const sent = {conversationIDKey, messageID: T.Chat.numberToMessageID(10), outboxID: expect.any(Uint8Array), tlfName}
    expect(rpc.params('postDelete')).toEqual([sent, sent])
    expect(writes).toEqual([['addPendingDelete', T.Chat.numberToOrdinal(10)]])
  })

  test('the thread path marks the delete pending, under the outbox id it sends, before the service is asked', async () => {
    const {thread} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    const pending = [...thread.getSnapshot().pendingDeleteMap]
    expect(pending.map(([, ordinal]) => ordinal)).toEqual([T.Chat.numberToOrdinal(10)])
    await flushPromises()
    const sent = rpc.params('postDelete')[0]?.outboxID
    expect(pending.map(([outboxID]) => outboxID)).toEqual([sent && T.Chat.rpcOutboxIDToOutboxID(sent)])
  })

  test('a failed thread delete writes the revert through the handle', async () => {
    rpc.fail('postDelete', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {thread, writes} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    await flushPromises()
    expect(writes).toEqual([
      ['addPendingDelete', T.Chat.numberToOrdinal(10)],
      ['removePendingDelete', T.Chat.numberToOrdinal(10)],
    ])
  })

  test('a failed delete is logged as a warning on both paths', async () => {
    rpc.fail('postDelete', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {thread} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    deleteMessage({conversationIDKey, message: textAt(10)})
    await flushPromises()
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
    await flushPromises()
    expect(rpc.calls('cancelPost')).toEqual([[outboxID], [outboxID]])
    expect(writes).toContainEqual(['deleteMessages', {ordinals: [T.Chat.numberToOrdinal(10)]}])
  })

  test('with no meta both paths still post, with an empty tlfName the service fills in', async () => {
    resetAllStores()
    const {thread, writes} = makeThread([textAt(10)])
    deleteMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    deleteMessage({conversationIDKey, message: textAt(10)})
    await flushPromises()
    expect(rpc.params('postDelete')).toEqual([
      expect.objectContaining({tlfName: ''}),
      expect.objectContaining({tlfName: ''}),
    ])
    expect(writes).toEqual([['addPendingDelete', T.Chat.numberToOrdinal(10)]])
  })

  test('the storeless path takes its tlfName from the caller first', async () => {
    deleteMessage({conversationIDKey, message: textAt(10), tlfName: 'team.name'})
    await flushPromises()
    expect(rpc.params('postDelete')).toEqual([expect.objectContaining({tlfName: 'team.name'})])
  })
})

describe('toggleReaction', () => {
  test('the thread path takes clientPrev from its rows, the storeless path from the meta', async () => {
    const {thread} = makeThread([textAt(10), textAt(12)])
    toggleReaction({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, ':+1:')
    toggleReaction({conversationIDKey, message: textAt(10)}, ':+1:')
    toggleReaction({conversationIDKey, messageID: T.Chat.numberToMessageID(10)}, ':+1:')
    await flushPromises()
    expect(rpc.params('postReaction').map(p => p.clientPrev)).toEqual([12, 55, 55])
  })

  test('only the thread path picks the outbox id and shows the reaction first', async () => {
    const {thread, writes} = makeThread([textAt(10)])
    toggleReaction({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, ':+1:')
    expect(writes.map(w => w[0])).toEqual(['addOptimisticReaction'])
    toggleReaction({conversationIDKey, message: textAt(10)}, ':+1:')
    await flushPromises()
    const [threaded, storeless] = rpc.params('postReaction')
    expect(threaded?.outboxID).toBeInstanceOf(Uint8Array)
    expect(storeless?.outboxID).toBeUndefined()
    expect(writes.map(w => w[0])).toEqual(['addOptimisticReaction'])
  })

  test('a failed thread reaction is taken back through the handle', async () => {
    rpc.fail('postReaction', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const {thread, writes} = makeThread([textAt(10)])
    toggleReaction({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, ':+1:')
    await flushPromises()
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
    await flushPromises()
    expect(rpc.params('postReaction')).toEqual([
      expect.objectContaining({messageID: T.Chat.numberToMessageID(10)}),
    ])
    expect(writes).toEqual([])
  })
})

describe('replyPrivately', () => {
  const newConvID = new Uint8Array([9, 9, 9, 9])
  const newKey = T.Chat.conversationIDToKey(newConvID)

  test('both paths open the same conversation with the same quote', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: newConvID}}, uiConv: {}}) as never)
    jest
      .spyOn(Meta, 'inboxUIItemToConversationMeta')
      .mockReturnValue({...Meta.makeConversationMeta(), conversationIDKey: newKey})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    const {thread} = makeThread([textAt(10)])
    replyPrivately({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    replyPrivately({conversationIDKey, message: textAt(10)})
    await flushPromises()
    const opened = [newKey, 'createdMessagePrivately', {intent: {text: '> message 10\n', type: 'injectText'}}]
    expect(navigate.mock.calls).toEqual([opened, opened])
  })

  test('the thread path reads the message from the thread when it runs', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {thread} = makeThread([])
    replyPrivately({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    await flushPromises()
    expect(rpc.log).toEqual([])
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
    await flushPromises()
    expect(rpc.params('toggleCollapse')).toEqual([
      {collapse: false, conversationIDKey, messageID: T.Chat.numberToMessageID(10)},
    ])
  })

  test('removeUnfurl deletes the unfurl message with the meta tlfName and no clientPrev', async () => {
    const {thread} = makeThread([textAt(10)])
    removeUnfurl({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread}, T.Chat.numberToMessageID(33))
    await flushPromises()
    expect(rpc.params('postDelete')).toEqual([
      {conversationIDKey, messageID: T.Chat.numberToMessageID(33), tlfName},
    ])
  })

  test('pinMessage pins by id: a thread row by the id it holds, otherwise the id given', async () => {
    const {thread} = makeThread([textAt(10)])
    pinMessage({conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread})
    pinMessage({conversationIDKey, messageID: T.Chat.numberToMessageID(12)})
    await flushPromises()
    expect(rpc.calls('pinMessage')).toEqual([
      [conversationIDKey, T.Chat.numberToMessageID(10)],
      [conversationIDKey, T.Chat.numberToMessageID(12)],
    ])
  })

  test('dismissJourneycard drops the row only when given one', async () => {
    const {thread, writes} = makeThread([textAt(10)])
    dismissJourneycard({conversationIDKey}, T.RPCChat.JourneycardType.welcome)
    dismissJourneycard(
      {conversationIDKey, ordinal: T.Chat.numberToOrdinal(10), thread},
      T.RPCChat.JourneycardType.welcome
    )
    await flushPromises()
    expect(rpc.calls('dismissJourneycard')).toHaveLength(2)
    expect(writes).toEqual([['deleteMessages', {ordinals: [T.Chat.numberToOrdinal(10)]}]])
  })
})
