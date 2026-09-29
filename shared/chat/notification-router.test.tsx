/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import logger from '@/logger'
import {useDaemonState} from '@/stores/daemon'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {
  decodeChatNotification,
  isChatNotification,
  routeChatNotification,
  type ChatNotification,
} from './notification-router'
import {
  registerReloadHandler,
  registerThreadHandler,
  useReloadTriggers,
  useThreadNotifications,
  type ReloadTrigger,
  type ThreadNotification,
} from './notification-registry'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 1, 1, 1]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([2, 2, 2, 2]))
const convC = T.Chat.conversationIDToKey(new Uint8Array([3, 3, 3, 3]))
const rpcConvID = (id: T.Chat.ConversationIDKey) => T.Chat.keyToConversationID(id)
const convIDString = (id: T.Chat.ConversationIDKey) => T.Chat.conversationIDKeyToString(id)

const chat = (type: ChatNotification['type'], params: object) => ({payload: {params}, type}) as ChatNotification
const activity = (a: object) => chat('chat.1.NotifyChat.NewChatActivity', {activity: a})
const inboxItem = (id: T.Chat.ConversationIDKey) => ({convID: convIDString(id)}) as T.RPCChat.InboxUIItem
const typingIn = (id: T.Chat.ConversationIDKey, username: string) =>
  chat('chat.1.NotifyChat.ChatTypingUpdate', {
    typingUpdates: [{convID: rpcConvID(id), typers: [{deviceID: 'd', uid: 'u', username}]}],
  })

// flattens a decode into the conversations each stage is told about, and what
const decoded = (action: ChatNotification) => {
  const {reloadEach, reloads, thread} = decodeChatNotification(action)
  return {
    reloads: [
      ...reloads.map(d => [d.conversationIDKey, d.notification.type]),
      ...[...(reloadEach?.conversationIDKeys ?? [])].map(id => [id, reloadEach?.notification.type]),
    ],
    thread: thread.map(d => [d.conversationIDKey, d.notification.type]),
  }
}

const unregisters: Array<() => void> = []
const onThread = (id: T.Chat.ConversationIDKey, handler: (n: ThreadNotification) => void) => {
  unregisters.push(registerThreadHandler(id, handler))
}
const onReload = (id: T.Chat.ConversationIDKey, handler: (r: ReloadTrigger) => void) => {
  unregisters.push(registerReloadHandler(id, handler))
}

beforeEach(() => {
  useConfigState.setState({loggedIn: false})
})

afterEach(() => {
  unregisters.splice(0).forEach(u => u())
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('isChatNotification', () => {
  test.each([
    'chat.1.NotifyChat.NewChatActivity',
    'chat.1.NotifyChat.ChatThreadsStale',
    'chat.1.NotifyChat.ChatInboxSynced',
    'chat.1.NotifyChat.ChatIdentifyUpdate',
    'chat.1.chatUi.chatInboxLayout',
    'chat.1.chatUi.chatCommandStatus',
    'chat.1.chatUi.chatBotCommandsUpdateStatus',
    'chat.1.NotifyChat.ChatLeftConversation',
    'chat.1.NotifyChat.ChatResetConversation',
  ])('%s is routed', type => {
    expect(isChatNotification({payload: {params: {}}, type} as never)).toBe(true)
  })

  // these concern a team, a settings screen or a name, not a conversation, so they stay on the bus
  test.each([
    'chat.1.NotifyChat.ChatArchiveComplete',
    'chat.1.NotifyChat.ChatArchiveProgress',
    'chat.1.chatUi.chatShowManageChannels',
    'chat.1.chatUi.chatMaybeMentionUpdate',
    'keybase.1.gregorUI.pushState',
    'keybase.1.NotifyTeam.teamChangedByID',
  ])('%s is not', type => {
    expect(isChatNotification({payload: {params: {}}, type} as never)).toBe(false)
  })
})

describe('decodeChatNotification', () => {
  test('an incoming message goes to its thread, then reloads its meta and messages', () => {
    expect(
      decoded(
        activity({
          activityType: T.RPCChat.ChatActivityType.incomingMessage,
          incomingMessage: {conv: null, convID: rpcConvID(convA)},
        })
      )
    ).toEqual({
      reloads: [
        [convA, 'metadata'],
        [convA, 'messages'],
      ],
      thread: [[convA, 'incomingMessage']],
    })
  })

  test.each([
    ['messagesUpdated', {messagesUpdated: {convID: rpcConvID(convA), updates: null}}],
    ['reactionUpdate', {reactionUpdate: {convID: rpcConvID(convA), reactionUpdates: null}}],
    ['expunge', {expunge: {convID: rpcConvID(convA), expunge: {basis: 0, upto: 1}}}],
    ['ephemeralPurge', {ephemeralPurge: {convID: rpcConvID(convA), msgs: null}}],
  ] as const)('%s goes to its thread and reloads meta and messages', (type, fields) => {
    expect(decoded(activity({activityType: T.RPCChat.ChatActivityType[type], ...fields}))).toEqual({
      reloads: [
        [convA, 'metadata'],
        [convA, 'messages'],
      ],
      thread: [[convA, type]],
    })
  })

  describe('which messages a messages reload names', () => {
    const mid = T.Chat.numberToMessageID
    const placeholder = (id: number) =>
      ({placeholder: {hidden: false, messageID: id}, state: T.RPCChat.MessageUnboxedState.placeholder}) as T.RPCChat.UIMessage
    const valid = (id: number, messageBody: object) =>
      ({state: T.RPCChat.MessageUnboxedState.valid, valid: {messageBody, messageID: id}}) as unknown as T.RPCChat.UIMessage
    const messagesReload = (a: object) =>
      decodeChatNotification(activity(a)).reloads.find(d => d.notification.type === 'messages')?.notification
    const incoming = (message: T.RPCChat.UIMessage, modifiedMessage?: T.RPCChat.UIMessage) =>
      messagesReload({
        activityType: T.RPCChat.ChatActivityType.incomingMessage,
        incomingMessage: {conv: null, convID: rpcConvID(convA), message, modifiedMessage},
      })
    const text = {messageType: T.RPCChat.MessageType.text, text: {body: 'hi'}}

    test('an incoming message names itself, the message it modified and the target of its body', () => {
      expect(incoming(valid(40, text))).toEqual({messageIDs: [mid(40)], type: 'messages'})
      expect(incoming(valid(40, text), valid(20, text))).toEqual({messageIDs: [mid(40), mid(20)], type: 'messages'})
      expect(
        incoming(valid(41, {edit: {body: 'x', messageID: 20}, messageType: T.RPCChat.MessageType.edit}), valid(20, text))
      ).toEqual({messageIDs: [mid(41), mid(20)], type: 'messages'})
      expect(
        incoming(valid(42, {delete: {messageIDs: [20, 21]}, messageType: T.RPCChat.MessageType.delete}))
      ).toEqual({messageIDs: [mid(42), mid(20), mid(21)], type: 'messages'})
      expect(
        incoming(valid(43, {messageType: T.RPCChat.MessageType.reaction, reaction: {b: ':+1:', m: 20}}))
      ).toEqual({messageIDs: [mid(43), mid(20)], type: 'messages'})
      expect(
        incoming(valid(44, {messageType: T.RPCChat.MessageType.unfurl, unfurl: {messageID: 20, unfurl: {}}}))
      ).toEqual({messageIDs: [mid(44), mid(20)], type: 'messages'})
      expect(incoming(placeholder(45))).toEqual({messageIDs: [mid(45)], type: 'messages'})
      expect(
        incoming(
          valid(46, {attachmentuploaded: {messageID: 20, object: {}}, messageType: T.RPCChat.MessageType.attachmentuploaded})
        )
      ).toEqual({messageIDs: [mid(46), mid(20)], type: 'messages'})
    })

    test('an update, an explosion and a reaction update name the messages they carry', () => {
      expect(
        messagesReload({
          activityType: T.RPCChat.ChatActivityType.messagesUpdated,
          messagesUpdated: {convID: rpcConvID(convA), updates: [placeholder(19), valid(20, text)]},
        })
      ).toEqual({messageIDs: [mid(19), mid(20)], type: 'messages'})
      expect(
        messagesReload({
          activityType: T.RPCChat.ChatActivityType.ephemeralPurge,
          ephemeralPurge: {convID: rpcConvID(convA), msgs: [valid(21, text)]},
        })
      ).toEqual({messageIDs: [mid(21)], type: 'messages'})
      expect(
        messagesReload({
          activityType: T.RPCChat.ChatActivityType.reactionUpdate,
          reactionUpdate: {convID: rpcConvID(convA), reactionUpdates: [{reactions: {reactions: {}}, targetMsgID: 22}]},
        })
      ).toEqual({messageIDs: [mid(22)], type: 'messages'})
    })

    test('a delete-history names itself and everything below its line', () => {
      expect(
        incoming(valid(47, {deletehistory: {upto: 30}, messageType: T.RPCChat.MessageType.deletehistory}))
      ).toEqual({messageIDs: [mid(47)], type: 'messages', upTo: mid(30)})
    })

    test('an expunge names everything below its line', () => {
      expect(
        messagesReload({
          activityType: T.RPCChat.ChatActivityType.expunge,
          expunge: {convID: rpcConvID(convA), expunge: {basis: 0, upto: 30}},
        })
      ).toEqual({messageIDs: [], type: 'messages', upTo: mid(30)})
    })
  })

  test.each([
    ['setStatus', {setStatus: {conv: inboxItem(convA), convID: rpcConvID(convB)}}],
    ['newConversation', {newConversation: {conv: inboxItem(convA), convID: rpcConvID(convB)}}],
    ['readMessage', {readMessage: {conv: inboxItem(convA), convID: rpcConvID(convB), msgID: 1}}],
  ] as const)('%s reloads the meta of the conversation its inbox item names', (type, fields) => {
    expect(decoded(activity({activityType: T.RPCChat.ChatActivityType[type], ...fields}))).toEqual({
      reloads: [[convA, 'metadata']],
      thread: [],
    })
  })

  test('an activity with no inbox item reloads the no-conversation readers', () => {
    expect(
      decoded(
        activity({
          activityType: T.RPCChat.ChatActivityType.readMessage,
          readMessage: {conv: null, convID: rpcConvID(convA), msgID: 1},
        })
      )
    ).toEqual({reloads: [[T.Chat.noConversationIDKey, 'metadata']], thread: []})
  })

  test.each([
    ['membersUpdate', {membersUpdate: {convID: rpcConvID(convA), members: null}}],
    [
      'setAppNotificationSettings',
      {setAppNotificationSettings: {channelWide: false, convID: rpcConvID(convA), settings: {}}},
    ],
  ] as const)('%s reloads its meta only', (type, fields) => {
    expect(decoded(activity({activityType: T.RPCChat.ChatActivityType[type], ...fields}))).toEqual({
      reloads: [[convA, 'metadata']],
      thread: [],
    })
  })

  test('a failed message goes once to each conversation its records name, and reloads the inbox item conversation', () => {
    const record = (id: T.Chat.ConversationIDKey) => ({convID: rpcConvID(id)})
    expect(
      decoded(
        activity({
          activityType: T.RPCChat.ChatActivityType.failedMessage,
          failedMessage: {conv: inboxItem(convC), outboxRecords: [record(convB), record(convA), record(convB)]},
        })
      )
    ).toEqual({
      reloads: [[convC, 'metadata']],
      thread: [
        [convB, 'failedMessage'],
        [convA, 'failedMessage'],
      ],
    })
  })

  test('each typing update is its own delivery, duplicates included', () => {
    const {thread} = decodeChatNotification(
      chat('chat.1.NotifyChat.ChatTypingUpdate', {
        typingUpdates: [
          {convID: rpcConvID(convA), typers: [{username: 'testuser-mac'}]},
          {convID: rpcConvID(convB), typers: null},
          {convID: rpcConvID(convA), typers: [{username: 'testuser-2'}]},
        ],
      })
    )
    expect(thread.map(d => [d.conversationIDKey, d.notification])).toEqual([
      [convA, {type: 'typing', typers: [{username: 'testuser-mac'}]}],
      [convB, {type: 'typing', typers: null}],
      [convA, {type: 'typing', typers: [{username: 'testuser-2'}]}],
    ])
  })

  test('coin flip statuses are grouped per conversation, in arrival order', () => {
    const status = (id: T.Chat.ConversationIDKey, gameID: string) => ({convID: convIDString(id), gameID})
    const {thread} = decodeChatNotification(
      chat('chat.1.chatUi.chatCoinFlipStatus', {
        statuses: [status(convB, 'b1'), status(convA, 'a1'), status(convB, 'b2')],
      })
    )
    expect(
      thread.map(d => [
        d.conversationIDKey,
        d.notification.type === 'coinFlipStatuses' ? d.notification.statuses.map(s => s.gameID) : [],
      ])
    ).toEqual([
      [convB, ['b1', 'b2']],
      [convA, ['a1']],
    ])
  })

  test('a stale-threads notice reloads each named thread once', () => {
    expect(
      decoded(
        chat('chat.1.NotifyChat.ChatThreadsStale', {
          updates: [
            {convID: rpcConvID(convA), updateType: T.RPCChat.StaleUpdateType.clear},
            {convID: rpcConvID(convC), updateType: T.RPCChat.StaleUpdateType.newactivity},
            {convID: rpcConvID(convA), updateType: T.RPCChat.StaleUpdateType.newactivity},
          ],
        })
      )
    ).toEqual({
      reloads: [
        [convA, 'staleThread'],
        [convC, 'staleThread'],
      ],
      thread: [],
    })
  })

  test('only an incremental inbox sync reloads threads', () => {
    const items = [{conv: {convID: convIDString(convA)}}, {conv: {convID: convIDString(convB)}}]
    expect(
      decoded(
        chat('chat.1.NotifyChat.ChatInboxSynced', {
          syncRes: {incremental: {items}, syncType: T.RPCChat.SyncInboxResType.incremental},
        })
      )
    ).toEqual({
      reloads: [
        [convA, 'staleThread'],
        [convB, 'staleThread'],
      ],
      thread: [],
    })
    expect(
      decoded(chat('chat.1.NotifyChat.ChatInboxSynced', {syncRes: {syncType: T.RPCChat.SyncInboxResType.clear}}))
    ).toEqual({reloads: [], thread: []})
  })

  test('participants reload the meta of every conversation with a participant list', () => {
    expect(
      decoded(
        chat('chat.1.NotifyChat.ChatParticipantsInfo', {
          participants: {[convIDString(convA)]: [], [convIDString(convB)]: null, [convIDString(convC)]: [{}]},
        })
      )
    ).toEqual({
      reloads: [
        [convA, 'metadata'],
        [convC, 'metadata'],
      ],
      thread: [],
    })
  })

  test('team retention reloads each of its conversations once', () => {
    expect(
      decoded(
        chat('chat.1.NotifyChat.ChatSetTeamRetention', {
          convs: [inboxItem(convA), inboxItem(convB), inboxItem(convA)],
        })
      )
    ).toEqual({
      reloads: [
        [convA, 'metadata'],
        [convB, 'metadata'],
      ],
      thread: [],
    })
  })

  test.each([
    ['chat.1.NotifyChat.ChatConvUpdate', {conv: inboxItem(convA), convID: rpcConvID(convB)}],
    ['chat.1.chatUi.chatInboxFailed', {convID: rpcConvID(convA)}],
    ['chat.1.NotifyChat.ChatSetConvSettings', {convID: rpcConvID(convA)}],
    ['chat.1.NotifyChat.ChatSetConvRetention', {convID: rpcConvID(convA)}],
  ] as const)('%s reloads one meta', (type, params) => {
    expect(decoded(chat(type, params))).toEqual({reloads: [[convA, 'metadata']], thread: []})
  })

  test('a conversation update with no inbox item reloads the no-conversation readers', () => {
    expect(decoded(chat('chat.1.NotifyChat.ChatConvUpdate', {conv: null, convID: rpcConvID(convA)}))).toEqual({
      reloads: [[T.Chat.noConversationIDKey, 'metadata']],
      thread: [],
    })
  })

  test('a finished download goes to the thread and reloads a reader of that message', () => {
    const {reloads, thread} = decodeChatNotification(
      chat('chat.1.NotifyChat.ChatAttachmentDownloadComplete', {convID: rpcConvID(convA), msgID: 7})
    )
    expect(thread).toEqual([
      {conversationIDKey: convA, notification: {msgID: 7, type: 'attachmentDownloadComplete'}},
    ])
    expect(reloads).toEqual([
      {
        conversationIDKey: convA,
        notification: {messageID: T.Chat.numberToMessageID(7), type: 'attachmentDownloaded'},
      },
    ])
  })

  test('an upload start is progress with no bytes', () => {
    const outboxID = new Uint8Array([9])
    expect(
      decodeChatNotification(
        chat('chat.1.NotifyChat.ChatAttachmentUploadStart', {convID: rpcConvID(convA), outboxID})
      ).thread
    ).toEqual([{conversationIDKey: convA, notification: {outboxID, type: 'attachmentUploadProgress'}}])
  })

  test.each([
    ['chat.1.NotifyChat.ChatRequestInfo', {convID: rpcConvID(convA)}, 'requestInfo'],
    ['chat.1.NotifyChat.ChatPaymentInfo', {convID: rpcConvID(convA)}, 'paymentInfo'],
    ['chat.1.NotifyChat.ChatPromptUnfurl', {convID: rpcConvID(convA)}, 'promptUnfurl'],
    ['chat.1.NotifyChat.ChatAttachmentDownloadProgress', {convID: rpcConvID(convA)}, 'attachmentDownloadProgress'],
    ['chat.1.NotifyChat.ChatAttachmentUploadProgress', {convID: rpcConvID(convA)}, 'attachmentUploadProgress'],
    ['chat.1.chatUi.chatCommandStatus', {convID: convIDString(convA)}, 'commandStatus'],
    ['chat.1.chatUi.chatCommandMarkdown', {convID: convIDString(convA)}, 'commandMarkdown'],
    ['chat.1.chatUi.chatGiphyToggleResultWindow', {convID: convIDString(convA)}, 'giphyToggleResultWindow'],
    ['chat.1.chatUi.chatGiphySearchResults', {convID: convIDString(convA)}, 'giphySearchResults'],
    ['chat.1.chatUi.chatBotCommandsUpdateStatus', {convID: convIDString(convA)}, 'botCommandsUpdateStatus'],
  ] as const)('%s goes to one thread only', (type, params, notification) => {
    expect(decoded(chat(type, params))).toEqual({reloads: [], thread: [[convA, notification]]})
  })

  test.each([
    'chat.1.NotifyChat.ChatIdentifyUpdate',
    'chat.1.NotifyChat.ChatInboxStale',
    'chat.1.NotifyChat.ChatInboxSyncStarted',
    'chat.1.NotifyChat.ChatSubteamRename',
    'chat.1.NotifyChat.ChatTLFFinalize',
    'chat.1.chatUi.chatInboxConversation',
    'chat.1.chatUi.chatInboxLayout',
    'chat.1.chatUi.chatInboxUnverified',
  ] as const)('%s is inbox-only', type => {
    expect(decoded(chat(type, {}))).toEqual({reloads: [], thread: []})
  })
})

describe('routeChatNotification', () => {
  test('runs the inbox, then every thread handler, then every reload handler', () => {
    useDaemonState.setState(s => {
      s.bootstrapStatus = T.castDraft({userReacjis: {skinTone: 0, topReacjis: null}} as T.RPCGen.BootstrapStatus)
    })
    const order: Array<string> = []
    const unsubscribe = useDaemonState.subscribe(() => order.push('inbox:reacjis'))
    onReload(convA, r => order.push(`reload:A:${r.type}`))
    onThread(convA, n => order.push(`thread:A:${n.type}`))
    onReload(convA, r => order.push(`reload2:A:${r.type}`))
    onThread(convA, n => order.push(`thread2:A:${n.type}`))
    routeChatNotification(
      activity({
        activityType: T.RPCChat.ChatActivityType.reactionUpdate,
        reactionUpdate: {
          convID: rpcConvID(convA),
          reactionUpdates: [{reactions: {reactions: {}}, targetMsgID: 1}],
          userReacjis: {skinTone: 0, topReacjis: [{name: ':+1:'}]},
        },
      })
    )
    unsubscribe()
    expect(order).toEqual([
      'inbox:reacjis',
      'thread:A:reactionUpdate',
      'thread2:A:reactionUpdate',
      'reload:A:metadata',
      'reload2:A:metadata',
      'reload:A:messages',
      'reload2:A:messages',
    ])
  })

  test('deliveries follow the notification, conversation by conversation', () => {
    const order: Array<string> = []
    onThread(convB, n => order.push(`B:${n.type === 'typing' ? n.typers?.[0]?.username : ''}`))
    onThread(convA, n => order.push(`A:${n.type === 'typing' ? n.typers?.[0]?.username : ''}`))
    routeChatNotification(
      chat('chat.1.NotifyChat.ChatTypingUpdate', {
        typingUpdates: [
          {convID: rpcConvID(convA), typers: [{username: 'testuser-mac'}]},
          {convID: rpcConvID(convB), typers: [{username: 'testuser-2'}]},
        ],
      })
    )
    expect(order).toEqual(['A:testuser-mac', 'B:testuser-2'])
  })

  test('a conversation nobody registered for reaches nobody', () => {
    const heard = jest.fn()
    onThread(convB, heard)
    onReload(convB, heard)
    expect(() => routeChatNotification(typingIn(convA, 'testuser-mac'))).not.toThrow()
    expect(heard).not.toHaveBeenCalled()
  })

  test('a stage nothing is registered for is not decoded', () => {
    const readStatuses = jest.fn(() => [{convID: convIDString(convA), gameID: 'a1'}][Symbol.iterator]())
    const coinFlip = chat('chat.1.chatUi.chatCoinFlipStatus', {statuses: {[Symbol.iterator]: readStatuses}})
    onReload(convA, jest.fn())
    routeChatNotification(coinFlip)
    expect(readStatuses).not.toHaveBeenCalled()
    const heard = jest.fn()
    onThread(convB, heard)
    routeChatNotification(coinFlip)
    expect(readStatuses).toHaveBeenCalledTimes(1)
    expect(heard).not.toHaveBeenCalled()
  })

  test('a handler that throws is logged and does not stop the rest', () => {
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const heard = jest.fn()
    onThread(convA, () => {
      throw new Error('boom')
    })
    onThread(convA, heard)
    routeChatNotification(typingIn(convA, 'testuser-mac'))
    expect(heard).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(
      'Error in chat notification handler for chat.1.NotifyChat.ChatTypingUpdate',
      expect.any(Error)
    )
  })

  test('a handler unregistered mid-delivery still hears the notification in flight', () => {
    const heard = jest.fn()
    let unregisterSecond: () => void = () => {}
    onThread(convA, () => unregisterSecond())
    unregisterSecond = registerThreadHandler(convA, heard)
    routeChatNotification(typingIn(convA, 'testuser-mac'))
    routeChatNotification(typingIn(convA, 'testuser-2'))
    expect(heard).toHaveBeenCalledTimes(1)
  })
})

describe('registry', () => {
  test('unregistering stops delivery', () => {
    const heard = jest.fn()
    const unregister = registerThreadHandler(convA, heard)
    routeChatNotification(typingIn(convA, 'testuser-mac'))
    unregister()
    routeChatNotification(typingIn(convA, 'testuser-2'))
    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('registering one handler twice delivers twice, and each unregister removes only its own', () => {
    const heard = jest.fn()
    const first = registerThreadHandler(convA, heard)
    unregisters.push(registerThreadHandler(convA, heard))
    routeChatNotification(typingIn(convA, 'testuser-mac'))
    expect(heard).toHaveBeenCalledTimes(2)
    first()
    first()
    routeChatNotification(typingIn(convA, 'testuser-2'))
    expect(heard).toHaveBeenCalledTimes(3)
  })

  const expunge = () =>
    activity({
      activityType: T.RPCChat.ChatActivityType.expunge,
      expunge: {convID: rpcConvID(convA), expunge: {basis: 0, upto: 1}},
    })

  test('a store reset keeps every registration', () => {
    const heard = jest.fn()
    onThread(convA, heard)
    onReload(convA, heard)
    resetAllStores()
    routeChatNotification(expunge())
    expect(heard.mock.calls.map(([n]: [{type: string}]) => n.type)).toEqual(['expunge', 'metadata', 'messages'])
  })

  test('an unregister from before a reset removes only its own registration', () => {
    const stale = registerThreadHandler(convA, jest.fn())
    resetAllStores()
    const heard = jest.fn()
    onThread(convA, heard)
    stale()
    routeChatNotification(typingIn(convA, 'testuser-mac'))
    expect(heard).toHaveBeenCalledTimes(1)
  })
})

describe('hooks', () => {
  test('useThreadNotifications hears its conversation while mounted, with its latest handler', () => {
    const heard: Array<string> = []
    const {rerender, unmount} = renderHook(
      ({id, prefix}) =>
        useThreadNotifications(id, n => {
          heard.push(`${prefix}:${n.type}`)
        }),
      {initialProps: {id: convA, prefix: 'first'}}
    )
    act(() => routeChatNotification(typingIn(convA, 'testuser-mac')))
    rerender({id: convA, prefix: 'second'})
    act(() => routeChatNotification(typingIn(convA, 'testuser-mac')))
    rerender({id: convB, prefix: 'second'})
    act(() => routeChatNotification(typingIn(convA, 'testuser-mac')))
    act(() => routeChatNotification(typingIn(convB, 'testuser-mac')))
    unmount()
    act(() => routeChatNotification(typingIn(convB, 'testuser-mac')))
    expect(heard).toEqual(['first:typing', 'second:typing', 'second:typing'])
  })

  test('useReloadTriggers hears reloads for its conversation while mounted', () => {
    const heard: Array<string> = []
    const {unmount} = renderHook(() => useReloadTriggers(convA, r => heard.push(r.type)))
    act(() =>
      routeChatNotification(
        chat('chat.1.NotifyChat.ChatThreadsStale', {
          updates: [{convID: rpcConvID(convA), updateType: T.RPCChat.StaleUpdateType.newactivity}],
        })
      )
    )
    unmount()
    act(() =>
      routeChatNotification(
        chat('chat.1.NotifyChat.ChatThreadsStale', {
          updates: [{convID: rpcConvID(convA), updateType: T.RPCChat.StaleUpdateType.newactivity}],
        })
      )
    )
    expect(heard).toEqual(['staleThread'])
  })
})
