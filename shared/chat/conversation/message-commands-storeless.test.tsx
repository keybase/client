/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import {act} from 'react'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import RPCError from '@/util/rpcerror'
import {useWaitingState} from '@/stores/waiting'
import logger from '@/logger'
import {getInboxConversationMeta, metasReceived} from '@/chat/inbox/metadata'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {settle} from '@/test/flush'
import {installNavigation, renders, stateShowing, type MountedNavigation} from '@/test/navigation'
import {peekInputIntent} from './input-intent-store'
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
const convID = T.Chat.keyToConversationID(conversationIDKey)
const chatGui = T.RPCGen.TLFIdentifyBehavior.chatGui
const postDelete = 'chat.1.local.postDeleteNonblock'
const postReaction = 'chat.1.local.postReactionNonblock'
const cancelPost = 'chat.1.local.CancelPost'
const pin = 'chat.1.local.pinMessage'
const dismissCard = 'chat.1.local.dismissJourneycard'
const newConversation = 'chat.1.local.newConversationLocal'
const serviceError = () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope')
let fake: FakeEngine

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
  ...over,
})
const created = (uiConv: object = newConvItem(), id = newConvID) => {
  fake.answer(newConversation, () => ({conv: {info: {id}}, uiConv}))
}
// meta conversion only takes private conversations, so a public one has no meta
const noMeta = () => newConvItem({visibility: T.RPCGen.TLFVisibility.public})

const textMessage = (over?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    author: 'testuser2',
    conversationIDKey,
    id: T.Chat.numberToMessageID(10),
    ordinal: T.Chat.numberToOrdinal(10),
    text: new HiddenString('line one\nline two'),
    ...over,
  })

// The app's real tree, showing the conversation the reply is made from
const showingThread = () => installNavigation({rootState: stateShowing('chatRoot', {params: {conversationIDKey}})})
// Settles the service calls and the navigation they lead to, which renders the tree
const settleAndNavigate = async () =>
  act(async () => {
    await settle()
    await renders()
  })
// Nothing was opened: the tree is untouched and no quote waits for the new conversation
const expectNothingOpened = (nav: MountedNavigation) => {
  expect(nav.actions).toEqual([])
  expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey}})
  expect(peekInputIntent(newKey, ['injectText'])).toBeUndefined()
}

beforeEach(() => {
  fake = installFakeEngine()
  for (const m of [postDelete, postReaction, cancelPost, pin, dismissCard]) {
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
    deleteConversationMessage(conversationIDKey, textMessage())
    await settle()
    // no clientPrev: the adapter sends zero
    expect(paramsOf(fake, postDelete)).toEqual([
      {
        clientPrev: 0,
        conversationID: convID,
        identifyBehavior: chatGui,
        outboxID: expect.any(Uint8Array),
        supersedes: 10,
        tlfName: 'testuser,testuser2',
        tlfPublic: false,
      },
    ])
  })

  test('an explicit tlfName wins over the meta', async () => {
    deleteConversationMessage(conversationIDKey, textMessage(), 'team.name')
    await settle()
    expect(paramsOf(fake, postDelete)).toEqual([expect.objectContaining({tlfName: 'team.name'})])
  })

  test('an unsent message cancels its outbox entry instead', async () => {
    const outboxID = T.Chat.stringToOutboxID('0a0b')
    deleteConversationMessage(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0), outboxID}))
    await settle()
    expect(paramsOf(fake, cancelPost)).toEqual([{outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)}])
    expect(paramsOf(fake, postDelete)).toEqual([])
  })

  // the row's Delete is how an attachment still uploading is stopped: its outbox entry is cancelled,
  // which ends the upload, and nothing is posted
  test('an attachment still uploading cancels its outbox entry', async () => {
    const outboxID = T.Chat.stringToOutboxID('0c0d')
    deleteConversationMessage(
      conversationIDKey,
      makeMessageAttachment({
        author: 'testuser',
        conversationIDKey,
        id: T.Chat.numberToMessageID(0),
        ordinal: T.Chat.numberToOrdinal(11),
        outboxID,
        title: 'upload',
        transferProgress: 0.3,
        transferState: 'uploading',
      })
    )
    await settle()
    expect(paramsOf(fake, cancelPost)).toEqual([{outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)}])
    expect(paramsOf(fake, postDelete)).toEqual([])
  })

  test('a message with neither id does nothing', async () => {
    deleteConversationMessage(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0)}))
    await settle()
    expect(fake.calls).toEqual([])
  })

  test('an invalid conversation does nothing', async () => {
    deleteConversationMessage(T.Chat.noConversationIDKey, textMessage())
    await settle()
    expect(fake.calls).toEqual([])
  })

  // Every failure the engine reports is a service error, a lost link included
  test('a delete on a lost service link is logged as a failed delete', async () => {
    fake.drop()
    await settle()
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    deleteConversationMessage(conversationIDKey, textMessage())
    await settle()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deleteMessage: failed to delete: '))
    expect(error).not.toHaveBeenCalled()
  })
})

describe('reactions', () => {
  test('posts the emoji against the message with the meta clientPrev and a fresh outbox id', async () => {
    toggleConversationMessageReaction(conversationIDKey, textMessage(), ':+1:')
    await settle()
    // no outbox id: the adapter makes a fresh one
    expect(paramsOf(fake, postReaction)).toEqual([
      {
        body: ':+1:',
        clientPrev: 55,
        conversationID: convID,
        identifyBehavior: chatGui,
        outboxID: expect.any(Uint8Array),
        supersedes: 10,
        tlfName: 'testuser,testuser2',
        tlfPublic: false,
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
    await settle()
    expect(paramsOf(fake, postReaction)).toEqual([])
  })

  test('nothing is posted for an empty emoji, an invalid conversation, a zero id or no user', async () => {
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), '')
    toggleConversationMessageReactionByID(T.Chat.noConversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(0), ':+1:')
    await settle()
    resetAllStores()
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    await settle()
    expect(paramsOf(fake, postReaction)).toEqual([])
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
    await settle()
    expect(paramsOf(fake, postReaction)).toEqual([expect.objectContaining({clientPrev: 0, tlfName: 'team.name'})])
  })

  test('a service failure is swallowed', async () => {
    fake.answer(postReaction, serviceError)
    const error = jest.spyOn(logger, 'error')
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    await settle()
    expect(error).not.toHaveBeenCalled()
  })
})

describe('replyPrivatelyToConversationMessage', () => {
  test('creates the adhoc conversation, stores its meta and opens it with the quote', async () => {
    const held = fake.hold(newConversation)
    const nav = showingThread()

    replyPrivatelyToConversationMessage(textMessage())
    await settle()
    expect(useWaitingState.getState().counts.get(Strings.waitingKeyChatCreating)).toBe(1)
    held[0]!.reply({conv: {info: {id: newConvID}}, uiConv: newConvItem()})
    await settleAndNavigate()

    expect(useWaitingState.getState().counts.get(Strings.waitingKeyChatCreating)).toBeUndefined()
    expect(paramsOf(fake, newConversation)).toEqual([
      expect.objectContaining({tlfName: 'testuser,testuser2'}),
    ])
    expect(getInboxConversationMeta(newKey)?.tlfname).toBe('testuser,testuser2')
    expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey: newKey}})
    expect(peekInputIntent(newKey, ['injectText'])).toEqual({text: '> line one\n> line two\n', type: 'injectText'})
  })

  test('replying to yourself does not repeat the name', async () => {
    created(newConvItem({name: 'testuser'}))
    showingThread()
    replyPrivatelyToConversationMessage(textMessage({author: 'testuser'}))
    await settleAndNavigate()
    // the adapter dedupes the names
    expect(paramsOf(fake, newConversation)).toEqual([expect.objectContaining({tlfName: 'testuser'})])
  })

  test('a non-text message makes the conversation but does not open it', async () => {
    created()
    const nav = showingThread()
    replyPrivatelyToConversationMessage(
      makeMessageAttachment({author: 'testuser2', conversationIDKey, id: T.Chat.numberToMessageID(3)})
    )
    await settleAndNavigate()
    expectNothingOpened(nav)
    expect(getInboxConversationMeta(newKey)).toBeUndefined()
  })

  test('no meta for the new conversation, no navigation', async () => {
    created(noMeta())
    const nav = showingThread()
    replyPrivatelyToConversationMessage(textMessage())
    await settleAndNavigate()
    expectNothingOpened(nav)
  })

  test('logged out it creates nothing', async () => {
    resetAllStores()
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await settle()
    expect(fake.calls).toEqual([])
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('pinConversationMessage', () => {
  test('pins by conversation and message id', async () => {
    pinConversationMessage(conversationIDKey, T.Chat.numberToMessageID(10))
    await settle()
    expect(paramsOf(fake, pin)).toEqual([{convID, msgID: 10}])
  })

  test('a service failure is logged', async () => {
    fake.answer(pin, serviceError)
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    pinConversationMessage(conversationIDKey, T.Chat.numberToMessageID(10))
    await settle()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('pinConversationMessage: '))
  })
})

describe('dismissConversationJourneycard', () => {
  test('dismisses the card type for the conversation', async () => {
    dismissConversationJourneycard(conversationIDKey, T.RPCChat.JourneycardType.welcome)
    await settle()
    expect(paramsOf(fake, dismissCard)).toEqual([{cardType: T.RPCChat.JourneycardType.welcome, convID}])
  })

  test('a service failure is logged, not thrown', async () => {
    fake.answer(dismissCard, serviceError)
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    dismissConversationJourneycard(conversationIDKey, T.RPCChat.JourneycardType.welcome)
    await settle()
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to dismiss journeycard: '))
  })
})

describe('storeless edges', () => {
  test('delete with no meta and no tlfName still posts, with an empty tlfName the service fills in', async () => {
    resetAllStores()
    deleteConversationMessage(conversationIDKey, textMessage())
    await settle()
    expect(paramsOf(fake, postDelete)).toEqual([expect.objectContaining({tlfName: ''})])
  })

  test('a failed cancel is logged as a warning', async () => {
    fake.answer(cancelPost, serviceError)
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    deleteConversationMessage(
      conversationIDKey,
      textMessage({id: T.Chat.numberToMessageID(0), outboxID: T.Chat.stringToOutboxID('0a0b')})
    )
    await settle()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deleteMessage: failed to delete: '))
    expect(error).not.toHaveBeenCalled()
  })

  test('the missing-id and invalid-conversation cases are logged', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    deleteConversationMessage(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0)}))
    deleteConversationMessage(T.Chat.noConversationIDKey, textMessage())
    await settle()
    expect(warn.mock.calls).toEqual([
      ['deleteMessage: no message id or outbox id'],
      ['deleteMessage: no conversation id'],
    ])
  })

  test('a reaction to a message with no id yet is not posted', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    toggleConversationMessageReaction(conversationIDKey, textMessage({id: T.Chat.numberToMessageID(0)}), ':+1:')
    await settle()
    expect(paramsOf(fake, postReaction)).toEqual([])
  })

  test('a reaction toggles without looking at existing reactions', async () => {
    const reactions: T.Chat.Reactions = new Map([
      [':+1:', {decorated: ':+1:', users: [{timestamp: 1, username: 'testuser'}]}],
    ])
    toggleConversationMessageReaction(conversationIDKey, textMessage({reactions}), ':+1:')
    await settle()
    expect(paramsOf(fake, postReaction)).toEqual([expect.objectContaining({body: ':+1:'})])
  })

  // Every failure the engine reports is a service error, a lost link included, so the error-level
  // branch is for a bug in the app's own code and the service cannot reach it
  test('a reaction service failure and a lost link are both logged as info', async () => {
    const info = jest.spyOn(logger, 'info')
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    fake.answer(postReaction, serviceError)
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':+1:')
    await settle()
    expect(paramsOf(fake, postReaction)).toHaveLength(1)
    fake.drop()
    await settle()
    toggleConversationMessageReactionByID(conversationIDKey, T.Chat.numberToMessageID(10), ':-1:')
    await settle()
    expect(info.mock.calls.filter(c => String(c[0]).startsWith('toggleReaction'))).toEqual([
      [expect.stringContaining('toggleReaction: failed to post ')],
      [expect.stringContaining('toggleReaction: failed to post ')],
    ])
    expect(error).not.toHaveBeenCalled()
  })

  test('reply privately with an empty conversation id does not open anything', async () => {
    created(newConvItem(), new Uint8Array())
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const nav = showingThread()
    replyPrivatelyToConversationMessage(textMessage())
    await settleAndNavigate()
    expectNothingOpened(nav)
    expect(warn).toHaveBeenCalledWith("replyPrivately: couldn't make a new conversation")
  })

  test('reply privately with no meta warns', async () => {
    created(noMeta())
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await settle()
    expect(warn).toHaveBeenCalledWith('replyPrivately: unable to make meta')
  })

  test('a failed adhoc create goes to ignorePromise', async () => {
    fake.answer(newConversation, serviceError)
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    replyPrivatelyToConversationMessage(textMessage())
    await settle()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(RPCError))
  })

  // The engine fails every call on a lost link with a service error, so pin and journeycard log it
  test('pin and journeycard on a lost service link log the failure', async () => {
    fake.drop()
    await settle()
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    pinConversationMessage(conversationIDKey, T.Chat.numberToMessageID(10))
    dismissConversationJourneycard(conversationIDKey, T.RPCChat.JourneycardType.welcome)
    await settle()
    expect(error.mock.calls).toEqual([
      [expect.stringContaining('pinConversationMessage: ')],
      [expect.stringContaining('Failed to dismiss journeycard: ')],
    ])
  })
})
