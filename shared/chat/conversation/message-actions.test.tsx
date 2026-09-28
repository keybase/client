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
import {
  deleteConversationMessage,
  dismissConversationJourneycard,
  pinConversationMessage,
  replyPrivatelyToConversationMessage,
  toggleConversationMessageReaction,
  toggleConversationMessageReactionByID,
} from './message-actions'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

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
  jest.restoreAllMocks()
  resetAllStores()
})

describe('deleteConversationMessage', () => {
  test('deletes a sent message with the meta tlfName and a zero clientPrev', async () => {
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise').mockResolvedValue({} as never)
    deleteConversationMessage(conversationIDKey, textMessage())
    await flushPromises()
    expect(del).toHaveBeenCalledWith({
      clientPrev: T.Chat.numberToMessageID(0),
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: null,
      supersedes: T.Chat.numberToMessageID(10),
      tlfName: 'testuser,testuser2',
      tlfPublic: false,
    })
  })

  test('an explicit tlfName wins over the meta', async () => {
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise').mockResolvedValue({} as never)
    deleteConversationMessage(conversationIDKey, textMessage(), 'team.name')
    await flushPromises()
    expect(del).toHaveBeenCalledWith(expect.objectContaining({tlfName: 'team.name'}))
  })

  test('an unsent message cancels its outbox entry instead', async () => {
    const cancel = jest.spyOn(T.RPCChat, 'localCancelPostRpcPromise').mockResolvedValue(undefined)
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise')
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    deleteConversationMessage(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0), outboxID}))
    await flushPromises()
    expect(cancel).toHaveBeenCalledWith({outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)})
    expect(del).not.toHaveBeenCalled()
  })

  test('a message with neither id does nothing', async () => {
    const cancel = jest.spyOn(T.RPCChat, 'localCancelPostRpcPromise')
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise')
    deleteConversationMessage(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0)}))
    await flushPromises()
    expect(cancel).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  test('an invalid conversation does nothing', async () => {
    const del = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise')
    deleteConversationMessage(T.Chat.noConversationIDKey, textMessage())
    await flushPromises()
    expect(del).not.toHaveBeenCalled()
  })

  test('a failed delete is left to ignorePromise', async () => {
    jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise').mockRejectedValue(new Error('x'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    deleteConversationMessage(conversationIDKey, textMessage())
    await flushPromises()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('reactions', () => {
  test('posts the emoji against the message with the meta clientPrev and a fresh outbox id', async () => {
    const react = jest.spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise').mockResolvedValue({} as never)
    toggleConversationMessageReaction(conversationIDKey, textMessage(), ':+1:')
    await flushPromises()
    expect(react).toHaveBeenCalledWith({
      body: ':+1:',
      clientPrev: T.Chat.numberToMessageID(55),
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: expect.any(Uint8Array),
      supersedes: T.Chat.numberToMessageID(10),
      tlfName: 'testuser,testuser2',
      tlfPublic: false,
    })
  })

  test('an exploded message takes no reactions', async () => {
    const react = jest.spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise')
    toggleConversationMessageReaction(conversationIDKey, textMessage({exploded: true}), ':+1:')
    toggleConversationMessageReaction(
      conversationIDKey,
      makeMessageAttachment({conversationIDKey, exploded: true, id: T.Chat.numberToMessageID(3)}),
      ':+1:'
    )
    await flushPromises()
    expect(react).not.toHaveBeenCalled()
  })

  test('nothing is posted for an empty emoji, an invalid conversation, a zero id or no user', async () => {
    const react = jest.spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise')
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), '')
    toggleConversationMessageReactionByID(T.Chat.noConversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(0), ':+1:')
    await flushPromises()
    resetAllStores()
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    await flushPromises()
    expect(react).not.toHaveBeenCalled()
  })

  test('without meta the clientPrev is zero and an explicit tlfName is used', async () => {
    resetAllStores()
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id',
      deviceName: 'testuser-mac',
      uid: 'uid',
      username: 'testuser',
    })
    const react = jest.spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise').mockResolvedValue({} as never)
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:', 'team.name')
    await flushPromises()
    expect(react).toHaveBeenCalledWith(
      expect.objectContaining({clientPrev: T.Chat.numberToMessageID(0), tlfName: 'team.name'})
    )
  })

  test('a service failure is swallowed', async () => {
    jest
      .spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
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
    const create = jest.spyOn(T.RPCChat, 'localNewConversationLocalRpcPromise').mockResolvedValue({
      conv: {info: {id: newConvID}},
      uiConv: {},
    } as never)
    jest
      .spyOn(Meta, 'inboxUIItemToConversationMeta')
      .mockReturnValue({...Meta.makeConversationMeta(), conversationIDKey: newKey, tlfname: 'testuser,testuser2'})
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})

    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()

    expect(create).toHaveBeenCalledWith(
      {
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        membersType: T.RPCChat.ConversationMembersType.impteamnative,
        tlfName: 'testuser,testuser2',
        tlfVisibility: T.RPCGen.TLFVisibility.private,
        topicType: T.RPCChat.TopicType.chat,
      },
      Strings.waitingKeyChatCreating
    )
    expect(getInboxConversationMeta(newKey)?.tlfname).toBe('testuser,testuser2')
    expect(navigate).toHaveBeenCalledWith(newKey, 'createdMessagePrivately', {
      intent: {text: '> line one\n> line two\n', type: 'injectText'},
    })
  })

  test('replying to yourself does not repeat the name', async () => {
    const create = jest.spyOn(T.RPCChat, 'localNewConversationLocalRpcPromise').mockResolvedValue({
      conv: {info: {id: newConvID}},
      uiConv: {},
    } as never)
    jest.spyOn(Meta, 'inboxUIItemToConversationMeta').mockReturnValue(undefined)
    replyPrivatelyToConversationMessage(textMessage({author: 'testuser'}))
    await flushPromises()
    expect(create.mock.calls[0]?.[0].tlfName).toBe('testuser')
  })

  test('a non-text message makes the conversation but does not open it', async () => {
    jest.spyOn(T.RPCChat, 'localNewConversationLocalRpcPromise').mockResolvedValue({
      conv: {info: {id: newConvID}},
      uiConv: {},
    } as never)
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
    jest.spyOn(T.RPCChat, 'localNewConversationLocalRpcPromise').mockResolvedValue({
      conv: {info: {id: newConvID}},
      uiConv: {},
    } as never)
    jest.spyOn(Meta, 'inboxUIItemToConversationMeta').mockReturnValue(undefined)
    const navigate = jest.spyOn(Router, 'navigateToThread').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()
    expect(navigate).not.toHaveBeenCalled()
  })

  test('logged out it creates nothing', async () => {
    resetAllStores()
    const create = jest.spyOn(T.RPCChat, 'localNewConversationLocalRpcPromise')
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await flushPromises()
    expect(create).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('pinConversationMessage', () => {
  test('pins by conversation and message id', async () => {
    const pin = jest.spyOn(T.RPCChat, 'localPinMessageRpcPromise').mockResolvedValue({} as never)
    pinConversationMessage(conversationIDKey, T.Chat.numberToMessageID(10))
    await flushPromises()
    expect(pin).toHaveBeenCalledWith({convID, msgID: T.Chat.numberToMessageID(10)})
  })

  test('a service failure is logged', async () => {
    jest
      .spyOn(T.RPCChat, 'localPinMessageRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    pinConversationMessage(conversationIDKey, T.Chat.numberToMessageID(10))
    await flushPromises()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('pinConversationMessage: '))
  })
})

describe('dismissConversationJourneycard', () => {
  test('dismisses the card type for the conversation', async () => {
    const dismiss = jest.spyOn(T.RPCChat, 'localDismissJourneycardRpcPromise').mockResolvedValue(undefined)
    dismissConversationJourneycard(conversationIDKey, T.RPCChat.JourneycardType.welcome)
    await flushPromises()
    expect(dismiss).toHaveBeenCalledWith({cardType: T.RPCChat.JourneycardType.welcome, convID})
  })

  test('a service failure is logged, not thrown', async () => {
    jest
      .spyOn(T.RPCChat, 'localDismissJourneycardRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    dismissConversationJourneycard(conversationIDKey, T.RPCChat.JourneycardType.welcome)
    await flushPromises()
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to dismiss journeycard: '))
  })
})
