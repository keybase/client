/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, renderHook} from '@testing-library/react'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'
import {getBotsAndParticipants} from '@/constants/chat/helpers'
import {makeConversationMeta} from '@/constants/chat/meta'
import {handleConvoEngineIncoming} from './engine'
import {participantInfoReceived, useInboxMetadataState} from './metadata'
import {
  refreshConversationParticipants,
  useRefreshParticipantsOnTeamMembershipChange,
} from './refresh-participants'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))
const teamID = 'team-1' as T.Teams.TeamID
const otherTeamID = 'team-2' as T.Teams.TeamID

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

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('refreshConversationParticipants', () => {
  test('asks the service to recompute participants for each conversation', async () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

    await refreshConversationParticipants([convA, convB])

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledTimes(2)
    expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({
      convID: T.Chat.keyToConversationID(convA),
    })
    expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({
      convID: T.Chat.keyToConversationID(convB),
    })
  })

  test('a conversation named twice is refreshed once', async () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

    await refreshConversationParticipants([convA, convA, convB, convA])

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledTimes(2)
  })

  // these are not conversations, so they must be dropped before the attempt rather than
  // failing their way through it
  test('placeholder conversation ids are never sent to the service', async () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(logger, 'info').mockImplementation(() => {})

    await refreshConversationParticipants([
      T.Chat.noConversationIDKey,
      T.Chat.pendingWaitingConversationIDKey,
      T.Chat.pendingErrorConversationIDKey,
    ])

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })

  test('nothing to refresh resolves without an rpc', async () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

    await expect(refreshConversationParticipants([])).resolves.toBeUndefined()
    expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
  })

  test('one conversation failing neither rejects nor skips the others', async () => {
    jest
      .spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise')
      .mockImplementation(async ({convID}) => {
        await Promise.resolve()
        if (T.Chat.conversationIDToKey(convID) === convA) {
          throw new Error('offline')
        }
      })

    await expect(refreshConversationParticipants([convA, convB])).resolves.toBeUndefined()
    expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledTimes(2)
  })
})

describe('useRefreshParticipantsOnTeamMembershipChange', () => {
  test('a membership change in this team refreshes the conversation', () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    notifyEngineActionListeners(teamChangedByID())

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({
      convID: T.Chat.keyToConversationID(convA),
    })
  })

  // teamChangedByID also fires for every message sent in the team; refreshing on those
  // would be one participant rpc per message for as long as the list is open
  test('a team change that did not touch membership is ignored', () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    notifyEngineActionListeners(teamChangedByID({changes: {...noChanges, misc: true}}))
    notifyEngineActionListeners(teamChangedByID({changes: {...noChanges, keyRotated: true}}))
    notifyEngineActionListeners(teamChangedByID({changes: {...noChanges, renamed: true}}))

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
  })

  test('a membership change in another team is ignored', () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    notifyEngineActionListeners(teamChangedByID({teamID: otherTeamID}))

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
  })

  test('a disabled watcher does not refresh', () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA, false))

    notifyEngineActionListeners(teamChangedByID())

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
  })

  test('an adhoc conversation has no team to watch', () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    renderHook(() => useRefreshParticipantsOnTeamMembershipChange(T.Teams.noTeamID, convA))

    notifyEngineActionListeners(teamChangedByID({teamID: T.Teams.noTeamID}))

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
  })

  test('an unmounted list stops refreshing', () => {
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    const {unmount} = renderHook(() => useRefreshParticipantsOnTeamMembershipChange(teamID, convA))

    unmount()
    notifyEngineActionListeners(teamChangedByID())

    expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
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
    handleConvoEngineIncoming({
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
