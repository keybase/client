/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as Router from '@/constants/router'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import RPCError from '@/util/rpcerror'
import logger from '@/logger'
import {getInboxConversationMeta, metasReceived} from '@/chat/inbox/metadata'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {deleteMessage, dismissJourneycard, pinMessage, replyPrivately, toggleReaction} from './message-commands'

// The message commands with no thread: each target is the message itself, or its id.
const deleteConversationMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.Message,
  tlfName?: string
) => deleteMessage({conversationIDKey, message, tlfName})
const toggleConversationMessageReaction = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.Message,
  emoji: string,
  tlfName?: string
) => toggleReaction({conversationIDKey, message, tlfName}, emoji)
const toggleConversationMessageReactionByID = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID,
  emoji: string,
  tlfName?: string
) => toggleReaction({conversationIDKey, messageID, tlfName}, emoji)
const replyPrivatelyToConversationMessage = (message: T.Chat.Message) =>
  replyPrivately({conversationIDKey: message.conversationIDKey, message})
const pinConversationMessage = (conversationIDKey: T.Chat.ConversationIDKey, messageID: T.Chat.MessageID) =>
  pinMessage({conversationIDKey, messageID})
const dismissConversationJourneycard = (
  conversationIDKey: T.Chat.ConversationIDKey,
  cardType: T.RPCChat.JourneycardType
) => dismissJourneycard({conversationIDKey}, cardType)

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
let rpc: FakeChatRpc

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

const textMessage = (over?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    author: 'testuser2',
    conversationIDKey,
    id: T.Chat.numberToMessageID(10),
    ordinal: T.Chat.numberToOrdinal(10),
    text: new HiddenString('line one\nline two'),
    ...over,
  })

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
        tlfname: 'testuser,testuser2',
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

describe('deleteConversationMessage', () => {
  test('deletes a sent message with the meta tlfName and a zero clientPrev', async () => {
    deleteConversationMessage(conversationIDKey, textMessage())
    await flushPromises()
    // no clientPrev: the adapter sends zero
    expect(rpc.params('postDelete')).toEqual([
      {
        conversationIDKey,
        messageID: T.Chat.numberToMessageID(10),
        outboxID: expect.any(Uint8Array),
        tlfName: 'testuser,testuser2',
      },
    ])
  })

  test('an explicit tlfName wins over the meta', async () => {
    deleteConversationMessage(conversationIDKey, textMessage(), 'team.name')
    await flushPromises()
    expect(rpc.params('postDelete')).toEqual([expect.objectContaining({tlfName: 'team.name'})])
  })

  test('an unsent message cancels its outbox entry instead', async () => {
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    deleteConversationMessage(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0), outboxID}))
    await flushPromises()
    expect(rpc.calls('cancelPost')).toEqual([[outboxID]])
    expect(rpc.calls('postDelete')).toEqual([])
  })

  test('a message with neither id does nothing', async () => {
    deleteConversationMessage(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0)}))
    await flushPromises()
    expect(rpc.log).toEqual([])
  })

  test('an invalid conversation does nothing', async () => {
    deleteConversationMessage(T.Chat.noConversationIDKey, textMessage())
    await flushPromises()
    expect(rpc.log).toEqual([])
  })

  test('a non-service delete failure is left to ignorePromise', async () => {
    rpc.fail('postDelete', new Error('x'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    deleteConversationMessage(conversationIDKey, textMessage())
    await flushPromises()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('reactions', () => {
  test('posts the emoji against the message with the meta clientPrev and a fresh outbox id', async () => {
    toggleConversationMessageReaction(conversationIDKey, textMessage(), ':+1:')
    await flushPromises()
    // no outbox id: the adapter makes a fresh one
    expect(rpc.params('postReaction')).toEqual([
      {
        clientPrev: T.Chat.numberToMessageID(55),
        conversationIDKey,
        emoji: ':+1:',
        messageID: T.Chat.numberToMessageID(10),
        tlfName: 'testuser,testuser2',
      },
    ])
  })

  test('an exploded message takes no reactions', async () => {
    toggleConversationMessageReaction(conversationIDKey, textMessage({exploded: true}), ':+1:')
    toggleConversationMessageReaction(
      conversationIDKey,
      makeMessageAttachment({conversationIDKey, exploded: true, id: T.Chat.numberToMessageID(3)}),
      ':+1:'
    )
    await flushPromises()
    expect(rpc.calls('postReaction')).toEqual([])
  })

  test('nothing is posted for an empty emoji, an invalid conversation, a zero id or no user', async () => {
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), '')
    toggleConversationMessageReactionByID(T.Chat.noConversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(0), ':+1:')
    await flushPromises()
    resetAllStores()
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    await flushPromises()
    expect(rpc.calls('postReaction')).toEqual([])
  })

  test('without meta the clientPrev is zero and an explicit tlfName is used', async () => {
    resetAllStores()
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id',
      deviceName: 'testuser-mac',
      uid: 'uid',
      username: 'testuser',
    })
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:', 'team.name')
    await flushPromises()
    expect(rpc.params('postReaction')).toEqual([
      expect.objectContaining({clientPrev: T.Chat.numberToMessageID(0), tlfName: 'team.name'}),
    ])
  })

  test('a service failure is swallowed', async () => {
    rpc.fail('postReaction', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error')
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    await flushPromises()
    expect(error).not.toHaveBeenCalled()
  })
})

describe('replyPrivatelyToConversationMessage', () => {
  const newConvID = new Uint8Array([9, 9, 9, 9])
  const newKey = T.Chat.conversationIDToKey(newConvID)

  test('creates the adhoc conversation, stores its meta and opens it with the quote', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: newConvID}}, uiConv: {}}) as never)
    jest
      .spyOn(Meta, 'inboxUIItemToConversationMeta')
      .mockReturnValue({...Meta.makeConversationMeta(), conversationIDKey: newKey, tlfname: 'testuser,testuser2'})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})

    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()

    expect(rpc.calls('createAdhocConversation')).toEqual([
      [['testuser', 'testuser2'], Strings.waitingKeyChatCreating],
    ])
    expect(getInboxConversationMeta(newKey)?.tlfname).toBe('testuser,testuser2')
    expect(navigate).toHaveBeenCalledWith(newKey, 'createdMessagePrivately', {
      intent: {text: '> line one\n> line two\n', type: 'injectText'},
    })
  })

  test('replying to yourself does not repeat the name', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: newConvID}}, uiConv: {}}) as never)
    jest.spyOn(Meta, 'inboxUIItemToConversationMeta').mockReturnValue(undefined)
    replyPrivatelyToConversationMessage(textMessage({author: 'testuser'}))
    await flushPromises()
    // the adapter dedupes the names
    expect(rpc.params('createAdhocConversation')).toEqual([['testuser', 'testuser']])
  })

  test('a non-text message makes the conversation but does not open it', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: newConvID}}, uiConv: {}}) as never)
    jest
      .spyOn(Meta, 'inboxUIItemToConversationMeta')
      .mockReturnValue({...Meta.makeConversationMeta(), conversationIDKey: newKey})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(
      makeMessageAttachment({author: 'testuser2', conversationIDKey, id: T.Chat.numberToMessageID(3)})
    )
    await flushPromises()
    expect(navigate).not.toHaveBeenCalled()
    expect(getInboxConversationMeta(newKey)).toBeUndefined()
  })

  test('no meta for the new conversation, no navigation', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: newConvID}}, uiConv: {}}) as never)
    jest.spyOn(Meta, 'inboxUIItemToConversationMeta').mockReturnValue(undefined)
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()
    expect(navigate).not.toHaveBeenCalled()
  })

  test('logged out it creates nothing', async () => {
    resetAllStores()
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()
    expect(rpc.calls('createAdhocConversation')).toEqual([])
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('pinConversationMessage', () => {
  test('pins by conversation and message id', async () => {
    pinConversationMessage(conversationIDKey, T.Chat.numberToMessageID(10))
    await flushPromises()
    expect(rpc.calls('pinMessage')).toEqual([[conversationIDKey, T.Chat.numberToMessageID(10)]])
  })

  test('a service failure is logged', async () => {
    rpc.fail('pinMessage', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    pinConversationMessage(conversationIDKey, T.Chat.numberToMessageID(10))
    await flushPromises()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('pinConversationMessage: '))
  })
})

describe('dismissConversationJourneycard', () => {
  test('dismisses the card type for the conversation', async () => {
    dismissConversationJourneycard(conversationIDKey, T.RPCChat.JourneycardType.welcome)
    await flushPromises()
    expect(rpc.calls('dismissJourneycard')).toEqual([[conversationIDKey, T.RPCChat.JourneycardType.welcome]])
  })

  test('a service failure is logged, not thrown', async () => {
    rpc.fail('dismissJourneycard', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    dismissConversationJourneycard(conversationIDKey, T.RPCChat.JourneycardType.welcome)
    await flushPromises()
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to dismiss journeycard: '))
  })
})

describe('storeless edges', () => {
  test('delete with no meta and no tlfName still posts, with an empty tlfName the service fills in', async () => {
    resetAllStores()
    deleteConversationMessage(conversationIDKey, textMessage())
    await flushPromises()
    expect(rpc.params('postDelete')).toEqual([expect.objectContaining({tlfName: ''})])
  })

  test('a failed cancel is logged as a warning', async () => {
    rpc.fail('cancelPost', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    deleteConversationMessage(
      conversationIDKey,
      textMessage({id: T.Chat.numberToMessageID(0), outboxID: T.Chat.stringToOutboxID('0a0b')})
    )
    await flushPromises()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deleteMessage: failed to delete: '))
    expect(error).not.toHaveBeenCalled()
  })

  test('the missing-id and invalid-conversation cases are logged', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    deleteConversationMessage(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0)}))
    deleteConversationMessage(T.Chat.noConversationIDKey, textMessage())
    await flushPromises()
    expect(warn.mock.calls).toEqual([
      ['deleteMessage: no message id or outbox id'],
      ['deleteMessage: no conversation id'],
    ])
  })

  test('a reaction to a message with no id yet is not posted', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    toggleConversationMessageReaction(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0)}), ':+1:')
    await flushPromises()
    expect(rpc.calls('postReaction')).toEqual([])
  })

  test('a reaction toggles without looking at existing reactions', async () => {
    const reactions: T.Chat.Reactions = new Map([
      [':+1:', {decorated: ':+1:', users: [{timestamp: 1, username: 'testuser'}]}],
    ])
    toggleConversationMessageReaction(conversationIDKey, textMessage({reactions}), ':+1:')
    await flushPromises()
    expect(rpc.params('postReaction')).toEqual([expect.objectContaining({emoji: ':+1:'})])
  })

  test('a reaction service failure is logged as info, any other failure as an error', async () => {
    const info = jest.spyOn(logger, 'info')
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const bug = new Error('bug')
    rpc.failOnce('postReaction', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    rpc.failOnce('postReaction', bug)
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':-1:')
    await flushPromises()
    expect(rpc.calls('postReaction')).toHaveLength(2)
    expect(info.mock.calls.filter(c => String(c[0]).startsWith('toggleReaction'))).toEqual([
      [expect.stringContaining('toggleReaction: failed to post ')],
    ])
    expect(error.mock.calls).toEqual([['toggleReaction: failed to post', bug]])
  })

  test('reply privately with an empty conversation id does not open anything', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: new Uint8Array()}}, uiConv: {}}) as never)
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()
    expect(navigate).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith("replyPrivately: couldn't make a new conversation")
  })

  test('reply privately with no meta warns', async () => {
    rpc.on('createAdhocConversation', () => ({conv: {info: {id: new Uint8Array([9])}}, uiConv: {}}) as never)
    jest.spyOn(Meta, 'inboxUIItemToConversationMeta').mockReturnValue(undefined)
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()
    expect(warn).toHaveBeenCalledWith('replyPrivately: unable to make meta')
  })

  test('a failed adhoc create goes to ignorePromise', async () => {
    rpc.fail('createAdhocConversation', new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(RPCError))
  })

  test('pin and journeycard failures that are not service errors are swallowed', async () => {
    rpc.fail('pinMessage', new Error('bug'))
    rpc.fail('dismissJourneycard', new Error('bug'))
    const error = jest.spyOn(logger, 'error')
    pinConversationMessage(conversationIDKey, T.Chat.numberToMessageID(10))
    dismissConversationJourneycard(conversationIDKey, T.RPCChat.JourneycardType.welcome)
    await flushPromises()
    expect(rpc.log.map(c => c.method)).toEqual(['pinMessage', 'dismissJourneycard'])
    expect(error).not.toHaveBeenCalled()
  })
})
