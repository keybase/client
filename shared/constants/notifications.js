// @flow
import * as I from 'immutable'
import * as RPCTypes from './types/rpc-gen'
import type {_State} from './types/notifications'
import * as Tabs from './tabs'
import {isMobile} from './platform'
import type {TypedState} from './reducer'

export const badgeStateToBadges = (bs: RPCTypes.BadgeState, state: TypedState) => {
  const {
    homeTodoItems,
    conversations,
    newTlfs,
    rekeysNeeded,
    newGitRepoGlobalUniqueIDs,
    newTeamNames,
    newTeamAccessRequests,
    teamsWithResetUsers,
    inboxVers,
    unreadWalletAccounts,
  } = bs

  if (state.notifications.badgeVersion >= inboxVers) {
    return null
  }

  const deviceType = isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop
  const totalMessages = (conversations || []).reduce(
    (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${deviceType}`] : total),
    0
  )
  const totalPayments = (unreadWalletAccounts || []).reduce((total, a) => total + a.numUnread, 0)

  const newGit = (newGitRepoGlobalUniqueIDs || []).length
  const newTeams =
    (newTeamNames || []).length + (newTeamAccessRequests || []).length + (teamsWithResetUsers || []).length

  const navBadges = I.Map([
    [Tabs.chatTab, totalMessages],
    [Tabs.folderTab, newTlfs + rekeysNeeded],
    [Tabs.fsTab, newTlfs + rekeysNeeded],
    [Tabs.gitTab, newGit],
    [Tabs.teamsTab, newTeams],
    [Tabs.peopleTab, homeTodoItems],
    [Tabs.walletsTab, totalPayments],
  ])

  return {
    desktopAppBadgeCount: navBadges.reduce((total, val) => total + val, 0),
    mobileAppBadgeCount: totalMessages,
    navBadges,
  }
}

export const makeState: I.RecordFactory<_State> = I.Record({
  badgeVersion: -1,
  desktopAppBadgeCount: 0,
  keyState: I.Map(),
  mobileAppBadgeCount: 0,
  navBadges: I.Map(),
  widgetBadge: 'regular',
})
