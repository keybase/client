/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as OrangeLine from './orange-line-context'
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {routeChatNotification} from '@/chat/notification-router'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {installListenerEngine, uninstallListenerEngine} from '@/test/fake-listener-engine'
import logger from '@/logger'
import {getConversationClientPrev} from './client-prev'
import {useConversationExplodingMode, useConversationMessage} from './data-hooks'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const messageID = (n: number) => T.Chat.numberToMessageID(n)

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

const setMeta = (over: Partial<T.Chat.ConversationMeta>) => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, ...over}], undefined, {force: true})
}

let rpc: FakeChatRpc

// the walk-back load returns whatever messages the service had around the unread line
const mockAroundMessages = (ids: ReadonlyArray<number | T.RPCChat.UIMessage>) => {
  rpc.on('loadThread', async p => {
    const messages = ids.map(id =>
      typeof id === 'number'
        ? {placeholder: {hidden: false, messageID: messageID(id)}, state: T.RPCChat.MessageUnboxedState.placeholder}
        : id
    )
    await Promise.resolve()
    p.onFullThread?.(JSON.stringify({messages}))
    return undefined
  })
  return () => rpc.params('loadThread')
}

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  rpc = installFakeChatRpc()
  jest.spyOn(OrangeLine, 'setConversationOrangeLine').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('getConversationClientPrev', () => {
  test('is 0 without a meta', () => {
    expect(getConversationClientPrev(conversationIDKey)).toBe(0)
  })

  test('reads maxVisibleMsgID off the meta', () => {
    setMeta({maxVisibleMsgID: messageID(12)})
    expect(getConversationClientPrev(conversationIDKey)).toBe(12)
  })
})

describe('useConversationExplodingMode', () => {
  const gregorPushState = (category: string, body: string) =>
    [{item: {body: new TextEncoder().encode(body), category}}] as unknown as ReturnType<
      typeof useConfigState.getState
    >['gregorPushState']

  test('is off with no gregor state', () => {
    const {result} = renderHook(() => useConversationExplodingMode(conversationIDKey))
    expect(result.current).toBe(0)
  })

  test('follows the gregor exploding item for this conversation', () => {
    const {result} = renderHook(() => useConversationExplodingMode(conversationIDKey))
    act(() => {
      useConfigState.setState({
        gregorPushState: gregorPushState(`exploding:${conversationIDKey}`, '300'),
      })
    })
    expect(result.current).toBe(300)
  })

  test('a dirty value reads as off rather than undefined', () => {
    const {result} = renderHook(() => useConversationExplodingMode(conversationIDKey))
    act(() => {
      useConfigState.setState({
        gregorPushState: gregorPushState(`exploding:${conversationIDKey}`, 'garbage'),
      })
    })
    expect(result.current).toBe(0)
  })
})

describe('useConversationMessage', () => {
  const waitForLoad = async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
      await flushPromises()
    })
  }

  const convID = T.Chat.keyToConversationID(conversationIDKey)
  const activity = (a: object) =>
    ({payload: {params: {activity: a}}, type: 'chat.1.NotifyChat.NewChatActivity'}) as never
  const placeholder = (id: number) =>
    ({placeholder: {hidden: false, messageID: id}, state: T.RPCChat.MessageUnboxedState.placeholder}) as T.RPCChat.UIMessage
  const valid = (id: number, messageBody: object) =>
    ({state: T.RPCChat.MessageUnboxedState.valid, valid: {messageBody, messageID: id}}) as unknown as T.RPCChat.UIMessage
  const incoming = (message: T.RPCChat.UIMessage, modifiedMessage?: T.RPCChat.UIMessage) =>
    activity({
      activityType: T.RPCChat.ChatActivityType.incomingMessage,
      incomingMessage: {conv: null, convID, message, modifiedMessage},
    })
  const text = {messageType: T.RPCChat.MessageType.text, text: {body: 'hi'}}
  const events = {
    'a delete of it': incoming(valid(40, {delete: {messageIDs: [20]}, messageType: T.RPCChat.MessageType.delete})),
    'a delete of another': incoming(valid(40, {delete: {messageIDs: [21]}, messageType: T.RPCChat.MessageType.delete})),
    'an edit of another': incoming(valid(40, {edit: {body: 'x', messageID: 21}, messageType: T.RPCChat.MessageType.edit})),
    'an edit of it': incoming(valid(40, {edit: {body: 'x', messageID: 20}, messageType: T.RPCChat.MessageType.edit})),
    'a delete-history below it': incoming(
      valid(40, {deletehistory: {upto: 20}, messageType: T.RPCChat.MessageType.deletehistory})
    ),
    'a delete-history past it': incoming(
      valid(40, {deletehistory: {upto: 21}, messageType: T.RPCChat.MessageType.deletehistory})
    ),
    'an expunge below it': activity({
      activityType: T.RPCChat.ChatActivityType.expunge,
      expunge: {convID, expunge: {basis: 0, upto: 20}},
    }),
    'an expunge past it': activity({
      activityType: T.RPCChat.ChatActivityType.expunge,
      expunge: {convID, expunge: {basis: 0, upto: 21}},
    }),
    'an explosion of another': activity({
      activityType: T.RPCChat.ChatActivityType.ephemeralPurge,
      ephemeralPurge: {convID, msgs: [placeholder(21)]},
    }),
    'an explosion of it': activity({
      activityType: T.RPCChat.ChatActivityType.ephemeralPurge,
      ephemeralPurge: {convID, msgs: [placeholder(21), placeholder(20)]},
    }),
    'an incoming message that modified it': incoming(valid(40, text), valid(20, text)),
    'a new message': incoming(valid(40, text)),
    'a reaction to another': incoming(valid(40, {messageType: T.RPCChat.MessageType.reaction, reaction: {b: ':+1:', m: 21}})),
    'a reaction to it': incoming(valid(40, {messageType: T.RPCChat.MessageType.reaction, reaction: {b: ':+1:', m: 20}})),
    'a reaction update of another': activity({
      activityType: T.RPCChat.ChatActivityType.reactionUpdate,
      reactionUpdate: {convID, reactionUpdates: [{reactions: {reactions: {}}, targetMsgID: 21}]},
    }),
    'a reaction update of it': activity({
      activityType: T.RPCChat.ChatActivityType.reactionUpdate,
      reactionUpdate: {convID, reactionUpdates: [{reactions: {reactions: {}}, targetMsgID: 20}]},
    }),
    'an unfurl of another': incoming(
      valid(40, {messageType: T.RPCChat.MessageType.unfurl, unfurl: {messageID: 21, unfurl: {}}})
    ),
    'an unfurl of it': incoming(valid(40, {messageType: T.RPCChat.MessageType.unfurl, unfurl: {messageID: 20, unfurl: {}}})),
    'an update of another': activity({
      activityType: T.RPCChat.ChatActivityType.messagesUpdated,
      messagesUpdated: {convID, updates: [placeholder(21)]},
    }),
    'an update of it': activity({
      activityType: T.RPCChat.ChatActivityType.messagesUpdated,
      messagesUpdated: {convID, updates: [placeholder(19), placeholder(20)]},
    }),
    'an upload completing for another': incoming(
      valid(40, {attachmentuploaded: {messageID: 21, object: {}}, messageType: T.RPCChat.MessageType.attachmentuploaded})
    ),
    'an upload completing for it': incoming(
      valid(40, {attachmentuploaded: {messageID: 20, object: {}}, messageType: T.RPCChat.MessageType.attachmentuploaded})
    ),
  }
  const loadsAfter = async (event: keyof typeof events) => {
    const load = mockAroundMessages([19, 20, 21])
    renderHook(() => useConversationMessage(conversationIDKey, messageID(20)))
    await waitForLoad()
    expect(load()).toHaveLength(1)
    await act(async () => {
      routeChatNotification(events[event])
      await flushPromises()
    })
    await waitForLoad()
    return load().length - 1
  }

  test.each([
    'a delete of it',
    'an edit of it',
    'a delete-history past it',
    'an expunge past it',
    'an explosion of it',
    'an incoming message that modified it',
    'a reaction to it',
    'a reaction update of it',
    'an unfurl of it',
    'an update of it',
    'an upload completing for it',
  ] as const)('%s reloads it', async event => {
    expect(await loadsAfter(event)).toBe(1)
  })

  test.each([
    'a delete of another',
    'an edit of another',
    'a delete-history below it',
    'an expunge below it',
    'an explosion of another',
    'a new message',
    'a reaction to another',
    'a reaction update of another',
    'an unfurl of another',
    'an update of another',
    'an upload completing for another',
  ] as const)('%s in its conversation leaves it', async event => {
    expect(await loadsAfter(event)).toBe(0)
  })

  describe('a reply', () => {
    const textBody = (body: string) => ({
      messageType: T.RPCChat.MessageType.text as const,
      text: {body, payments: null, replyTo: null, replyToUID: null, teamMentions: null, userMentions: null},
    })
    const validText = (id: number, body: string, replyTo: T.RPCChat.UIMessage | null = null): T.RPCChat.UIMessage => ({
      state: T.RPCChat.MessageUnboxedState.valid,
      valid: {
        atMentions: null,
        bodySummary: body,
        botUsername: '',
        channelMention: T.RPCChat.ChannelMention.none,
        channelNameMentions: null,
        ctime: 200,
        decoratedTextBody: null,
        etime: 0,
        explodedBy: null,
        hasPairwiseMacs: false,
        isCollapsed: false,
        isDeleteable: true,
        isEditable: true,
        isEphemeral: false,
        isEphemeralExpired: false,
        messageBody: textBody(body),
        messageID: id,
        outboxID: '',
        paymentInfos: null,
        pinnedMessageID: null,
        reactions: {},
        replyTo,
        requestInfo: null,
        senderDeviceID: new Uint8Array([1]),
        senderDeviceName: 'testuser-mac',
        senderDeviceRevokedAt: null,
        senderDeviceType: 'desktop',
        senderUID: new Uint8Array([2]),
        senderUsername: 'testuser',
        superseded: false,
        unfurls: null,
      },
    })
    const reply = validText(20, 'the reply', validText(15, 'the original'))

    const loadsAfterReplyEvent = async (event: ReturnType<typeof incoming>) => {
      const load = mockAroundMessages([19, reply, 21])
      const {result} = renderHook(() => useConversationMessage(conversationIDKey, messageID(20)))
      await waitForLoad()
      expect(result.current?.type === 'text' ? result.current.replyTo?.id : undefined).toBe(messageID(15))
      await act(async () => {
        routeChatNotification(event)
        await flushPromises()
      })
      await waitForLoad()
      return load().length - 1
    }

    test('an edit of the message it replies to reloads it', async () => {
      expect(
        await loadsAfterReplyEvent(
          incoming(valid(40, {edit: {body: 'x', messageID: 15}, messageType: T.RPCChat.MessageType.edit}))
        )
      ).toBe(1)
    })

    test('a delete of the message it replies to reloads it', async () => {
      expect(
        await loadsAfterReplyEvent(
          incoming(valid(40, {delete: {messageIDs: [15]}, messageType: T.RPCChat.MessageType.delete}))
        )
      ).toBe(1)
    })

    test('an edit of an unrelated message leaves it', async () => {
      expect(
        await loadsAfterReplyEvent(
          incoming(valid(40, {edit: {body: 'x', messageID: 16}, messageType: T.RPCChat.MessageType.edit}))
        )
      ).toBe(0)
    })
  })

  test('loads twenty around the message and returns it', async () => {
    const load = mockAroundMessages([19, 20, 21])
    const {result} = renderHook(() => useConversationMessage(conversationIDKey, messageID(20)))
    expect(result.current).toBeUndefined()
    await waitForLoad()
    expect(result.current?.id).toBe(messageID(20))
    expect(load()).toContainEqual(
      expect.objectContaining({
        messageIDControl: {mode: T.RPCChat.MessageIDControlMode.centered, num: 20, pivot: messageID(20)},
        pagination: null,
      })
    )
  })

  test('no load for an unsent message', async () => {
    const load = mockAroundMessages([])
    const {result} = renderHook(() => useConversationMessage(conversationIDKey, messageID(0)))
    await waitForLoad()
    expect(load()).toEqual([])
    expect(result.current).toBeUndefined()
  })

  test('no load for an id below 1, as a placeholder meta holds', async () => {
    const load = mockAroundMessages([])
    const {result} = renderHook(() => useConversationMessage(conversationIDKey, messageID(-1)))
    await waitForLoad()
    expect(load()).toEqual([])
    expect(result.current).toBeUndefined()
  })

  test('a load the service fails through the engine listener leaves nothing and logs why', async () => {
    restoreChatRpc()
    const engine = installListenerEngine()
    const warn = jest.spyOn(logger, 'warn')
    try {
      const {result} = renderHook(() => useConversationMessage(conversationIDKey, messageID(20)))
      await waitForLoad()
      engine.fail('chat.1.local.getThreadNonblock', T.RPCGen.StatusCode.scgeneric, 'service down')
      await waitForLoad()

      expect(result.current).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('service down'))
    } finally {
      uninstallListenerEngine()
    }
  })

  test('a failed load leaves nothing', async () => {
    rpc.fail('loadThread', new Error('offline'))
    const {result} = renderHook(() => useConversationMessage(conversationIDKey, messageID(20)))
    await waitForLoad()
    expect(result.current).toBeUndefined()
  })

  test('a finished download of that message reloads it', async () => {
    const load = mockAroundMessages([20])
    renderHook(() => useConversationMessage(conversationIDKey, messageID(20)))
    await waitForLoad()
    expect(load()).toHaveLength(1)
    await act(async () => {
      routeChatNotification({
        payload: {params: {convID: T.Chat.keyToConversationID(conversationIDKey), msgID: 20}},
        type: 'chat.1.NotifyChat.ChatAttachmentDownloadComplete',
      } as never)
      await flushPromises()
    })
    expect(load()).toHaveLength(2)
  })
})
