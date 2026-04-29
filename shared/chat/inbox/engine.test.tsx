/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {
  getConversationThreadCacheSnapshot,
  putConversationThreadCacheSnapshot,
  type ConversationThreadSnapshot,
} from '@/chat/conversation/thread-cache'
import {handleConvoEngineIncoming} from './engine'
import {getInboxConversationMeta, getInboxConversationParticipants, syncBadgeState} from './metadata'
import {
  syncInboxRowBadgeState,
  syncInboxRowsFromParticipantMap,
  updateInboxRowTyping,
} from '@/stores/inbox-rows'

jest.mock('@/stores/inbox-rows', () => ({
  getInboxRowTrustedState: jest.fn(() => undefined),
  setInboxRowTrustedState: jest.fn(),
  syncInboxRowBadgeState: jest.fn(),
  syncInboxRowsFromLayout: jest.fn(),
  syncInboxRowsFromMetaAndParticipants: jest.fn(),
  syncInboxRowsFromMetas: jest.fn(),
  syncInboxRowsFromParticipantMap: jest.fn(),
  syncInboxRowsFromParticipants: jest.fn(),
  updateInboxRowTyping: jest.fn(),
}))

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const msgID = T.Chat.numberToMessageID(101)

const makeRpcOutboxID = (label: string): T.RPCChat.OutboxID => new TextEncoder().encode(label)

const makeThreadSnapshot = (): ConversationThreadSnapshot => ({
  accountsInfoMap: new Map(),
  explodingMode: 0,
  flipStatusMap: new Map(),
  loaded: true,
  messageIDToOrdinal: new Map(),
  messageMap: new Map(),
  messageOrdinals: [],
  messageTypeMap: new Map(),
  meta: {...Meta.makeConversationMeta(), conversationIDKey: convID},
  moreToLoadBack: false,
  moreToLoadForward: false,
  participants: {all: [], contactName: new Map(), name: []},
  paymentStatusMap: new Map(),
  pendingOutboxToOrdinal: new Map(),
  unfurlPrompt: new Map(),
})

const seedThreadCache = () => {
  putConversationThreadCacheSnapshot(convID, makeThreadSnapshot())
}

const makeValidTextUIMessage = (serverMsgID: T.Chat.MessageID, text: string): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: {
    atMentions: null,
    bodySummary: text,
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
    messageBody: {
      messageType: T.RPCChat.MessageType.text,
      text: {
        body: text,
        payments: null,
        replyTo: null,
        replyToUID: null,
        teamMentions: null,
        userMentions: null,
      },
    },
    messageID: T.Chat.messageIDToNumber(serverMsgID),
    outboxID: '',
    paymentInfos: null,
    pinnedMessageID: null,
    reactions: {},
    replyTo: null,
    requestInfo: null,
    senderDeviceID: new Uint8Array([1]),
    senderDeviceName: 'bob-device',
    senderDeviceRevokedAt: null,
    senderDeviceType: 'desktop',
    senderUID: new Uint8Array([2]),
    senderUsername: 'bob',
    superseded: false,
    unfurls: null,
  },
})

const makeIncomingTextMessage = (
  serverMsgID: T.Chat.MessageID,
  text: string,
  options?: {
    conv?: T.RPCChat.InboxUIItem | null
    conversationIDKey?: T.Chat.ConversationIDKey
  }
): T.RPCChat.IncomingMessage => ({
  conv: options?.conv,
  convID: T.Chat.keyToConversationID(options?.conversationIDKey ?? convID),
  desktopNotificationSnippet: '',
  displayDesktopNotification: false,
  message: makeValidTextUIMessage(serverMsgID, text),
  modifiedMessage: null,
  pagination: null,
})

const makeCoinFlipStatus = (
  override?: Partial<T.RPCChat.UICoinFlipStatus>
): T.RPCChat.UICoinFlipStatus => ({
  commitmentVisualization: '',
  convID,
  errorInfo: null,
  gameID: 'flip-game',
  participants: [],
  phase: T.RPCChat.UICoinFlipPhase.commitment,
  progressText: 'Collecting commitments',
  resultInfo: null,
  resultText: '',
  revealVisualization: '',
  ...override,
})

const makeUnverifiedInboxUIItem = (): T.RPCChat.UnverifiedInboxUIItem => ({
  commands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
  convID: T.Chat.conversationIDKeyToString(convID),
  convRetention: null,
  draft: null,
  finalizeInfo: null,
  isDefaultConv: false,
  isPublic: false,
  localMetadata: {
    channelName: '',
    headline: '',
    headlineDecorated: '',
    resetParticipants: null,
    snippet: '',
    snippetDecoration: T.RPCChat.SnippetDecoration.none,
    writerNames: null,
  },
  localVersion: 1,
  maxMsgID: T.Chat.messageIDToNumber(msgID),
  maxVisibleMsgID: T.Chat.messageIDToNumber(msgID),
  memberStatus: T.RPCChat.ConversationMemberStatus.active,
  membersType: T.RPCChat.ConversationMembersType.impteamnative,
  name: 'alice,bob,charlie',
  notifications: null,
  readMsgID: 0,
  status: T.RPCChat.ConversationStatus.unfiled,
  supersededBy: null,
  supersedes: null,
  teamRetention: null,
  teamType: T.RPCChat.TeamType.simple,
  time: 1,
  tlfID: 'tlf-id',
  topicType: T.RPCChat.TopicType.chat,
  version: 1,
  visibility: T.RPCGen.TLFVisibility.private,
})

test('global coin flip and decorator routing do not create thread cache entries', () => {
  const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([9, 8, 7, 6]))
  const first = makeCoinFlipStatus({gameID: 'flip-1', progressText: 'first'})
  const second = makeCoinFlipStatus({convID: otherConvID, gameID: 'flip-2'})

  handleConvoEngineIncoming({
    payload: {params: {statuses: [first, second]}},
    type: 'chat.1.chatUi.chatCoinFlipStatus',
  } as never)
  ;[
    {
      payload: {
        params: {
          convID: T.Chat.keyToConversationID(convID),
          domain: 'keybase.io',
          msgID: T.Chat.messageIDToNumber(msgID),
        },
      },
      type: 'chat.1.NotifyChat.ChatPromptUnfurl',
    },
    {
      payload: {
        params: {
          convID: T.Chat.keyToConversationID(convID),
          info: {} as T.RPCChat.UIRequestInfo,
          msgID: T.Chat.messageIDToNumber(msgID),
          uid: new Uint8Array([1]),
        },
      },
      type: 'chat.1.NotifyChat.ChatRequestInfo',
    },
    {
      payload: {
        params: {
          convID: T.Chat.keyToConversationID(convID),
          info: {} as T.RPCChat.UIPaymentInfo,
          msgID: T.Chat.messageIDToNumber(msgID),
          uid: new Uint8Array([1]),
        },
      },
      type: 'chat.1.NotifyChat.ChatPaymentInfo',
    },
  ].forEach(action => handleConvoEngineIncoming(action as never))

  expect(getConversationThreadCacheSnapshot(convID)).toBeUndefined()
  expect(getConversationThreadCacheSnapshot(otherConvID)).toBeUndefined()
})

test('global message activity routing invalidates thread cache and preserves returned global data', () => {
  seedThreadCache()

  handleConvoEngineIncoming({
    payload: {
      params: {
        activity: {
          activityType: T.RPCChat.ChatActivityType.messagesUpdated,
          messagesUpdated: {
            convID: T.Chat.keyToConversationID(convID),
            updates: [makeValidTextUIMessage(T.Chat.numberToMessageID(401), 'background update')],
          },
        },
      },
    },
    type: 'chat.1.NotifyChat.NewChatActivity',
  } as never)
  expect(getConversationThreadCacheSnapshot(convID)).toBeUndefined()

  const inboxUIItem = {convID: T.Chat.conversationIDKeyToString(convID)} as T.RPCChat.InboxUIItem
  seedThreadCache()
  const incomingResult = handleConvoEngineIncoming({
    payload: {
      params: {
        activity: {
          activityType: T.RPCChat.ChatActivityType.incomingMessage,
          incomingMessage: makeIncomingTextMessage(T.Chat.numberToMessageID(501), 'background incoming', {
            conv: inboxUIItem,
          }),
        },
      },
    },
    type: 'chat.1.NotifyChat.NewChatActivity',
  } as never)
  expect(incomingResult.inboxUIItem).toBe(inboxUIItem)
  expect(getConversationThreadCacheSnapshot(convID)).toBeUndefined()

  const userReacjis = {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: null}
  seedThreadCache()
  const reactionResult = handleConvoEngineIncoming({
    payload: {
      params: {
        activity: {
          activityType: T.RPCChat.ChatActivityType.reactionUpdate,
          reactionUpdate: {
            convID: T.Chat.keyToConversationID(convID),
            reactionUpdates: [
              {
                reactions: {reactions: null},
                targetMsgID: T.Chat.messageIDToNumber(msgID),
              },
            ],
            userReacjis,
          },
        },
      },
    },
    type: 'chat.1.NotifyChat.NewChatActivity',
  } as never)
  expect(reactionResult.userReacjis).toEqual(userReacjis)
  expect(getConversationThreadCacheSnapshot(convID)).toBeUndefined()
})

test('global failed message and transfer routing invalidate thread cache', () => {
  seedThreadCache()
  handleConvoEngineIncoming({
    payload: {
      params: {
        activity: {
          activityType: T.RPCChat.ChatActivityType.failedMessage,
          failedMessage: {
            conv: null,
            isEphemeralPurge: false,
            outboxRecords: [
              {
                Msg: {},
                convID: T.Chat.keyToConversationID(convID),
                ctime: 0,
                identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
                ordinal: 0,
                outboxID: makeRpcOutboxID('outbox-1'),
                state: {
                  error: {
                    message: 'network fail',
                    typ: T.RPCChat.OutboxErrorType.misc,
                  },
                  state: T.RPCChat.OutboxStateType.error,
                },
              } as T.RPCChat.OutboxRecord,
            ],
          },
        },
      },
    },
    type: 'chat.1.NotifyChat.NewChatActivity',
  } as never)
  expect(getConversationThreadCacheSnapshot(convID)).toBeUndefined()

  seedThreadCache()
  handleConvoEngineIncoming({
    payload: {
      params: {
        bytesComplete: 25,
        bytesTotal: 100,
        convID: T.Chat.keyToConversationID(convID),
        msgID: T.Chat.messageIDToNumber(msgID),
      },
    },
    type: 'chat.1.NotifyChat.ChatAttachmentDownloadProgress',
  } as never)
  expect(getConversationThreadCacheSnapshot(convID)).toBeUndefined()

  seedThreadCache()
  handleConvoEngineIncoming({
    payload: {
      params: {
        bytesComplete: 25,
        bytesTotal: 100,
        convID: T.Chat.keyToConversationID(convID),
        outboxID: makeRpcOutboxID('upload-outbox'),
        uid: 'uid',
      },
    },
    type: 'chat.1.NotifyChat.ChatAttachmentUploadProgress',
  } as never)
  expect(getConversationThreadCacheSnapshot(convID)).toBeUndefined()
})

test('global typing and participant updates route to inbox rows', () => {
  const typingUpdates = [
    {
      convID: T.Chat.keyToConversationID(convID),
      typers: [{deviceID: 'device-id', uid: 'uid', username: 'bob'}],
    },
  ]

  handleConvoEngineIncoming({
    payload: {params: {typingUpdates}},
    type: 'chat.1.NotifyChat.ChatTypingUpdate',
  } as never)

  expect(updateInboxRowTyping).toHaveBeenCalledWith(typingUpdates)

  const participantMap = {
    [T.Chat.conversationIDKeyToString(convID)]: [
      {assertion: 'alice', inConvName: true, type: T.RPCChat.UIParticipantType.user},
      {assertion: 'bob', inConvName: true, type: T.RPCChat.UIParticipantType.user},
    ],
  }

  handleConvoEngineIncoming({
    payload: {params: {participants: participantMap}},
    type: 'chat.1.NotifyChat.ChatParticipantsInfo',
  } as never)

  expect(syncInboxRowsFromParticipantMap).toHaveBeenCalledWith(participantMap)
})

test('global inbox failure routing stores error metadata and rekey participants', () => {
  handleConvoEngineIncoming({
    payload: {
      params: {
        convID: T.Chat.keyToConversationID(convID),
        error: {
          message: 'rekey needed',
          rekeyInfo: {
            readerNames: ['charlie'],
            rekeyers: ['bob'],
            tlfName: 'alice,bob,charlie',
            tlfPublic: false,
            writerNames: ['alice', 'bob'],
          },
          remoteConv: makeUnverifiedInboxUIItem(),
          typ: T.RPCChat.ConversationErrorType.otherrekeyneeded,
          unverifiedTLFName: 'alice,bob,charlie',
        },
      },
    },
    type: 'chat.1.chatUi.chatInboxFailed',
  } as never)

  const meta = getInboxConversationMeta(convID)
  expect(meta?.trustedState).toBe('error')
  expect(meta?.snippet).toBe('rekey needed')
  expect([...(meta?.rekeyers ?? [])]).toEqual(['bob'])
  expect(getInboxConversationParticipants(convID)?.name).toEqual(['alice', 'bob', 'charlie'])
})

test('syncBadgeState delegates badge ownership to inbox rows', () => {
  const badgeState = {
    bigTeamBadgeCount: 0,
    conversations: [
      {
        badgeCount: 1,
        convID: T.Chat.keyToConversationID(convID),
        unreadMessages: 6,
      },
    ],
    homeTodoItems: 0,
    inboxVers: 0,
    newDevices: null,
    newFollowers: 0,
    newGitRepoGlobalUniqueIDs: [],
    newTeamAccessRequestCount: 0,
    newTeams: [],
    newTlfs: 0,
    rekeysNeeded: 0,
    resetState: {active: false, endTime: 0},
    revokedDevices: null,
    smallTeamBadgeCount: 1,
    teamsWithResetUsers: null,
    unverifiedEmails: 0,
    unverifiedPhones: 0,
  } as T.RPCGen.BadgeState

  syncBadgeState(badgeState)

  expect(syncInboxRowBadgeState).toHaveBeenCalledWith(badgeState)
})
