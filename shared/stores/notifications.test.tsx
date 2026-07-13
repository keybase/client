/// <reference types="jest" />
import type * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useNotifState} from './notifications'
import type * as EngineGen from '@/constants/rpc'

const makeBadgeState = (p: Partial<T.RPCGen.BadgeState>): T.RPCGen.BadgeState =>
  ({
    bigTeamBadgeCount: 0,
    conversations: [],
    deletedTeams: [],
    homeTodoItems: 0,
    inboxVers: 1,
    newDevices: [],
    newGitRepoGlobalUniqueIDs: [],
    newTeamAccessRequestCount: 0,
    newTeams: [],
    resetState: {active: false, endTime: 0},
    revokedDevices: [],
    smallTeamBadgeCount: 0,
    teamsWithResetUsers: [],
    unreadWalletAccounts: [],
    unverifiedEmails: 0,
    unverifiedPhones: 0,
    ...p,
  }) as unknown as T.RPCGen.BadgeState

const badgeAction = (badgeState: T.RPCGen.BadgeState) =>
  ({
    payload: {params: {badgeState}},
    type: 'keybase.1.NotifyBadges.badgeState',
  }) as unknown as EngineGen.Actions

const gregorAction = (items: Array<{category: string; body: string}>) =>
  ({
    payload: {
      params: {
        state: {
          items: items.map(({category, body}) => ({
            item: {body: new TextEncoder().encode(body), category},
            md: {},
          })),
        },
      },
    },
    type: 'keybase.1.gregorUI.pushState',
  }) as unknown as EngineGen.Actions

describe('notifications store identity stability', () => {
  beforeEach(() => {
    resetAllStores()
  })

  it('keeps team map identities stable across badgeStates with unchanged team data', () => {
    const dispatch = useNotifState.getState().dispatch
    dispatch.onEngineIncomingImpl(
      badgeAction(
        makeBadgeState({
          inboxVers: 10,
          newTeams: ['teamA'],
          smallTeamBadgeCount: 1,
          teamsWithResetUsers: [{teamID: 'teamA', username: 'testuser'}] as never,
        })
      )
    )
    const before = useNotifState.getState()
    expect(before.newTeams.has('teamA')).toBe(true)
    expect(before.navBadges.get('tabs.chatTab' as never) ?? 0).toBeGreaterThanOrEqual(0)

    // same team data, only chat badge count moved (an incoming message)
    dispatch.onEngineIncomingImpl(
      badgeAction(
        makeBadgeState({
          inboxVers: 11,
          newTeams: ['teamA'],
          smallTeamBadgeCount: 2,
          teamsWithResetUsers: [{teamID: 'teamA', username: 'testuser'}] as never,
        })
      )
    )
    const after = useNotifState.getState()
    expect(after.newTeams).toBe(before.newTeams)
    expect(after.deletedTeams).toBe(before.deletedTeams)
    expect(after.teamIDToResetUsers).toBe(before.teamIDToResetUsers)
    // navBadges legitimately changed
    expect(after.navBadges).not.toBe(before.navBadges)
  })

  it('keeps newTeamRequests identity stable across equal gregor pushStates', () => {
    const dispatch = useNotifState.getState().dispatch
    dispatch.onEngineIncomingImpl(
      gregorAction([
        {body: JSON.stringify({id: 'teamA', username: 'testuser'}), category: 'team.request_access:teamA'},
      ])
    )
    const before = useNotifState.getState().newTeamRequests
    expect(before.get('teamA' as never)?.has('testuser')).toBe(true)

    dispatch.onEngineIncomingImpl(
      gregorAction([
        {body: JSON.stringify({id: 'teamA', username: 'testuser'}), category: 'team.request_access:teamA'},
      ])
    )
    expect(useNotifState.getState().newTeamRequests).toBe(before)
  })
})
