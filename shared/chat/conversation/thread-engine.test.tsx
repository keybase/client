/// <reference types="jest" />
import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'
import {makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {
  applyEphemeralPurgeToThread,
  applyExpungeToThread,
  applyFailedMessageToThread,
  applyIncomingMessageToThread,
  applyIncomingMutationToThread,
  applyMessagesUpdatedToThread,
  applyReactionUpdateToThread,
} from './thread-engine'
import type {ConversationThreadActions, ConversationThreadState} from './thread-context'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([9, 9, 9, 9]))
const username = 'testuser'
const devicename = 'testuser-mac'

const ordinal = (n: number) => T.Chat.numberToOrdinal(n)
const messageID = (n: number) => T.Chat.numberToMessageID(n)

type Actions = {
  [K in keyof ConversationThreadActions]: jest.Mock
}

const makeSnapshot = (
  messages: ReadonlyArray<T.Chat.Message>,
  over: Partial<ConversationThreadState> = {}
) =>
  ({
    loaded: true,
    messageIDToOrdinal: new Map(messages.map(m => [m.id, m.ordinal])),
    messageMap: new Map(messages.map(m => [m.ordinal, m])),
    messageOrdinals: messages.map(m => m.ordinal),
    moreToLoadForward: false,
    pendingOutboxToOrdinal: new Map(),
    ...over,
  }) as unknown as ConversationThreadState

const makeActions = (snapshot = makeSnapshot([])) => {
  const actions = {
    addMessages: jest.fn(),
    deleteMessages: jest.fn(),
    explodeMessages: jest.fn(),
    getSnapshot: jest.fn(() => snapshot),
    setMessageErrored: jest.fn(),
    updateOptimisticReactionDecorated: jest.fn(),
    updateReactions: jest.fn(),
  } as unknown as Actions
  return actions
}

const asActions = (a: Actions) => a as unknown as ConversationThreadActions

const noReactions: T.RPCChat.UIReactionMap = {reactions: undefined}

const makeValid = (over: Partial<T.RPCChat.UIMessageValid> = {}): T.RPCChat.UIMessageValid => ({
  botUsername: '',
  bodySummary: '',
  channelMention: T.RPCChat.ChannelMention.none,
  ctime: 1000 as T.RPCGen.Gregor1.Time,
  etime: 0 as T.RPCGen.Gregor1.Time,
  explodedBy: '',
  hasPairwiseMacs: false,
  isCollapsed: false,
  isDeleteable: true,
  isEditable: true,
  isEphemeral: false,
  isEphemeralExpired: false,
  messageBody: {messageType: T.RPCChat.MessageType.text, text: {body: 'hello'}},
  messageID: messageID(5),
  reactions: noReactions,
  senderDeviceID: 'devID' as unknown as T.RPCGen.Gregor1.DeviceID,
  senderDeviceName: devicename,
  senderDeviceType: 'desktop',
  senderUID: 'uid' as unknown as T.RPCGen.Gregor1.UID,
  senderUsername: username,
  superseded: false,
  ...over,
})

const validUIMessage = (over: Partial<T.RPCChat.UIMessageValid> = {}): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: makeValid(over),
})

const setActivelyLooking = (looking: boolean) => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(looking)
}

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: devicename,
    uid: 'uid',
    username,
  })
  setActivelyLooking(true)
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('applyMessagesUpdatedToThread', () => {
  test('ignores an empty update', () => {
    const actions = makeActions()
    applyMessagesUpdatedToThread(conversationIDKey, {convID: new Uint8Array(), updates: undefined}, asActions(actions))
    expect(actions.addMessages).not.toHaveBeenCalled()
  })

  test('bails on an unloaded thread the user is not looking at', () => {
    setActivelyLooking(false)
    const actions = makeActions(makeSnapshot([], {loaded: false}))
    applyMessagesUpdatedToThread(
      conversationIDKey,
      {convID: new Uint8Array(), updates: [validUIMessage()]},
      asActions(actions)
    )
    expect(actions.addMessages).not.toHaveBeenCalled()
  })

  test('still applies to an unloaded thread the user is looking at', () => {
    const actions = makeActions(makeSnapshot([], {loaded: false}))
    applyMessagesUpdatedToThread(
      conversationIDKey,
      {convID: new Uint8Array(), updates: [validUIMessage()]},
      asActions(actions)
    )
    expect(actions.addMessages).toHaveBeenCalledTimes(1)
  })

  test('converts updates and marks read only when actively looking', () => {
    const actions = makeActions()
    applyMessagesUpdatedToThread(
      conversationIDKey,
      {convID: new Uint8Array(), updates: [validUIMessage()]},
      asActions(actions)
    )
    const [messages, opts] = actions.addMessages.mock.calls[0] as [Array<T.Chat.Message>, object]
    expect(messages.map(m => m.id)).toEqual([5])
    expect(opts).toEqual({liveUpdate: true, markAsRead: true})

    setActivelyLooking(false)
    actions.addMessages.mockClear()
    applyMessagesUpdatedToThread(
      conversationIDKey,
      {convID: new Uint8Array(), updates: [validUIMessage()]},
      asActions(actions)
    )
    expect(actions.addMessages.mock.calls[0]?.[1]).toEqual({liveUpdate: true, markAsRead: false})
  })

  test('does not call addMessages when nothing converted', () => {
    const actions = makeActions()
    applyMessagesUpdatedToThread(
      conversationIDKey,
      {
        convID: new Uint8Array(),
        updates: [validUIMessage({messageBody: {messageType: T.RPCChat.MessageType.none}})],
      },
      asActions(actions)
    )
    expect(actions.addMessages).not.toHaveBeenCalled()
  })
})

describe('applyIncomingMutationToThread', () => {
  test('drops an existing message at the mutation ordinal first', () => {
    const existing = makeMessageText({conversationIDKey, id: messageID(5), ordinal: ordinal(5)})
    const actions = makeActions(makeSnapshot([existing]))
    applyIncomingMutationToThread(
      conversationIDKey,
      makeValid({messageBody: {edit: {body: 'new', messageID: messageID(4)}, messageType: T.RPCChat.MessageType.edit}}),
      undefined,
      asActions(actions)
    )
    expect(actions.deleteMessages).toHaveBeenCalledWith({liveUpdate: true, ordinals: [ordinal(5)]})
  })

  test('an edit adds the modified message and reports handled', () => {
    const actions = makeActions()
    const handled = applyIncomingMutationToThread(
      conversationIDKey,
      makeValid({messageBody: {edit: {body: 'new', messageID: messageID(4)}, messageType: T.RPCChat.MessageType.edit}}),
      validUIMessage({messageBody: {messageType: T.RPCChat.MessageType.text, text: {body: 'edited'}}, messageID: messageID(4)}),
      asActions(actions)
    )
    expect(handled).toBe(true)
    const [messages] = actions.addMessages.mock.calls[0] as [Array<T.Chat.Message>]
    expect(messages[0]?.id).toBe(4)
  })

  test('a delete of a plain message deletes by message id', () => {
    const target = makeMessageText({conversationIDKey, id: messageID(4), ordinal: ordinal(4)})
    const actions = makeActions(makeSnapshot([target]))
    const handled = applyIncomingMutationToThread(
      conversationIDKey,
      makeValid({
        messageBody: {delete: {messageIDs: [4]}, messageType: T.RPCChat.MessageType.delete},
      } as Partial<T.RPCChat.UIMessageValid>),
      undefined,
      asActions(actions)
    )
    expect(handled).toBe(true)
    expect(actions.explodeMessages).not.toHaveBeenCalled()
    expect(actions.deleteMessages).toHaveBeenCalledWith({liveUpdate: true, messageIDs: [messageID(4)]})
  })

  test('a delete of an exploding message explodes it instead', () => {
    const target = makeMessageText({
      conversationIDKey,
      exploding: true,
      id: messageID(4),
      ordinal: ordinal(4),
    })
    const actions = makeActions(makeSnapshot([target]))
    applyIncomingMutationToThread(
      conversationIDKey,
      makeValid({
        messageBody: {delete: {messageIDs: [4]}, messageType: T.RPCChat.MessageType.delete},
        senderUsername: 'testuser-two',
      } as Partial<T.RPCChat.UIMessageValid>),
      undefined,
      asActions(actions)
    )
    expect(actions.explodeMessages).toHaveBeenCalledWith([messageID(4)], 'testuser-two', true)
    expect(actions.deleteMessages).not.toHaveBeenCalled()
  })

  test('other message types are not handled here', () => {
    const actions = makeActions()
    expect(applyIncomingMutationToThread(conversationIDKey, makeValid(), undefined, asActions(actions))).toBe(
      false
    )
  })
})

describe('applyIncomingMessageToThread', () => {
  const incoming = (message: T.RPCChat.UIMessage, modifiedMessage?: T.RPCChat.UIMessage) =>
    ({message, modifiedMessage} as T.RPCChat.IncomingMessage)

  test('bails on an unloaded thread the user is not looking at', () => {
    setActivelyLooking(false)
    const actions = makeActions(makeSnapshot([], {loaded: false}))
    applyIncomingMessageToThread(conversationIDKey, incoming(validUIMessage()), asActions(actions))
    expect(actions.addMessages).not.toHaveBeenCalled()
  })

  test('an outbox reaction only updates the optimistic decoration', () => {
    const actions = makeActions()
    applyIncomingMessageToThread(
      conversationIDKey,
      incoming({
        outbox: {
          body: ':+1:',
          decoratedTextBody: ':+1: decorated',
          messageType: T.RPCChat.MessageType.reaction,
          outboxID: 'outbox1',
        } as T.RPCChat.UIMessageOutbox,
        state: T.RPCChat.MessageUnboxedState.outbox,
      }),
      asActions(actions)
    )
    expect(actions.updateOptimisticReactionDecorated).toHaveBeenCalledWith(
      T.Chat.stringToOutboxID('outbox1'),
      ':+1: decorated'
    )
    expect(actions.addMessages).not.toHaveBeenCalled()
  })

  test('an outbox reaction falls back to the raw body', () => {
    const actions = makeActions()
    applyIncomingMessageToThread(
      conversationIDKey,
      incoming({
        outbox: {
          body: ':+1:',
          messageType: T.RPCChat.MessageType.reaction,
          outboxID: 'outbox1',
        } as T.RPCChat.UIMessageOutbox,
        state: T.RPCChat.MessageUnboxedState.outbox,
      }),
      asActions(actions)
    )
    expect(actions.updateOptimisticReactionDecorated).toHaveBeenCalledWith(
      T.Chat.stringToOutboxID('outbox1'),
      ':+1:'
    )
  })

  test('an incoming edit is routed to the mutation path', () => {
    const actions = makeActions()
    applyIncomingMessageToThread(
      conversationIDKey,
      incoming(
        validUIMessage({
          messageBody: {edit: {body: 'new', messageID: messageID(4)}, messageType: T.RPCChat.MessageType.edit},
        }),
        validUIMessage({messageID: messageID(4)})
      ),
      asActions(actions)
    )
    const [messages] = actions.addMessages.mock.calls[0] as [Array<T.Chat.Message>]
    expect(messages[0]?.id).toBe(4)
    expect(actions.addMessages).toHaveBeenCalledTimes(1)
  })

  test('adds a plain new message', () => {
    const actions = makeActions()
    applyIncomingMessageToThread(conversationIDKey, incoming(validUIMessage()), asActions(actions))
    expect(actions.addMessages).toHaveBeenCalledWith([expect.objectContaining({id: 5})], {
      liveUpdate: true,
      markAsRead: true,
    })
  })

  test('drops new messages while there is still newer history to load', () => {
    const actions = makeActions(makeSnapshot([], {moreToLoadForward: true}))
    applyIncomingMessageToThread(conversationIDKey, incoming(validUIMessage()), asActions(actions))
    expect(actions.addMessages).not.toHaveBeenCalled()
  })
})

describe('applyFailedMessageToThread', () => {
  const outboxRecord = (
    over: Partial<T.RPCChat.OutboxRecord> = {}
  ): T.RPCChat.OutboxRecord =>
    ({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      outboxID: new Uint8Array([1, 2, 3]),
      state: {
        error: {message: 'boom', typ: T.RPCChat.OutboxErrorType.misc},
        state: T.RPCChat.OutboxStateType.error,
      },
      ...over,
    }) as T.RPCChat.OutboxRecord

  const failed = (outboxRecords?: ReadonlyArray<T.RPCChat.OutboxRecord>): T.RPCChat.FailedMessageInfo => ({
    isEphemeralPurge: false,
    outboxRecords,
  })

  test('ignores an empty payload', () => {
    const actions = makeActions()
    applyFailedMessageToThread(conversationIDKey, failed(), asActions(actions))
    expect(actions.setMessageErrored).not.toHaveBeenCalled()
  })

  test('ignores records for other conversations', () => {
    const actions = makeActions()
    applyFailedMessageToThread(
      conversationIDKey,
      failed([outboxRecord({convID: T.Chat.keyToConversationID(otherConversationIDKey)})]),
      asActions(actions)
    )
    expect(actions.setMessageErrored).not.toHaveBeenCalled()
  })

  test('ignores records that are not in an error state', () => {
    const actions = makeActions()
    applyFailedMessageToThread(
      conversationIDKey,
      failed([outboxRecord({state: {state: T.RPCChat.OutboxStateType.sending} as T.RPCChat.OutboxState})]),
      asActions(actions)
    )
    expect(actions.setMessageErrored).not.toHaveBeenCalled()
  })

  test('reports the error string and type for this conversation', () => {
    const actions = makeActions()
    applyFailedMessageToThread(conversationIDKey, failed([outboxRecord()]), asActions(actions))
    expect(actions.setMessageErrored).toHaveBeenCalledWith(
      T.Chat.rpcOutboxIDToOutboxID(new Uint8Array([1, 2, 3])),
      'boom',
      T.RPCChat.OutboxErrorType.misc
    )
  })
})

describe('applyReactionUpdateToThread', () => {
  test('ignores an empty update', () => {
    const actions = makeActions()
    applyReactionUpdateToThread({convID: new Uint8Array(), reactionUpdates: []} as never, asActions(actions))
    expect(actions.updateReactions).not.toHaveBeenCalled()
  })

  test('maps the reaction map per target message', () => {
    const actions = makeActions()
    applyReactionUpdateToThread(
      {
        convID: new Uint8Array(),
        reactionUpdates: [
          {
            reactions: {
              reactions: {':+1:': {decorated: 'd', users: {testuser: {ctime: 3}}}},
            },
            targetMsgID: 4,
          },
        ],
      } as never,
      asActions(actions)
    )
    const [updates] = actions.updateReactions.mock.calls[0] as [
      Array<{reactions?: Map<string, T.Chat.ReactionDesc>; targetMsgID: T.Chat.MessageID}>,
    ]
    expect(updates[0]?.targetMsgID).toBe(4)
    expect(updates[0]?.reactions?.get(':+1:')).toEqual({
      decorated: 'd',
      users: [{timestamp: 3, username: 'testuser'}],
    })
  })
})

describe('applyExpungeToThread', () => {
  test('deletes up to the expunge point with the default deletable types', () => {
    const actions = makeActions()
    applyExpungeToThread(
      {convID: new Uint8Array(), expunge: {basis: 0, upto: 7}} as T.RPCChat.ExpungeInfo,
      asActions(actions)
    )
    expect(actions.deleteMessages).toHaveBeenCalledWith({
      deletableMessageTypes: Common.allMessageTypes,
      liveUpdate: true,
      upToMessageID: messageID(7),
    })
  })

  test('uses the server-provided deletable types when config has them', () => {
    const chatDeletableByDeleteHistory = new Set<T.Chat.MessageType>(['text'])
    useConfigState.setState({chatDeletableByDeleteHistory})
    const actions = makeActions()
    applyExpungeToThread(
      {convID: new Uint8Array(), expunge: {basis: 0, upto: 7}} as T.RPCChat.ExpungeInfo,
      asActions(actions)
    )
    expect(actions.deleteMessages.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({deletableMessageTypes: chatDeletableByDeleteHistory})
    )
  })
})

describe('applyEphemeralPurgeToThread', () => {
  test('explodes every purged message that has an id', () => {
    const actions = makeActions()
    applyEphemeralPurgeToThread(
      {
        convID: new Uint8Array(),
        msgs: [
          validUIMessage({messageID: messageID(4)}),
          {outbox: {} as T.RPCChat.UIMessageOutbox, state: T.RPCChat.MessageUnboxedState.outbox},
          validUIMessage({messageID: messageID(6)}),
        ],
      } as T.RPCChat.EphemeralPurgeNotifInfo,
      asActions(actions)
    )
    expect(actions.explodeMessages).toHaveBeenCalledWith([messageID(4), messageID(6)], undefined, true)
  })
})
