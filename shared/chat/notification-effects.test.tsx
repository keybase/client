/** @jest-environment jsdom */
/// <reference types="jest" />
// Every effect of each chat notification, and the order the effects land in, driven through the
// real engine entry point with 0, 1 or 2 conversation screens mounted. Screen A is the
// conversation the notification is about, B is a second mounted conversation it is not about, and
// C is a conversation with no screen. The timeline records inbox stores, the mounted thread
// stores, the service calls (inbox unbox, thread load, mark read), the daemon's reacjis, the
// users store and desktop notifications.
import * as React from 'react'
import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import HiddenString from '@/util/hidden-string'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {NotifyPopup} from '@/util/misc'
import {_onEngineIncoming} from '@/constants/init/shared'
import * as InboxMetadata from '@/chat/inbox/metadata'
import {metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {useInboxTypingState} from '@/chat/inbox/typing-state'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useUsersState} from '@/stores/users'
import {resetAllStores} from '@/util/zustand'
import {flush} from '@/test/flush'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {
  ConversationThreadProvider,
  useConversationThreadActions,
  useConversationThreadID,
  useConversationThreadStore,
  type ConversationThreadActions,
} from './conversation/thread-context'
import {ConversationThreadLoadStatusProvider} from './conversation/thread-load-status-context'
import {ConversationInputProvider, useConversationInput} from './conversation/input-area/input-state'
import {useBotCommandsUpdateState} from './conversation/input-area/suggestors/commands'
import {
  useConversationMessage,
  useConversationMetadata,
  useConversationMetadataReload,
} from './conversation/data-hooks'

jest.mock('@/util/misc', () => ({
  ...jest.requireActual<object>('@/util/misc'),
  NotifyPopup: jest.fn(),
}))

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 1, 1, 1]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([2, 2, 2, 2]))
const convC = T.Chat.conversationIDToKey(new Uint8Array([3, 3, 3, 3]))
const labels = new Map([
  [convA, 'A'],
  [convB, 'B'],
  [convC, 'C'],
])
const label = (id: T.Chat.ConversationIDKey) => labels.get(id) ?? `?${id}`
const rpcConvID = (id: T.Chat.ConversationIDKey) => T.Chat.keyToConversationID(id)
const convIDString = (id: T.Chat.ConversationIDKey) => T.Chat.conversationIDKeyToString(id)
const msgID = (n: number) => T.Chat.numberToMessageID(n)

let timeline: Array<string> = []
const record = (event: string) => {
  timeline.push(event)
}

type Mounted = {
  actions: ConversationThreadActions
  id: T.Chat.ConversationIDKey
  store: ReturnType<typeof useConversationThreadStore>
}
const mounted = new Map<string, Mounted>()

// the message the storeless message consumer (useConversationMessage) is showing
const aroundMessageID = msgID(20)

const Probe = (p: {tag?: string}) => {
  const {tag} = p
  const id = useConversationThreadID()
  useConversationMetadataReload(id)
  const store = useConversationThreadStore()
  const actions = useConversationThreadActions()
  const commandStatus = useConversationInput(s => s.commandStatus)
  const commandMarkdown = useConversationInput(s => s.commandMarkdown)
  const giphyWindow = useConversationInput(s => s.giphyWindow)
  const giphyResult = useConversationInput(s => s.giphyResult)
  const botCommandsStatus = useBotCommandsUpdateState().status
  useConversationMessage(id, aroundMessageID)
  React.useEffect(() => {
    mounted.set(tag ?? label(id), {actions, id, store})
  }, [actions, id, store, tag])
  React.useEffect(() => {
    if (commandStatus) record(`input:${label(id)}:commandStatus:${commandStatus.displayText}`)
  }, [commandStatus, id])
  React.useEffect(() => {
    if (commandMarkdown) record(`input:${label(id)}:commandMarkdown:${commandMarkdown.title ?? ''}`)
  }, [commandMarkdown, id])
  React.useEffect(() => {
    if (giphyWindow) record(`input:${label(id)}:giphyWindow`)
  }, [giphyWindow, id])
  React.useEffect(() => {
    if (giphyResult) record(`input:${label(id)}:giphyResult`)
  }, [giphyResult, id])
  React.useEffect(() => {
    if (botCommandsStatus !== T.RPCChat.UIBotCommandsUpdateStatusTyp.blank) {
      record(`botCommands:${label(id)}:${botCommandsStatus}`)
    }
  }, [botCommandsStatus, id])
  return null
}

const MetadataReader = (p: {id: T.Chat.ConversationIDKey}) => {
  const {id} = p
  useConversationMetadata(id)
  return null
}

const Screen = (p: {id: T.Chat.ConversationIDKey; metadataReaders?: number; tag?: string}) => {
  const {id, metadataReaders = 0, tag} = p
  return (
    <ConversationThreadProvider id={id}>
      <ConversationThreadLoadStatusProvider id={id} skipThreadLoadOnSelection={true}>
        <ConversationInputProvider id={id}>
          <Probe tag={tag} />
          {Array.from({length: metadataReaders}, (_, i) => (
            <MetadataReader key={i} id={id} />
          ))}
        </ConversationInputProvider>
      </ConversationThreadLoadStatusProvider>
    </ConversationThreadProvider>
  )
}

const Screens = (p: {ids: ReadonlyArray<T.Chat.ConversationIDKey>}) => {
  const {ids} = p
  return (
    <>
      {ids.map(id => (
        <Screen key={id} id={id} />
      ))}
    </>
  )
}

const noConversationCommands = {
  typ: T.RPCChat.ConversationCommandGroupsTyp.none,
} satisfies T.RPCChat.ConversationCommandGroups

const makeInboxUIItem = (
  id: T.Chat.ConversationIDKey,
  overrides: Partial<T.RPCChat.InboxUIItem> = {}
): T.RPCChat.InboxUIItem => ({
  botAliases: undefined,
  botCommands: noConversationCommands,
  channel: '',
  commands: noConversationCommands,
  convID: convIDString(id),
  convRetention: undefined,
  convSettings: undefined,
  creatorInfo: undefined,
  draft: undefined,
  finalizeInfo: undefined,
  headline: '',
  headlineDecorated: '',
  isDefaultConv: false,
  isEmpty: false,
  isPublic: false,
  localVersion: 5,
  maxMsgID: 30,
  maxVisibleMsgID: 30,
  memberStatus: T.RPCChat.ConversationMemberStatus.active,
  membersType: T.RPCChat.ConversationMembersType.impteamnative,
  name: 'testuser,testuser-mac',
  notifications: undefined,
  participants: undefined,
  pinnedMsg: undefined,
  readMsgID: 30,
  resetParticipants: undefined,
  snippet: 'from the service',
  snippetDecorated: 'from the service',
  snippetDecoration: T.RPCChat.SnippetDecoration.none,
  status: T.RPCChat.ConversationStatus.unfiled,
  supersededBy: undefined,
  supersedes: undefined,
  teamRetention: undefined,
  teamType: T.RPCChat.TeamType.simple,
  time: 1000,
  tlfID: 'tlf-id',
  topicType: T.RPCChat.TopicType.chat,
  version: 5,
  visibility: T.RPCGen.TLFVisibility.private,
  ...overrides,
})

const makeValidText = (id: T.Chat.MessageID, text: string): T.RPCChat.UIMessage => ({
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
      text: {body: text, payments: null, replyTo: null, replyToUID: null, teamMentions: null, userMentions: null},
    },
    messageID: T.Chat.messageIDToNumber(id),
    outboxID: '',
    paymentInfos: null,
    pinnedMessageID: null,
    reactions: {},
    replyTo: null,
    requestInfo: null,
    senderDeviceID: new Uint8Array([1]),
    senderDeviceName: 'testuser-mac-device',
    senderDeviceRevokedAt: null,
    senderDeviceType: 'desktop',
    senderUID: new Uint8Array([2]),
    senderUsername: 'testuser-mac',
    superseded: false,
    unfurls: null,
  },
})

const makeFailedRecord = (
  id: T.Chat.ConversationIDKey,
  outboxID: string,
  error: {message: string; typ: T.RPCChat.OutboxErrorType}
): T.RPCChat.OutboxRecord =>
  ({
    Msg: {},
    convID: rpcConvID(id),
    ctime: 0,
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    ordinal: 0,
    outboxID: T.Chat.outboxIDToRpcOutboxID(T.Chat.stringToOutboxID(outboxID)),
    state: {error, state: T.RPCChat.OutboxStateType.error},
  }) as T.RPCChat.OutboxRecord

const threadText = (id: T.Chat.ConversationIDKey, n: number) =>
  Message.makeMessageText({
    author: 'testuser-mac',
    conversationIDKey: id,
    id: msgID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    timestamp: 100,
  })

const pendingText = (id: T.Chat.ConversationIDKey, outboxID: string) =>
  Message.makeMessageText({
    author: 'testuser',
    conversationIDKey: id,
    ordinal: T.Chat.numberToOrdinal(20.001),
    outboxID: T.Chat.stringToOutboxID(outboxID),
    submitState: 'pending',
    text: new HiddenString('sending'),
    timestamp: 100,
  })

const engineAction = (type: string, params: object) => ({payload: {params}, type}) as never

const activity = (a: object) => engineAction('chat.1.NotifyChat.NewChatActivity', {activity: a})

const incomingMessage = (
  id: T.Chat.ConversationIDKey,
  n: number,
  opts: {conv?: T.RPCChat.InboxUIItem; desktopNotification?: boolean} = {}
) =>
  activity({
    activityType: T.RPCChat.ChatActivityType.incomingMessage,
    incomingMessage: {
      conv: opts.conv ?? null,
      convID: rpcConvID(id),
      desktopNotificationSnippet: opts.desktopNotification ? 'hi there' : '',
      displayDesktopNotification: !!opts.desktopNotification,
      message: makeValidText(msgID(n), `incoming ${n}`),
      modifiedMessage: null,
      pagination: null,
    },
  })

const lookingAt = new Set<T.Chat.ConversationIDKey>()
let rpc: FakeChatRpc

const recordStoreChanges = () => {
  const unsubs = [
    useInboxMetadataState.subscribe((s, prev) => {
      if (s.metas !== prev.metas) record('inbox:metas')
      if (s.participants !== prev.participants) record('inbox:participants')
    }),
    useInboxTypingState.subscribe((s, prev) => {
      if (s.typing !== prev.typing) record('inbox:typing')
    }),
    useDaemonState.subscribe((s, prev) => {
      if (s.bootstrapStatus?.userReacjis !== prev.bootstrapStatus?.userReacjis) record('daemon:userReacjis')
    }),
    useUsersState.subscribe((s, prev) => {
      if (s.infoMap !== prev.infoMap) record('users')
    }),
    ...[...mounted.entries()].map(([l, m]) =>
      m.store.subscribe((s, prev) => {
        const changed = Object.keys(s).filter(
          k => typeof s[k as keyof typeof s] !== 'function' && s[k as keyof typeof s] !== prev[k as keyof typeof s]
        )
        record(`thread:${l}:${changed.sort().join(',')}`)
      })
    ),
  ]
  return () => unsubs.forEach(u => u())
}

let stopRecording: (() => void) | undefined

// Mounts the screens, loads each thread with one message (ordinal 10) so live updates apply, and
// settles every mount-time load before recording starts.
const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 5))
  })
  await flush()
}

const mountScreens = async (ids: ReadonlyArray<T.Chat.ConversationIDKey>, afterMount?: () => void) =>
  mountTree(<Screens ids={ids} />, afterMount)

const mountTree = async (tree: React.ReactElement, afterMount?: () => void) => {
  const rendered = render(tree)
  await settle()
  act(() => {
    for (const m of mounted.values()) {
      m.actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [10, 20].map(n => threadText(m.id, n)),
        moreToLoad: false,
        scrollDirection: 'none',
      })
    }
  })
  if (afterMount) {
    act(afterMount)
  }
  await settle()
  timeline = []
  stopRecording = recordStoreChanges()
  return rendered
}

const notify = async (action: never) => {
  act(() => {
    _onEngineIncoming(action)
  })
  await settle()
}

const convMetas = () =>
  metasReceived(
    [convA, convB, convC].map(id => ({
      ...Meta.makeConversationMeta(),
      conversationIDKey: id,
      readMsgID: msgID(0),
      teamname: `team${label(id)}`,
      trustedState: 'trusted' as const,
    })),
    undefined,
    {force: true}
  )

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'testuser',
  })
  convMetas()
  useDaemonState.setState(s => {
    s.bootstrapStatus = T.castDraft({
      loggedIn: true,
      userReacjis: {skinTone: 0, topReacjis: null},
    } as T.RPCGen.BootstrapStatus)
  })
  lookingAt.clear()
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockImplementation(id => lookingAt.has(id))
  const unboxRows = InboxMetadata.unboxRows
  jest.spyOn(InboxMetadata, 'unboxRows').mockImplementation(ids => {
    record(`unboxRows:${ids.map(label).join(',')}`)
    unboxRows(ids)
  })
  const forceUnboxRowsForService = InboxMetadata.forceUnboxRowsForService
  jest.spyOn(InboxMetadata, 'forceUnboxRowsForService').mockImplementation(ids => {
    record(`forceUnboxRows:${ids.map(label).join(',')}`)
    forceUnboxRowsForService(ids)
  })
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockImplementation(async p => {
    record(`rpc:unbox:${(p.convIDs ?? []).map(c => label(T.Chat.conversationIDToKey(c))).join(',')}`)
    return Promise.resolve()
  })
  jest.spyOn(T.RPCChat, 'localRequestInboxLayoutRpcPromise').mockImplementation(async () => {
    record('rpc:inboxLayout')
    return Promise.resolve()
  })
  jest.mocked(NotifyPopup).mockImplementation((title, opts) => {
    record(`desktopNotification:${title}:${opts?.body ?? ''}`)
  })
  rpc = installFakeChatRpc()
  rpc.on('loadThread', p => {
    record(
      `rpc:loadThread:${label(p.conversationIDKey)}:${p.reason === undefined ? 'around' : T.RPCChat.GetThreadReason[p.reason]}`
    )
    return {offline: false}
  })
  rpc.on('markRead', p => {
    record(`rpc:markRead:${label(p.conversationIDKey)}`)
  })
})

afterEach(() => {
  stopRecording?.()
  stopRecording = undefined
  cleanup()
  mounted.clear()
  restoreChatRpc()
  jest.restoreAllMocks()
  jest.mocked(NotifyPopup).mockReset()
  // a store reset keeps the switch flag, and a switch left open stops the next one resetting
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

type Scenario = 'none' | 'A' | 'A+B'
const scenarioIDs: {[S in Scenario]: ReadonlyArray<T.Chat.ConversationIDKey>} = {
  A: [convA],
  'A+B': [convA, convB],
  none: [],
}

const timelineFor = async (scenario: Scenario, c: Case) => {
  await mountScreens(scenarioIDs[scenario], c.afterMount)
  await notify(c.action())
  return timeline
}

type Case = {
  action: () => never
  // runs once the screens are mounted and loaded, before recording starts
  afterMount?: () => void
  expected: {[S in Scenario]: ReadonlyArray<string>}
  name: string
  setup?: () => void
}


const none: ReadonlyArray<string> = []
const cases: Array<Case> = [
  {
    action: () => incomingMessage(convA, 31, {conv: makeInboxUIItem(convA), desktopNotification: true}),
    expected: {
      A: [
        'desktopNotification:testuser-mac:hi there',
        'inbox:metas',
        'thread:A:liveUpdateVersion,messageIDToOrdinal,messageMap,messageOrdinals',
        'unboxRows:A',
      ],
      'A+B': [
        'desktopNotification:testuser-mac:hi there',
        'inbox:metas',
        'thread:A:liveUpdateVersion,messageIDToOrdinal,messageMap,messageOrdinals',
        'unboxRows:A',
      ],
      none: ['desktopNotification:testuser-mac:hi there', 'inbox:metas'],
    },
    name: 'incoming message, conversation not being looked at',
  },
  {
    action: () => incomingMessage(convA, 31, {conv: makeInboxUIItem(convA), desktopNotification: true}),
    expected: {
      A: [
        'inbox:metas',
        'thread:A:liveUpdateVersion,messageIDToOrdinal,messageMap,messageOrdinals',
        'unboxRows:A',
      ],
      'A+B': [
        'inbox:metas',
        'thread:A:liveUpdateVersion,messageIDToOrdinal,messageMap,messageOrdinals',
        'unboxRows:A',
      ],
      none: ['inbox:metas'],
    },
    name: 'incoming message, conversation being looked at',
    setup: () => lookingAt.add(convA),
  },
  {
    action: () => incomingMessage(convA, 31),
    expected: {
      A: [
        'thread:A:liveUpdateVersion,messageIDToOrdinal,messageMap,messageOrdinals',
        'unboxRows:A',
      ],
      'A+B': [
        'thread:A:liveUpdateVersion,messageIDToOrdinal,messageMap,messageOrdinals',
        'unboxRows:A',
      ],
      none: none,
    },
    name: 'incoming message with no inbox item',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.setStatus,
        setStatus: {conv: makeInboxUIItem(convA), convID: rpcConvID(convA), status: T.RPCChat.ConversationStatus.muted},
      }),
    expected: {
      A: ['inbox:metas', 'unboxRows:A'],
      'A+B': ['inbox:metas', 'unboxRows:A'],
      none: ['inbox:metas'],
    },
    name: 'setStatus',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.readMessage,
        readMessage: {conv: null, convID: rpcConvID(convA), msgID: 30},
      }),
    expected: {
      A: ['forceUnboxRows:A', 'rpc:unbox:A'],
      'A+B': ['forceUnboxRows:A', 'rpc:unbox:A'],
      none: ['forceUnboxRows:A', 'rpc:unbox:A'],
    },
    name: 'readMessage with no inbox item',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.readMessage,
        readMessage: {conv: makeInboxUIItem(convA), convID: rpcConvID(convA), msgID: 30},
      }),
    expected: {
      A: ['inbox:metas', 'unboxRows:A'],
      'A+B': ['inbox:metas', 'unboxRows:A'],
      none: ['inbox:metas'],
    },
    name: 'readMessage with an inbox item',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.newConversation,
        newConversation: {conv: makeInboxUIItem(convA), convID: rpcConvID(convA)},
      }),
    expected: {
      A: ['inbox:metas', 'unboxRows:A'],
      'A+B': ['inbox:metas', 'unboxRows:A'],
      none: ['inbox:metas'],
    },
    name: 'newConversation',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.failedMessage,
        failedMessage: {
          conv: makeInboxUIItem(convA),
          isEphemeralPurge: false,
          outboxRecords: [
            makeFailedRecord(convA, '0a0a', {message: 'network fail', typ: T.RPCChat.OutboxErrorType.misc}),
            makeFailedRecord(convB, '0b0b', {
              message: 'identify failed for "testuser-3"',
              typ: T.RPCChat.OutboxErrorType.identify,
            }),
          ],
        },
      }),
    afterMount: () => {
      mounted.get('A')?.actions.addMessages([pendingText(convA, '0a0a')])
      mounted.get('B')?.actions.addMessages([pendingText(convB, '0b0b')])
    },
    expected: {
      A: ['users', 'inbox:metas', 'thread:A:messageMap', 'unboxRows:A'],
      'A+B': ['users', 'inbox:metas', 'thread:A:messageMap', 'thread:B:messageMap', 'unboxRows:A'],
      none: ['users', 'inbox:metas'],
    },
    name: 'failedMessage across two conversations with an identify failure',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.membersUpdate,
        membersUpdate: {convID: rpcConvID(convA), members: null},
      }),
    expected: {
      A: ['forceUnboxRows:A', 'rpc:unbox:A', 'unboxRows:A'],
      'A+B': ['forceUnboxRows:A', 'rpc:unbox:A', 'unboxRows:A'],
      none: ['forceUnboxRows:A', 'rpc:unbox:A'],
    },
    name: 'membersUpdate',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.setAppNotificationSettings,
        setAppNotificationSettings: {
          channelWide: false,
          convID: rpcConvID(convA),
          settings: {channelWide: false, settings: {}},
        },
      }),
    expected: {
      A: ['inbox:metas', 'unboxRows:A'],
      'A+B': ['inbox:metas', 'unboxRows:A'],
      none: ['inbox:metas'],
    },
    name: 'setAppNotificationSettings',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.expunge,
        expunge: {convID: rpcConvID(convA), expunge: {basis: 0, upto: 15}},
      }),
    expected: {
      A: [
        'thread:A:liveUpdateVersion,messageIDToOrdinal,messageMap,messageOrdinals',
        'unboxRows:A',
      ],
      'A+B': [
        'thread:A:liveUpdateVersion,messageIDToOrdinal,messageMap,messageOrdinals',
        'unboxRows:A',
      ],
      none: none,
    },
    name: 'expunge',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.ephemeralPurge,
        ephemeralPurge: {convID: rpcConvID(convA), msgs: [makeValidText(msgID(10), 'gone')]},
      }),
    expected: {
      A: ['thread:A:liveUpdateVersion,messageMap', 'unboxRows:A'],
      'A+B': ['thread:A:liveUpdateVersion,messageMap', 'unboxRows:A'],
      none: none,
    },
    name: 'ephemeralPurge',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.reactionUpdate,
        reactionUpdate: {
          convID: rpcConvID(convA),
          reactionUpdates: [
            {
              reactions: {
                reactions: {':+1:': {decorated: ':+1:', users: {'testuser-mac': {ctime: 5, reactionMsgID: 40}}}},
              },
              targetMsgID: 10,
            },
          ],
          userReacjis: {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: [{name: ':+1:'}]},
        },
      }),
    expected: {
      A: [
        'daemon:userReacjis',
        'thread:A:liveUpdateVersion,messageMap',
        'unboxRows:A',
      ],
      'A+B': [
        'daemon:userReacjis',
        'thread:A:liveUpdateVersion,messageMap',
        'unboxRows:A',
      ],
      none: ['daemon:userReacjis'],
    },
    name: 'reactionUpdate',
  },
  {
    action: () =>
      activity({
        activityType: T.RPCChat.ChatActivityType.messagesUpdated,
        messagesUpdated: {convID: rpcConvID(convA), updates: [makeValidText(msgID(20), 'edited')]},
      }),
    expected: {
      A: ['thread:A:liveUpdateVersion,messageMap', 'unboxRows:A', 'rpc:loadThread:A:around'],
      'A+B': ['thread:A:liveUpdateVersion,messageMap', 'unboxRows:A', 'rpc:loadThread:A:around'],
      none: none,
    },
    name: 'messagesUpdated',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatConvUpdate', {conv: makeInboxUIItem(convA), convID: rpcConvID(convA)}),
    expected: {
      A: ['inbox:metas', 'unboxRows:A'],
      'A+B': ['inbox:metas', 'unboxRows:A'],
      none: ['inbox:metas'],
    },
    name: 'ChatConvUpdate',
  },
  {
    action: () =>
      engineAction('chat.1.chatUi.chatInboxFailed', {
        convID: rpcConvID(convA),
        error: {
          message: 'boom',
          rekeyInfo: null,
          remoteConv: {convID: convIDString(convA)},
          typ: T.RPCChat.ConversationErrorType.transient,
          unverifiedTLFName: 'testuser,testuser-mac',
        },
      }),
    expected: {
      A: ['unboxRows:A'],
      'A+B': ['unboxRows:A'],
      none: none,
    },
    name: 'chatInboxFailed',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatSetConvSettings', {
        conv: makeInboxUIItem(convA, {
          convSettings: {minWriterRoleInfo: {cannotWrite: true, changedBy: 'testuser-mac', role: T.RPCGen.TeamRole.admin}},
        }),
        convID: rpcConvID(convA),
      }),
    expected: {
      A: ['inbox:metas', 'unboxRows:A'],
      'A+B': ['inbox:metas', 'unboxRows:A'],
      none: ['inbox:metas'],
    },
    name: 'ChatSetConvSettings',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatSetConvRetention', {conv: makeInboxUIItem(convA), convID: rpcConvID(convA)}),
    expected: {
      A: ['inbox:metas', 'unboxRows:A'],
      'A+B': ['inbox:metas', 'unboxRows:A'],
      none: ['inbox:metas'],
    },
    name: 'ChatSetConvRetention',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatSetTeamRetention', {
        convs: [makeInboxUIItem(convA), makeInboxUIItem(convC)],
        teamID: 'team-id',
      }),
    expected: {
      A: ['inbox:metas', 'unboxRows:A'],
      'A+B': ['inbox:metas', 'unboxRows:A'],
      none: ['inbox:metas'],
    },
    name: 'ChatSetTeamRetention',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatParticipantsInfo', {
        participants: {
          [convIDString(convA)]: [{assertion: 'testuser', inConvName: true, type: T.RPCChat.UIParticipantType.user}],
          [convIDString(convC)]: [{assertion: 'testuser-2', inConvName: true, type: T.RPCChat.UIParticipantType.user}],
        },
      }),
    expected: {
      A: ['inbox:participants', 'unboxRows:A'],
      'A+B': ['inbox:participants', 'unboxRows:A'],
      none: ['inbox:participants'],
    },
    name: 'ChatParticipantsInfo',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatThreadsStale', {
        uid: '',
        updates: [
          {convID: rpcConvID(convA), updateType: T.RPCChat.StaleUpdateType.clear},
          {convID: rpcConvID(convA), updateType: T.RPCChat.StaleUpdateType.newactivity},
          {convID: rpcConvID(convC), updateType: T.RPCChat.StaleUpdateType.newactivity},
        ],
      }),
    expected: {
      A: [
        'forceUnboxRows:A',
        'rpc:unbox:A',
        'forceUnboxRows:A,C',
        'rpc:unbox:C',
        'rpc:loadThread:A:general',
        'inbox:metas',
        'rpc:unbox:A',
      ],
      'A+B': [
        'forceUnboxRows:A',
        'rpc:unbox:A',
        'forceUnboxRows:A,C',
        'rpc:unbox:C',
        'rpc:loadThread:A:general',
        'inbox:metas',
        'rpc:unbox:A',
      ],
      none: ['forceUnboxRows:A', 'rpc:unbox:A', 'forceUnboxRows:A,C', 'rpc:unbox:C', 'rpc:unbox:A'],
    },
    name: 'ChatThreadsStale',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatInboxSynced', {
        syncRes: {
          incremental: {
            items: [
              {conv: {...makeInboxUIItem(convA), localMetadata: null}, shouldUnbox: false},
              {conv: {...makeInboxUIItem(convC), localMetadata: null}, shouldUnbox: true},
            ],
            removals: null,
          },
          syncType: T.RPCChat.SyncInboxResType.incremental,
        },
      }),
    expected: {
      A: ['inbox:metas', 'rpc:unbox:C', 'rpc:loadThread:A:general', 'inbox:metas'],
      'A+B': ['inbox:metas', 'rpc:unbox:C', 'rpc:loadThread:A:general', 'inbox:metas'],
      none: ['inbox:metas', 'rpc:unbox:C'],
    },
    name: 'ChatInboxSynced incremental',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatTypingUpdate', {
        typingUpdates: [
          {convID: rpcConvID(convA), typers: [{deviceID: 'd', uid: 'u', username: 'testuser-mac'}]},
          {convID: rpcConvID(convB), typers: null},
        ],
      }),
    expected: {
      A: ['inbox:typing', 'thread:A:typing'],
      'A+B': ['inbox:typing', 'thread:A:typing'],
      none: ['inbox:typing'],
    },
    name: 'ChatTypingUpdate',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatSubteamRename', {
        convs: [{convID: convIDString(convA)}, {convID: convIDString(convC)}],
      }),
    expected: {
      A: ['forceUnboxRows:A,C', 'rpc:unbox:A,C'],
      'A+B': ['forceUnboxRows:A,C', 'rpc:unbox:A,C'],
      none: ['forceUnboxRows:A,C', 'rpc:unbox:A,C'],
    },
    name: 'ChatSubteamRename',
  },
  {
    action: () => engineAction('chat.1.NotifyChat.ChatTLFFinalize', {convID: rpcConvID(convA)}),
    expected: {
      A: ['unboxRows:A'],
      'A+B': ['unboxRows:A'],
      none: ['unboxRows:A'],
    },
    name: 'ChatTLFFinalize',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatPromptUnfurl', {convID: rpcConvID(convA), domain: 'example.com', msgID: 10}),
    expected: {
      A: ['thread:A:unfurlPrompt'],
      'A+B': ['thread:A:unfurlPrompt'],
      none: none,
    },
    name: 'ChatPromptUnfurl',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatRequestInfo', {
        convID: rpcConvID(convA),
        info: {
          amount: '1',
          amountDescription: '1 USD',
          asset: null,
          currency: 'USD',
          status: T.RPCStellar.RequestStatus.ok,
          worthAtRequestTime: '$1.00',
        },
        msgID: 10,
      }),
    expected: {
      A: ['thread:A:accountsInfoMap'],
      'A+B': ['thread:A:accountsInfoMap'],
      none: none,
    },
    name: 'ChatRequestInfo',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatPaymentInfo', {
        convID: rpcConvID(convA),
        info: {
          accountID: 'account-id',
          amountDescription: '1 XLM',
          delta: T.RPCStellar.BalanceDelta.none,
          fromUsername: 'testuser',
          issuerDescription: 'Lumens',
          note: '',
          paymentID: 'payment-1',
          showCancel: false,
          sourceAmount: '1',
          sourceAsset: {code: 'XLM', issuer: '', issuerName: '', verifiedDomain: ''},
          status: T.RPCStellar.PaymentStatus.completed,
          statusDescription: 'Completed',
          statusDetail: '',
          toUsername: 'testuser-mac',
          worth: '$1.00',
          worthAtSendTime: '$1.00',
        },
        msgID: 10,
      }),
    expected: {
      A: ['thread:A:accountsInfoMap,paymentStatusMap'],
      'A+B': ['thread:A:accountsInfoMap,paymentStatusMap'],
      none: none,
    },
    name: 'ChatPaymentInfo',
  },
  {
    action: () =>
      engineAction('chat.1.chatUi.chatCoinFlipStatus', {
        statuses: [convA, convB, convA].map((id, i) => ({
          commitmentVisualization: '',
          convID: convIDString(id),
          errorInfo: null,
          gameID: `flip-${i}`,
          participants: [],
          phase: T.RPCChat.UICoinFlipPhase.commitment,
          progressText: '',
          resultInfo: null,
          resultText: '',
          revealVisualization: '',
        })),
      }),
    expected: {
      A: ['thread:A:flipStatusMap'],
      'A+B': ['thread:A:flipStatusMap', 'thread:B:flipStatusMap'],
      none: none,
    },
    name: 'chatCoinFlipStatus',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatAttachmentUploadStart', {
        convID: rpcConvID(convA),
        outboxID: T.Chat.outboxIDToRpcOutboxID(T.Chat.stringToOutboxID('0c0c')),
      }),
    expected: {
      A: none,
      'A+B': none,
      none: none,
    },
    name: 'ChatAttachmentUploadStart',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatAttachmentUploadProgress', {
        bytesComplete: 5,
        bytesTotal: 10,
        convID: rpcConvID(convA),
        outboxID: T.Chat.outboxIDToRpcOutboxID(T.Chat.stringToOutboxID('0c0c')),
      }),
    expected: {
      A: none,
      'A+B': none,
      none: none,
    },
    name: 'ChatAttachmentUploadProgress',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatAttachmentDownloadProgress', {
        bytesComplete: 5,
        bytesTotal: 10,
        convID: rpcConvID(convA),
        msgID: 20,
      }),
    expected: {
      A: none,
      'A+B': none,
      none: none,
    },
    name: 'ChatAttachmentDownloadProgress',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatAttachmentDownloadComplete', {convID: rpcConvID(convA), msgID: 20}),
    expected: {
      A: ['rpc:loadThread:A:around'],
      'A+B': ['rpc:loadThread:A:around'],
      none: none,
    },
    name: 'ChatAttachmentDownloadComplete of the message a storeless consumer shows',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatAttachmentDownloadComplete', {convID: rpcConvID(convA), msgID: 10}),
    expected: {
      A: none,
      'A+B': none,
      none: none,
    },
    name: 'ChatAttachmentDownloadComplete of another message',
  },
  {
    action: () =>
      engineAction('chat.1.chatUi.chatCommandStatus', {
        actions: null,
        convID: convIDString(convA),
        displayText: 'status',
        typ: T.RPCChat.UICommandStatusDisplayTyp.status,
      }),
    expected: {
      A: ['input:A:commandStatus:status'],
      'A+B': ['input:A:commandStatus:status'],
      none: none,
    },
    name: 'chatCommandStatus',
  },
  {
    action: () =>
      engineAction('chat.1.chatUi.chatCommandMarkdown', {
        convID: convIDString(convA),
        md: {body: 'body', title: 'title'},
      }),
    expected: {
      A: ['input:A:commandMarkdown:title'],
      'A+B': ['input:A:commandMarkdown:title'],
      none: none,
    },
    name: 'chatCommandMarkdown',
  },
  {
    action: () =>
      engineAction('chat.1.chatUi.chatGiphyToggleResultWindow', {
        clearInput: false,
        convID: convIDString(convA),
        show: true,
      }),
    expected: {
      A: ['input:A:giphyWindow'],
      'A+B': ['input:A:giphyWindow'],
      none: none,
    },
    name: 'chatGiphyToggleResultWindow',
  },
  {
    action: () =>
      engineAction('chat.1.chatUi.chatGiphySearchResults', {
        convID: convIDString(convA),
        results: {galleryUrl: '', results: null},
      }),
    expected: {
      A: ['input:A:giphyResult'],
      'A+B': ['input:A:giphyResult'],
      none: none,
    },
    name: 'chatGiphySearchResults',
  },
  {
    action: () =>
      engineAction('chat.1.chatUi.chatBotCommandsUpdateStatus', {
        convID: convIDString(convA),
        status: {typ: T.RPCChat.UIBotCommandsUpdateStatusTyp.updating},
      }),
    expected: {
      A: ['botCommands:A:1'],
      'A+B': ['botCommands:A:1'],
      none: none,
    },
    name: 'chatBotCommandsUpdateStatus',
  },
  {
    action: () =>
      engineAction('chat.1.NotifyChat.ChatIdentifyUpdate', {
        update: {
          CanonicalName: 'testuser,testuser-3',
          breaks: {breaks: [{user: {username: 'testuser-3'}}]},
        },
      }),
    expected: {
      A: ['users'],
      'A+B': ['users'],
      none: ['users'],
    },
    name: 'ChatIdentifyUpdate',
  },
]

const scenarios: Array<Scenario> = ['none', 'A', 'A+B']
describe.each(cases)('$name', c => {
  test.each(scenarios)('with %s mounted', async scenario => {
    c.setup?.()
    expect(await timelineFor(scenario, c)).toEqual(c.expected[scenario])
  })
})

const typingIn = (id: T.Chat.ConversationIDKey, username: string) =>
  engineAction('chat.1.NotifyChat.ChatTypingUpdate', {
    typingUpdates: [{convID: rpcConvID(id), typers: [{deviceID: 'd', uid: 'u', username}]}],
  })

const typersIn = (tag: string) => [...(mounted.get(tag)?.store.getState().typing ?? [])]

const signIn = (uid: string, username: string) =>
  useCurrentUserState.getState().dispatch.setBootstrap({deviceID: 'device-id', deviceName: 'test-device', uid, username})

const explodingModeIn = (id: T.Chat.ConversationIDKey, seconds: number) =>
  engineAction('keybase.1.gregorUI.pushState', {
    reason: T.RPCGen.PushReason.none,
    state: {
      items: [
        {
          item: {body: new TextEncoder().encode(String(seconds)), category: `exploding:${id}`},
          md: {msgID: new Uint8Array([1])},
        },
      ],
    },
  })

// The switch as the stores see it: setUserSwitching resets every store, which empties the signed-in
// uid, and the new account's bootstrap later writes its uid and signs it in.
const startSwitch = async (username: string) => {
  act(() => {
    useConfigState.getState().dispatch.setUserSwitching(true, username)
  })
  await settle()
}
const finishSwitch = async (uid: string, username: string) => {
  act(() => {
    signIn(uid, username)
    useConfigState.getState().dispatch.setLoggedIn(true)
    convMetas()
  })
  act(() => {
    useConfigState.getState().dispatch.setUserSwitching(false)
  })
  await settle()
}

const loadThread = (tag: string, enableActiveMarkRead: boolean) => {
  const m = mounted.get(tag)
  act(() => {
    m?.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead,
      messages: [10, 20].map(n => threadText(m.id, n)),
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })
}

const staleThread = (id: T.Chat.ConversationIDKey) =>
  engineAction('chat.1.NotifyChat.ChatThreadsStale', {
    uid: '',
    updates: [{convID: rpcConvID(id), updateType: T.RPCChat.StaleUpdateType.newactivity}],
  })

describe('an account switch', () => {
  test('empties the signed-in uid from the reset until the new account signs in', async () => {
    await mountScreens([convA])
    const snapshot = () => ({
      loggedIn: useConfigState.getState().loggedIn,
      metas: useInboxMetadataState.getState().metas.size,
      uid: useCurrentUserState.getState().uid,
      userSwitching: useConfigState.getState().userSwitching,
    })
    expect(snapshot()).toEqual({loggedIn: true, metas: 3, uid: 'uid', userSwitching: false})
    await startSwitch('testuser-mac')
    expect(snapshot()).toEqual({loggedIn: false, metas: 0, uid: '', userSwitching: true})
    await finishSwitch('uid2', 'testuser-mac')
    expect(snapshot()).toEqual({loggedIn: true, metas: 3, uid: 'uid2', userSwitching: false})
  })

  // The routers keep the logged-in screens mounted through a switch, and desktop can keep the same
  // conversation selected. The screen's thread is built again for whoever signs in, the same
  // account or another, and the one built for the account before hears nothing more.
  test.each([
    ['the same account', 'uid', 'testuser'],
    ['another account', 'uid2', 'testuser-mac'],
  ])('a screen left mounted through a switch to %s is rebuilt for it', async (_, uid, username) => {
    await mountScreens([convA])
    const before = mounted.get('A')
    await startSwitch(username)
    await finishSwitch(uid, username)
    const after = mounted.get('A')
    expect(after?.store).toBeDefined()
    expect(after?.store).not.toBe(before?.store)
    loadThread('A', true)
    timeline = []

    await notify(typingIn(convA, 'testuser-2'))
    expect(typersIn('A')).toEqual(['testuser-2'])
    expect([...(before?.store.getState().typing ?? [])]).toEqual([])
    await notify(incomingMessage(convA, 31))
    expect(after?.store.getState().messageOrdinals).toContain(T.Chat.numberToOrdinal(31))
    expect(before?.store.getState().messageOrdinals).not.toContain(T.Chat.numberToOrdinal(31))
    await notify(explodingModeIn(convA, 300))
    expect(after?.store.getState().explodingMode).toBe(300)
    expect(before?.store.getState().explodingMode).toBe(0)
    act(() => {
      after?.actions.markThreadAsRead()
    })
    await settle()
    expect(timeline.filter(e => e.startsWith('rpc:markRead'))).toEqual(['rpc:markRead:A'])
    timeline = []
    await notify(staleThread(convA))
    expect(timeline.filter(e => e.startsWith('rpc:loadThread'))).toEqual(['rpc:loadThread:A:general'])
  })

  // Two accounts in one team share its channels' conversation ids. Until React rebuilds the screen,
  // its thread built for the old account must not take the new account's notifications.
  test("the old account's thread hears nothing of the new account's before it is rebuilt", async () => {
    await mountScreens([convA])
    const before = mounted.get('A')
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-mac')
      signIn('uid2', 'testuser-mac')
      useConfigState.getState().dispatch.setLoggedIn(true)
      convMetas()
      _onEngineIncoming(typingIn(convA, 'testuser-2'))
      _onEngineIncoming(explodingModeIn(convA, 300))
      _onEngineIncoming(staleThread(convA))
    })
    await settle()
    expect([...(before?.store.getState().typing ?? [])]).toEqual([])
    expect(before?.store.getState().explodingMode).toBe(0)
    expect(timeline.filter(e => e.startsWith('rpc:loadThread'))).toEqual([])
  })

  test('a screen mounted while no account is signed in starts hearing once one is', async () => {
    await startSwitch('testuser-mac')
    await mountTree(<Screen id={convA} tag="A-mid" />)
    // no thread is built for nobody
    expect(mounted.has('A-mid')).toBe(false)
    await finishSwitch('uid2', 'testuser-mac')
    loadThread('A-mid', false)
    await notify(typingIn(convA, 'testuser-2'))
    expect(typersIn('A-mid')).toEqual(['testuser-2'])
    await notify(explodingModeIn(convA, 300))
    expect(mounted.get('A-mid')?.store.getState().explodingMode).toBe(300)
  })
})

describe('mounted conversation screens', () => {
  test('two screens on the same conversation each get the thread update, in mount order', async () => {
    await mountTree(
      <>
        <Screen id={convA} tag="A1" />
        <Screen id={convA} tag="A2" />
      </>
    )
    await notify(typingIn(convA, 'testuser-mac'))
    expect(timeline).toEqual(['inbox:typing', 'thread:A1:typing', 'thread:A2:typing'])
    expect(typersIn('A1')).toEqual(['testuser-mac'])
    expect(typersIn('A2')).toEqual(['testuser-mac'])
  })

  test('a screen that unmounted gets nothing', async () => {
    const {rerender} = await mountTree(<Screens ids={[convA, convB]} />)
    rerender(<Screens ids={[convB]} />)
    await settle()
    timeline = []
    await notify(typingIn(convA, 'testuser-mac'))
    expect(timeline).toEqual(['inbox:typing'])
    expect(typersIn('A')).toEqual([])
  })

  // <Activity mode="hidden"> (what native-stack puts a covered screen in) unmounts passive
  // effects, so a hidden screen drops out of notifications and does not catch up when shown.
  test('a hidden screen misses notifications and does not catch up when shown again', async () => {
    const Tree = (p: {mode: 'hidden' | 'visible'}) => {
      const {mode} = p
      return (
        <React.Activity mode={mode}>
          <Screen id={convA} />
        </React.Activity>
      )
    }
    const {rerender} = await mountTree(<Tree mode="visible" />)
    rerender(<Tree mode="hidden" />)
    await settle()
    timeline = []
    await notify(typingIn(convA, 'testuser-mac'))
    expect(timeline).toEqual(['inbox:typing'])
    expect(typersIn('A')).toEqual([])

    rerender(<Tree mode="visible" />)
    await settle()
    expect(typersIn('A')).toEqual([])
    timeline = []
    await notify(typingIn(convA, 'testuser-2'))
    expect(timeline).toEqual(['inbox:typing', 'thread:A:typing'])
    expect(typersIn('A')).toEqual(['testuser-2'])
  })

  // Every useConversationMetadata reader arms its own reload, so one notification asks for the
  // same unbox once per reader. The in-flight check lets only the first reach the service.
  test('each metadata reader asks for an unbox; only one reaches the service', async () => {
    await mountTree(<Screen id={convA} metadataReaders={2} />, () => {
      metasReceived(
        [{...Meta.makeConversationMeta(), conversationIDKey: convA, trustedState: 'untrusted'}],
        undefined,
        {force: true}
      )
    })
    await notify(
      activity({
        activityType: T.RPCChat.ChatActivityType.expunge,
        expunge: {convID: rpcConvID(convA), expunge: {basis: 0, upto: 15}},
      })
    )
    expect(timeline.filter(e => e.startsWith('unboxRows') || e.startsWith('rpc:unbox'))).toEqual([
      'unboxRows:A',
      'rpc:unbox:A',
      'unboxRows:A',
      'unboxRows:A',
    ])
  })
})

describe('what each notification leaves behind', () => {
  test('a failed message errors the pending row in its own conversation and marks the identify break', async () => {
    await mountScreens([convA, convB], () => {
      mounted.get('A')?.actions.addMessages([pendingText(convA, '0a0a')])
      mounted.get('B')?.actions.addMessages([pendingText(convB, '0b0b')])
    })
    await notify(
      activity({
        activityType: T.RPCChat.ChatActivityType.failedMessage,
        failedMessage: {
          conv: null,
          isEphemeralPurge: false,
          outboxRecords: [
            makeFailedRecord(convA, '0a0a', {message: 'network fail', typ: T.RPCChat.OutboxErrorType.misc}),
            makeFailedRecord(convB, '0b0b', {
              message: 'identify failed for "testuser-3"',
              typ: T.RPCChat.OutboxErrorType.identify,
            }),
          ],
        },
      })
    )
    const rowIn = (tag: string) =>
      mounted.get(tag)?.store.getState().messageMap.get(T.Chat.numberToOrdinal(20.001))
    // misc is 0, which the thread stores as no error type
    expect(rowIn('A')).toMatchObject({errorReason: 'network fail', errorTyp: undefined, submitState: 'failed'})
    expect(rowIn('B')).toMatchObject({errorTyp: T.RPCChat.OutboxErrorType.identify, submitState: 'failed'})
    expect(useUsersState.getState().infoMap.get('testuser-3')?.broken).toBe(true)
  })

  test('an incoming message lands in its open thread only', async () => {
    await mountScreens([convA, convB])
    await notify(incomingMessage(convA, 31))
    expect(mounted.get('A')?.store.getState().messageOrdinals).toEqual([10, 20, 31].map(T.Chat.numberToOrdinal))
    expect(mounted.get('B')?.store.getState().messageOrdinals).toEqual([10, 20].map(T.Chat.numberToOrdinal))
  })

  test('a reaction update decorates the thread row and replaces the daemon reacjis', async () => {
    await mountScreens([convA])
    const userReacjis = {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: [{name: ':+1:'}]}
    await notify(
      activity({
        activityType: T.RPCChat.ChatActivityType.reactionUpdate,
        reactionUpdate: {
          convID: rpcConvID(convA),
          reactionUpdates: [
            {
              reactions: {reactions: {':+1:': {decorated: ':+1:', users: {'testuser-mac': {ctime: 5, reactionMsgID: 40}}}}},
              targetMsgID: 10,
            },
          ],
          userReacjis,
        },
      })
    )
    const row = mounted.get('A')?.store.getState().messageMap.get(T.Chat.numberToOrdinal(10))
    expect(row?.reactions?.get(':+1:')?.users.map(u => u.username)).toEqual(['testuser-mac'])
    expect(useDaemonState.getState().bootstrapStatus?.userReacjis).toEqual(userReacjis)
  })

  test('expunge deletes up to its message id; ephemeral purge explodes the listed messages', async () => {
    await mountScreens([convA])
    await notify(
      activity({
        activityType: T.RPCChat.ChatActivityType.expunge,
        expunge: {convID: rpcConvID(convA), expunge: {basis: 0, upto: 15}},
      })
    )
    expect(mounted.get('A')?.store.getState().messageOrdinals).toEqual([T.Chat.numberToOrdinal(20)])
    await notify(
      activity({
        activityType: T.RPCChat.ChatActivityType.ephemeralPurge,
        ephemeralPurge: {convID: rpcConvID(convA), msgs: [makeValidText(msgID(20), 'gone')]},
      })
    )
    expect(mounted.get('A')?.store.getState().messageMap.get(T.Chat.numberToOrdinal(20))).toMatchObject({
      exploded: true,
    })
  })

  test('typing sets the inbox row typers and the open thread typers', async () => {
    await mountScreens([convA, convB])
    await notify(typingIn(convA, 'testuser-mac'))
    expect([...(useInboxTypingState.getState().typing.get(convA) ?? [])]).toEqual(['testuser-mac'])
    expect(typersIn('A')).toEqual(['testuser-mac'])
    expect(typersIn('B')).toEqual([])
  })

  test('participants land in the inbox store for every conversation named', async () => {
    await mountScreens([convA])
    await notify(
      engineAction('chat.1.NotifyChat.ChatParticipantsInfo', {
        participants: {
          [convIDString(convA)]: [{assertion: 'testuser', inConvName: true, type: T.RPCChat.UIParticipantType.user}],
          [convIDString(convC)]: [{assertion: 'testuser-2', inConvName: true, type: T.RPCChat.UIParticipantType.user}],
        },
      })
    )
    const {participants} = useInboxMetadataState.getState()
    expect(participants.get(convA)?.name).toEqual(['testuser'])
    expect(participants.get(convC)?.name).toEqual(['testuser-2'])
  })
})

describe('a channel minimum writer role', () => {
  const setMinWriterRole = (minWriterRoleInfo: T.RPCChat.ConversationMinWriterRoleInfoLocal | null) =>
    engineAction('chat.1.NotifyChat.ChatSetConvSettings', {
      conv: makeInboxUIItem(convA, {convSettings: {minWriterRoleInfo}}),
      convID: rpcConvID(convA),
    })
  const writability = () => {
    const meta = useInboxMetadataState.getState().metas.get(convA)
    return {cannotWrite: meta?.cannotWrite, minWriterRole: meta?.minWriterRole}
  }

  test.each([
    ['cleared', null],
    ['set to none', {cannotWrite: false, changedBy: 'testuser-mac', role: T.RPCGen.TeamRole.none}],
  ] as const)('%s makes the channel writable again', async (_name, cleared) => {
    await notify(
      setMinWriterRole({cannotWrite: true, changedBy: 'testuser-mac', role: T.RPCGen.TeamRole.admin})
    )
    expect(writability()).toEqual({cannotWrite: true, minWriterRole: 'admin'})

    await notify(setMinWriterRole(cleared))
    expect(writability()).toEqual({cannotWrite: false, minWriterRole: 'reader'})

    await notify(
      setMinWriterRole({cannotWrite: true, changedBy: 'testuser-mac', role: T.RPCGen.TeamRole.admin})
    )
    expect(writability()).toEqual({cannotWrite: true, minWriterRole: 'admin'})
  })
})
