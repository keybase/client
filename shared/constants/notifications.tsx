import * as RPCTypes from './types/rpc-gen'
import * as Tabs from './tabs'
import * as Container from '../util/container'

export const badgeStateToBadgeCounts = (state: Container.TypedState, bs: RPCTypes.BadgeState) => {
  const {inboxVers, unverifiedEmails, unverifiedPhones} = bs
  const conversations = bs.conversations || []
  const deletedTeams = bs.deletedTeams || []
  const newDevices = bs.newDevices || []
  const newGitRepoGlobalUniqueIDs = bs.newGitRepoGlobalUniqueIDs || []
  const newTeamAccessRequests = bs.newTeamAccessRequests || []
  const newTeams = bs.newTeams || []
  const revokedDevices = bs.revokedDevices || []
  const teamsWithResetUsers = bs.teamsWithResetUsers || []
  const unreadWalletAccounts = bs.unreadWalletAccounts || []

  if (state.notifications.badgeVersion >= inboxVers) {
    return undefined
  }

  const deviceType = String(Container.isMobile ? RPCTypes.DeviceType.mobile : RPCTypes.DeviceType.desktop)
  const counts = new Map<Tabs.Tab, number>()

  counts.set(Tabs.peopleTab, bs.homeTodoItems)

  const allDeviceChanges = new Set(newDevices)
  newDevices.forEach(d => allDeviceChanges.add(d))
  revokedDevices.forEach(d => allDeviceChanges.add(d))

  // don't see badges related to this device
  counts.set(Tabs.devicesTab, allDeviceChanges.size - (allDeviceChanges.has(state.config.deviceID) ? 1 : 0))
  counts.set(
    Tabs.chatTab,
    conversations.reduce<number>((total, c) => (c.badgeCounts ? total + c.badgeCounts[deviceType] : total), 0)
  )
  counts.set(
    Tabs.walletsTab,
    unreadWalletAccounts.reduce<number>((total, a) => total + a.numUnread, 0)
  )
  counts.set(Tabs.gitTab, newGitRepoGlobalUniqueIDs.length)
  counts.set(
    Tabs.teamsTab,
    newTeams.length + newTeamAccessRequests.length + teamsWithResetUsers.length + deletedTeams.length
  )
  counts.set(Tabs.settingsTab, unverifiedEmails + unverifiedPhones)

  return counts
}

let lastFsBadges = {newTlfs: 0, rekeysNeeded: 0}
export const shouldTriggerTlfLoad = (bs: RPCTypes.BadgeState) => {
  const {newTlfs, rekeysNeeded} = bs
  const same = newTlfs === lastFsBadges.newTlfs && rekeysNeeded === lastFsBadges.rekeysNeeded
  lastFsBadges = {newTlfs, rekeysNeeded}
  return !same
}
