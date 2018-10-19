// @flow
import * as I from 'immutable'
import * as RPCTypes from './types/rpc-gen'
import type {_State} from './types/notifications'
import * as Tabs from './tabs'
import {isMobile} from './platform'
import type {TypedState} from './reducer'

export const badgeStateToBadgeCounts = (bs: RPCTypes.BadgeState, state: TypedState) => {
  const {
    homeTodoItems,
    conversations,
    newDevices,
    revokedDevices,
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
  const allDeviceChanges = I.Set((newDevices || []).concat(revokedDevices || []))
  // don't see badges related to this device
  const deviceChanges = allDeviceChanges.remove(state.config.deviceID).size
  const totalMessages = (conversations || []).reduce(
    (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${deviceType}`] : total),
    0
  )
  const totalPayments = (unreadWalletAccounts || []).reduce((total, a) => total + a.numUnread, 0)

  const newGit = (newGitRepoGlobalUniqueIDs || []).length
  const newTeams =
    (newTeamNames || []).length + (newTeamAccessRequests || []).length + (teamsWithResetUsers || []).length

  return {
    counts: I.Map([
      [Tabs.chatTab, totalMessages],
      [Tabs.gitTab, newGit],
      [Tabs.teamsTab, newTeams],
      [Tabs.peopleTab, homeTodoItems],
      [Tabs.walletsTab, totalPayments],
      [Tabs.devicesTab, deviceChanges],
    ]),
  }
}

let lastFsBadges = {newTlfs: 0, rekeysNeeded: 0}
export const shouldTriggerTlfLoad = (bs: RPCTypes.BadgeState) => {
  const {newTlfs, rekeysNeeded} = bs
  const same = newTlfs === lastFsBadges.newTlfs && rekeysNeeded === lastFsBadges.rekeysNeeded
  lastFsBadges = {newTlfs, rekeysNeeded}
  return !same
}

export const makeState: I.RecordFactory<_State> = I.Record({
  badgeVersion: -1,
  desktopAppBadgeCount: 0,
  keyState: I.Map(),
  mobileAppBadgeCount: 0,
  navBadges: I.Map(),
  widgetBadge: 'regular',
})
