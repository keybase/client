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
import {
  deleteConversationMessage,
  dismissConversationJourneycard,
  pinConversationMessage,
  replyPrivatelyToConversationMessage,
  toggleConversationMessageReaction,
  toggleConversationMessageReactionByID,
} from './message-actions'

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
      {conversationIDKey, messageID: T.Chat.numberToMessageID(10), tlfName: 'testuser,testuser2'},
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

  test('a failed delete is left to ignorePromise', async () => {
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
