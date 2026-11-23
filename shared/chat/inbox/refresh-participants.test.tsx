/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, renderHook} from '@testing-library/react'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'
import {getBotsAndParticipants} from '@/constants/chat/helpers'
import {makeConversationMeta} from '@/constants/chat/meta'
import {routeChatNotification} from '@/chat/notification-router'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {participantInfoReceived, useInboxMetadataState} from './metadata'
import {
  refreshConversationParticipants,
  useRefreshParticipantsOnTeamMembershipChange,
} from './refresh-participants'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))
const teamID = 'team-1' as T.Teams.TeamID
const otherTeamID = 'team-2' as T.Teams.TeamID

const refreshParticipants = 'chat.1.local.refreshParticipants'
let fake: FakeEngine
// the conversation of each refresh the service received
const refreshes = () =>
  paramsOf(fake, refreshParticipants).map((p: {convID: Uint8Array}) => [T.Chat.conversationIDToKey(p.convID)])

const noChanges = {keyRotated: false, membershipChanged: false, misc: false, renamed: false}

const teamChangedByID = (
  params: Partial<{
    changes: typeof noChanges
    teamID: T.Teams.TeamID
  }> = {}
) =>
  ({
    payload: {
      params: {
        changes: params.changes ?? {...noChanges, membershipChanged: true},
        implicitTeam: false,
        latestHiddenSeqno: 0,
        latestOffchainSeqno: 0,
        latestSeqno: 1,
        source: 0,
        teamID: params.teamID ?? teamID,
      },
    },
    type: 'keybase.1.NotifyTeam.teamChangedByID',
  }) as never

beforeEach(() => {
  fake = installFakeEngine()
  fake.answer(refreshParticipants, () => {})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('refreshConversationParticipants', () => {
  test('asks the service to recompute participants for each conversation', async () => {
    await refreshConversationParticipants([convA, convB])

    expect(refreshes()).toHaveLength(2)
    expect(refreshes()).toContainEqual([convA])
    expect(refreshes()).toContainEqual([convB])
  })

  test('a conversation named twice is refreshed once', async () => {
    await refreshConversationParticipants([convA, convA, convB, convA])

    expect(refreshes()).toHaveLength(2)
  })

  // these are not conversations, so they must be dropped before the attempt rather than
  // failing their way through it
  test('placeholder conversation ids are never sent to the service', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => {})

    await refreshConversationParticipants([
      T.Chat.noConversationIDKey,
      T.Chat.pendingWaitingConversationIDKey,
      T.Chat.pendingErrorConversationIDKey,
    ])

    expect(refreshes()).toEqual([])
    expect(logger.info).not.toHaveBeenCalled()
  })

  test('nothing to refresh resolves without an rpc', async () => {
    await expect(refreshConversationParticipants([])).resolves.toBeUndefined()
    expect(refreshes()).toEqual([])
  })

  test('one conversation failing neither rejects nor skips the others', async () => {
    fake.answer(refreshParticipants, (p: {convID: Uint8Array}) =>
      T.Chat.conversationIDToKey(p.convID) === convA ? fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline') : {}
    )
    jest.spyOn(logger, 'info').mockImplementation(() => {})

    await expect(refreshConversationParticipants([convA, convB])).resolves.toBeUndefined()
    expect(refreshes()).toHaveLength(2)
  })
})

describe('useRefreshParticipantsOnTeamMembershipChange', () => {
  test('a membership change in this team refreshes the conversation', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    notifyEngineActionListeners(teamChangedByID())
    await flush()

    expect(refreshes()).toContainEqual([convA])
  })

  // teamChangedByID also fires for every message sent in the team; refreshing on those
  // would be one participant rpc per message for as long as the list is open
  test('a team change that did not touch membership is ignored', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    notifyEngineActionListeners(teamChangedByID({changes: {...noChanges, misc: true}}))
    notifyEngineActionListeners(teamChangedByID({changes: {...noChanges, keyRotated: true}}))
    notifyEngineActionListeners(teamChangedByID({changes: {...noChanges, renamed: true}}))
    await flush()

    expect(refreshes()).toEqual([])
  })

  test('a membership change in another team is ignored', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    notifyEngineActionListeners(teamChangedByID({teamID: otherTeamID}))
    await flush()

    expect(refreshes()).toEqual([])
  })

  test('a disabled watcher does not refresh', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA, false))

    notifyEngineActionListeners(teamChangedByID())
    await flush()

    expect(refreshes()).toEqual([])
  })

  test('an adhoc conversation has no team to watch', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(T.Teams.noTeamID, convA))

    notifyEngineActionListeners(teamChangedByID({teamID: T.Teams.noTeamID}))
    await flush()

    expect(refreshes()).toEqual([])
  })

  test('an unmounted list stops refreshing', async () => {
    const {unmount} = renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    unmount()
    notifyEngineActionListeners(teamChangedByID())
    await flush()

    expect(refreshes()).toEqual([])
  })
})

// The whole point of the refresh: the service answers it with a ChatParticipantsInfo
// notification, and that is what puts the new member on screen.
describe('the refresh reaching the members list', () => {
  const teamMeta = {
    ...makeConversationMeta(),
    channelname: 'random',
    conversationIDKey: convA,
    teamID,
    teamType: 'big' as const,
    teamname: 'acme',
  }
  const teamMembers = new Map<string, T.Teams.MemberInfo>([
    ['testuser', {fullName: '', needsPUK: false, status: 'active', type: 'writer', username: 'testuser'}],
    [
      'testuser-mac',
      {fullName: '', needsPUK: false, status: 'active', type: 'writer', username: 'testuser-mac'},
    ],
  ])

  const deliverParticipants = (usernames: ReadonlyArray<string>) => {
    routeChatNotification({
      payload: {
        params: {
          participants: {
            [T.Chat.conversationIDKeyToString(convA)]: usernames.map(assertion => ({
              assertion,
              inConvName: false,
              type: T.RPCChat.UIParticipantType.user,
            })),
          },
        },
      },
      type: 'chat.1.NotifyChat.ChatParticipantsInfo',
    } as never)
  }

  const currentMembers = () =>
    getBotsAndParticipants(
      teamMeta,
      useInboxMetadataState.getState().participants.get(convA) ?? {
        all: [],
        contactName: new Map(),
        name: [],
      },
      teamMembers
    ).participants

  test('a member added while the list is open shows up once the notification lands', () => {
    participantInfoReceived(convA, {all: ['testuser'], contactName: new Map(), name: []})
    expect(currentMembers()).toEqual(['testuser'])

    deliverParticipants(['testuser', 'testuser-mac'])

    expect(currentMembers()).toEqual(['testuser', 'testuser-mac'])
  })

  test('a member removed while the list is open disappears once the notification lands', () => {
    participantInfoReceived(convA, {all: ['testuser', 'testuser-mac'], contactName: new Map(), name: []})

    deliverParticipants(['testuser'])

    expect(currentMembers()).toEqual(['testuser'])
  })
})

describe('refreshConversationParticipants failures', () => {
  test('a failed refresh is logged at info with the conversation id', async () => {
    fake.answer(refreshParticipants, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error')

    await refreshConversationParticipants([convA])

    expect(refreshes()).toContainEqual([convA])
    expect(info).toHaveBeenCalledWith(`refreshConversationParticipants: failed for ${convA}`)
    expect(error).not.toHaveBeenCalled()
  })
})
