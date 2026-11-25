/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, renderHook} from '@testing-library/react'
import {_onEngineIncoming} from '@/constants/init/shared'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'
import {getBotsAndParticipants} from '@/constants/chat/helpers'
import {makeConversationMeta} from '@/constants/chat/meta'
import {routeChatNotification} from '@/chat/notification-router'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {pushTeamChanged} from '@/test/team-changed'
import {paramsOf} from '@/test/fake-thread-load'
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

beforeEach(() => {
  fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
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

    await pushTeamChanged(fake, teamID, {membership: true})

    expect(refreshes()).toContainEqual([convA])
  })

  test('a team change that did not touch membership is ignored', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    await pushTeamChanged(fake, teamID, {
      channels: true,
      keyRotated: true,
      memberCount: true,
      renamed: true,
      roles: true,
      settings: true,
    })

    expect(refreshes()).toEqual([])
  })

  test('a membership change in another team is ignored', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    await pushTeamChanged(fake, otherTeamID, {membership: true})

    expect(refreshes()).toEqual([])
  })

  test('a disabled watcher does not refresh', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA, false))

    await pushTeamChanged(fake, teamID, {membership: true})

    expect(refreshes()).toEqual([])
  })

  test('an adhoc conversation has no team to watch', async () => {
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(T.Teams.noTeamID, convA))

    await pushTeamChanged(fake, T.Teams.noTeamID, {membership: true})

    expect(refreshes()).toEqual([])
  })

  test('an unmounted list stops refreshing', async () => {
    const {unmount} = renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    unmount()
    await pushTeamChanged(fake, teamID, {membership: true})

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
