/// <reference types="jest" />
import * as T from '../../constants/types'
import * as Meta from '../../constants/chat/meta'
import {resetAllStores} from '../../util/zustand'
import {useCurrentUserState} from '../current-user'
import {
  syncInboxRowBadgeState,
  syncInboxRowsFromLayout,
  syncInboxRowsFromMetaAndParticipants,
  syncInboxRowsFromMetas,
  syncInboxRowsFromParticipantMap,
  syncInboxRowsFromParticipants,
  updateInboxRowTyping,
  useInboxRowsState,
} from '../inbox-rows'

afterEach(() => {
  resetAllStores()
})

test('explicit meta and participant updates merge into the row caches', () => {
  const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })

  syncInboxRowBadgeState({
    conversations: [{badgeCount: 2, convID: T.Chat.keyToConversationID(convID), unreadMessages: 1}],
  } as T.RPCGen.BadgeState)
  updateInboxRowTyping([
    {
      convID: T.Chat.keyToConversationID(convID),
      typers: [{deviceID: 'device-id', uid: 'uid', username: 'carol'}],
    },
  ])

  syncInboxRowsFromMetaAndParticipants([
    {
      meta: {
        ...Meta.makeConversationMeta(),
        channelname: 'general',
        conversationIDKey: convID,
        draft: 'draft text',
        isMuted: false,
        rekeyers: new Set(['alice']),
        resetParticipants: new Set(['bob']),
        snippetDecorated: 'hello world',
        snippetDecoration: T.RPCChat.SnippetDecoration.pendingMessage,
        teamname: 'team#general',
        timestamp: 1234,
        trustedState: 'requesting',
      },
      participantInfo: {all: ['alice', 'bob'], contactName: new Map(), name: ['alice', 'bob']},
    },
  ])
  expect(useInboxRowsState.getState().rowsBig.get(convID)?.badgeCount).toBe(2)

  expect(useInboxRowsState.getState().rowsBig.get(convID)).toMatchObject({
    badgeCount: 2,
    channelname: 'general',
    hasBadge: true,
    hasDraft: true,
    hasUnread: true,
    snippetDecoration: T.RPCChat.SnippetDecoration.pendingMessage,
    unreadCount: 1,
  })
  expect(useInboxRowsState.getState().rowsSmall.get(convID)).toMatchObject({
    badgeCount: 2,
    draft: 'draft text',
    hasBadge: true,
    hasResetUsers: true,
    hasUnread: true,
    isDecryptingSnippet: false,
    isLocked: true,
    isMuted: false,
    participantNeedToRekey: true,
    participants: ['bob'],
    snippet: 'hello world',
    snippetDecoration: T.RPCChat.SnippetDecoration.pendingMessage,
    teamDisplayName: 'team',
    timestamp: 1234,
    typingSnippet: 'carol is typing...',
    unreadCount: 1,
    youAreReset: false,
    youNeedToRekey: true,
  })
})

test('layout and meta sync populate inbox rows without a convo store lookup', () => {
  const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })

  syncInboxRowsFromLayout({
    bigTeams: [
      {
        channel: {
          channelname: 'general',
          convID: T.Chat.conversationIDKeyToString(convID),
          draft: 'big draft',
          isMuted: false,
          teamname: 'team',
        },
        state: T.RPCChat.UIInboxBigTeamRowTyp.channel,
      },
    ],
    smallTeams: [
      {
        convID: T.Chat.conversationIDKeyToString(convID),
        draft: '',
        isMuted: true,
        isTeam: false,
        lastSendTime: 0,
        name: 'alice,bob',
        snippet: 'layout snippet',
        snippetDecoration: T.RPCChat.SnippetDecoration.none,
        time: 123,
      },
    ],
    totalSmallTeams: 1,
  })

  expect(useInboxRowsState.getState().rowsSmall.get(convID)).toMatchObject({
    isMuted: true,
    participants: ['bob'],
    snippet: 'layout snippet',
    timestamp: 123,
  })
  expect(useInboxRowsState.getState().rowsBig.get(convID)).toMatchObject({
    channelname: 'general',
    hasDraft: true,
    teamname: 'team',
  })

  syncInboxRowsFromParticipants([
    {
      convID: T.Chat.conversationIDKeyToString(convID),
      participants: [
        {assertion: 'alice', inConvName: true, type: T.RPCChat.UIParticipantType.user},
        {assertion: 'carol', inConvName: true, type: T.RPCChat.UIParticipantType.user},
      ],
    } as T.RPCChat.InboxUIItem,
  ])
  expect(useInboxRowsState.getState().rowsSmall.get(convID)?.participants).toEqual(['carol'])

  syncInboxRowsFromMetas([
    {
      ...Meta.makeConversationMeta(),
      conversationIDKey: convID,
      draft: 'meta draft',
      isMuted: false,
      snippetDecorated: 'meta snippet',
      teamname: 'meta-team',
      timestamp: 456,
      trustedState: 'trusted',
    },
  ])
  expect(useInboxRowsState.getState().rowsSmall.get(convID)).toMatchObject({
    draft: 'meta draft',
    isMuted: false,
    snippet: 'meta snippet',
    teamDisplayName: 'meta-team',
    timestamp: 456,
  })

  syncInboxRowsFromParticipantMap({
    [convID]: [
      {assertion: 'alice', inConvName: true, type: T.RPCChat.UIParticipantType.user},
      {assertion: 'dave', inConvName: true, type: T.RPCChat.UIParticipantType.user},
    ],
  })
  expect(useInboxRowsState.getState().rowsSmall.get(convID)?.participants).toEqual(['dave'])
})
