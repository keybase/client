/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {routeChatNotification, type ChatNotification} from '@/chat/notification-router'
import * as InboxMetadata from './metadata'
import {getInboxConversationMeta, getInboxConversationParticipants} from './metadata'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {updateInboxTyping} from '@/chat/inbox/typing-state'
import {useUsersState} from '@/stores/users'

jest.mock('@/chat/inbox/badge-state', () => ({
  syncInboxBadgeState: jest.fn(),
}))

jest.mock('@/chat/inbox/typing-state', () => ({
  updateInboxTyping: jest.fn(),
}))

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const msgID = T.Chat.numberToMessageID(101)

// Routes a notification and reports what its inbox stage applied beyond the inbox stores: the inbox
// item it hydrated and the reacjis it gave the daemon.
const inboxApplied = (action: ChatNotification) => {
  const hydrate = jest.spyOn(InboxMetadata, 'onIncomingInboxUIItem').mockImplementation(() => {})
  const before = {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: null}
  useDaemonState.setState(s => {
    s.bootstrapStatus = T.castDraft({userReacjis: before} as T.RPCGen.BootstrapStatus)
  })
  routeChatNotification(action)
  const applied: {inboxUIItem?: unknown; userReacjis?: unknown} = {}
  const inboxUIItem = hydrate.mock.calls.find(([item]) => item)?.[0]
  if (inboxUIItem) {
    applied.inboxUIItem = inboxUIItem
  }
  const userReacjis = useDaemonState.getState().bootstrapStatus?.userReacjis
  if (userReacjis !== before) {
    applied.userReacjis = userReacjis
  }
  hydrate.mockRestore()
  return applied
}

const makeRpcOutboxID = (label: string): T.RPCChat.OutboxID => new TextEncoder().encode(label)

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

test('coin flips, unfurl prompts, payments and requests leave the inbox nothing to apply', () => {
  const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([9, 8, 7, 6]))
  const first = makeCoinFlipStatus({gameID: 'flip-1', progressText: 'first'})
  const second = makeCoinFlipStatus({convID: otherConvID, gameID: 'flip-2'})

  expect(
    inboxApplied({
      payload: {params: {statuses: [first, second]}},
      type: 'chat.1.chatUi.chatCoinFlipStatus',
    } as never)
  ).toEqual({})
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
  ].forEach(action => expect(inboxApplied(action as never)).toEqual({}))
})

test('global message activity routing preserves returned global data', () => {
  expect(
    inboxApplied({
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
  ).toEqual({})

  const inboxUIItem = {convID: T.Chat.conversationIDKeyToString(convID)} as T.RPCChat.InboxUIItem
  const incomingResult = inboxApplied({
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

  const userReacjis = {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: null}
  const reactionResult = inboxApplied({
    payload: {
      params: {
        activity: {
          activityType: T.RPCChat.ChatActivityType.reactionUpdate,
          reactionUpdate: {
            convID: T.Chat.keyToConversationID(convID),
            reactionUpdates: [
              {
                reactions: {
                  reactions: {
                    ':+1:': {
                      decorated: ':+1:',
                      users: {
                        bob: {
                          ctime: 5,
                          reactionMsgID: T.Chat.messageIDToNumber(T.Chat.numberToMessageID(99)),
                        },
                      },
                    },
                  },
                },
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
})

test('read message activity without attached inbox item refreshes service-owned metadata', () => {
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
  const unbox = jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)

  expect(
    inboxApplied({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.readMessage,
            readMessage: {
              conv: null,
              convID: T.Chat.keyToConversationID(convID),
              msgID: T.Chat.messageIDToNumber(msgID),
            },
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  ).toEqual({})

  expect(unbox).toHaveBeenCalledWith({
    convIDs: [T.Chat.keyToConversationID(convID)],
  })
})

test('a failed message with no inbox item and transfer progress leave the inbox nothing to apply', () => {
  expect(
    inboxApplied({
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
  ).toEqual({})

  expect(
    inboxApplied({
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
  ).toEqual({})

  expect(
    inboxApplied({
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
  ).toEqual({})
})

test('global typing and participant updates route to inbox rows', () => {
  const typingUpdates = [
    {
      convID: T.Chat.keyToConversationID(convID),
      typers: [{deviceID: 'device-id', uid: 'uid', username: 'bob'}],
    },
  ]

  routeChatNotification({
    payload: {params: {typingUpdates}},
    type: 'chat.1.NotifyChat.ChatTypingUpdate',
  } as never)

  expect(updateInboxTyping).toHaveBeenCalledWith(typingUpdates)

  const participantMap = {
    [T.Chat.conversationIDKeyToString(convID)]: [
      {assertion: 'alice', inConvName: true, type: T.RPCChat.UIParticipantType.user},
      {assertion: 'bob', inConvName: true, type: T.RPCChat.UIParticipantType.user},
    ],
  }

  routeChatNotification({
    payload: {params: {participants: participantMap}},
    type: 'chat.1.NotifyChat.ChatParticipantsInfo',
  } as never)

  expect(getInboxConversationParticipants(convID)?.name).toEqual(['alice', 'bob'])
})

test('global inbox failure routing stores error metadata and rekey participants', () => {
  routeChatNotification({
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

test('a failed message marks every identify break, past records that are still sending', () => {
  const record = (label: string, state: T.RPCChat.OutboxState) =>
    ({
      Msg: {},
      convID: T.Chat.keyToConversationID(convID),
      ctime: 0,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      ordinal: 0,
      outboxID: makeRpcOutboxID(label),
      state,
    }) as T.RPCChat.OutboxRecord
  const identifyError = (username: string): T.RPCChat.OutboxState => ({
    error: {message: `identify failed for "${username}"`, typ: T.RPCChat.OutboxErrorType.identify},
    state: T.RPCChat.OutboxStateType.error,
  })
  routeChatNotification({
    payload: {
      params: {
        activity: {
          activityType: T.RPCChat.ChatActivityType.failedMessage,
          failedMessage: {
            conv: null,
            isEphemeralPurge: false,
            outboxRecords: [
              record('outbox-1', identifyError('testuser1')),
              record('outbox-2', {sending: 1, state: T.RPCChat.OutboxStateType.sending}),
              record('outbox-3', identifyError('testuser3')),
            ],
          },
        },
      },
    },
    type: 'chat.1.NotifyChat.NewChatActivity',
  } as never)
  const {infoMap} = useUsersState.getState()
  expect(infoMap.get('testuser1')?.broken).toBe(true)
  expect(infoMap.get('testuser3')?.broken).toBe(true)
})
