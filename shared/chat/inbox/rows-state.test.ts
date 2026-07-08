/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {metasReceived, participantInfoReceived} from './metadata'
import {syncInboxBadgeState} from './badge-state'
import {updateInboxTyping} from './typing-state'
import {useInboxLayoutState} from './layout-state'
import {useInboxRowBig, useInboxRowSmall} from './rows-state'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const setLayout = (layout: Partial<T.RPCChat.UIInboxLayout>) => {
  useInboxLayoutState.getState().dispatch.updateLayout(
    JSON.stringify({bigTeams: null, smallTeams: null, totalSmallTeams: 0, ...layout})
  )
}

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('meta, participant, badge and typing stores merge into the computed small/big rows', () => {
  act(() => {
    syncInboxBadgeState({
      conversations: [{badgeCount: 2, convID: T.Chat.keyToConversationID(convID), unreadMessages: 1}],
    } as unknown as T.RPCGen.BadgeState)
    updateInboxTyping([
      {
        convID: T.Chat.keyToConversationID(convID),
        typers: [{deviceID: 'device-id', uid: 'uid', username: 'carol'}],
      },
    ] as ReadonlyArray<T.RPCChat.ConvTypingUpdate>)
    metasReceived([
      {
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
    ])
    participantInfoReceived(convID, {all: ['alice', 'bob'], contactName: new Map(), name: ['alice', 'bob']})
  })

  const {result: small} = renderHook(() => useInboxRowSmall(convID))
  expect(small.current).toMatchObject({
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

  const {result: big} = renderHook(() => useInboxRowBig(convID))
  expect(big.current).toMatchObject({
    badgeCount: 2,
    channelname: 'general',
    hasBadge: true,
    hasDraft: true,
    hasUnread: true,
    snippetDecoration: T.RPCChat.SnippetDecoration.pendingMessage,
    unreadCount: 1,
  })
})

test('layout fills gaps until a trusted meta wins; participant store overrides name-split', () => {
  const {result: small} = renderHook(() => useInboxRowSmall(convID))
  const {result: big} = renderHook(() => useInboxRowBig(convID))

  // layout only: untrusted, so the layout row supplies snippet/time/muted/participants
  act(() => {
    setLayout({
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
  })
  expect(small.current).toMatchObject({
    isMuted: true,
    participants: ['bob'],
    snippet: 'layout snippet',
    timestamp: 123,
  })
  expect(big.current).toMatchObject({channelname: 'general', hasDraft: true, teamname: 'team'})

  // participant store wins over the layout name-split
  act(() => {
    participantInfoReceived(convID, {all: ['alice', 'carol'], contactName: new Map(), name: ['alice', 'carol']})
  })
  expect(small.current.participants).toEqual(['carol'])

  // a trusted meta takes precedence over the layout row for the gap fields
  act(() => {
    metasReceived([
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
  })
  expect(small.current).toMatchObject({
    draft: 'meta draft',
    isMuted: false,
    snippet: 'meta snippet',
    teamDisplayName: 'meta-team',
    timestamp: 456,
  })

  // later participant updates still flow through
  act(() => {
    participantInfoReceived(convID, {all: ['alice', 'dave'], contactName: new Map(), name: ['alice', 'dave']})
  })
  expect(small.current.participants).toEqual(['dave'])
})
