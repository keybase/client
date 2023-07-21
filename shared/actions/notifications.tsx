import * as Tabs from '../constants/tabs'
import * as EngineGen from './engine-gen-gen'
import * as FsConstants from '../constants/fs'
import * as Container from '../util/container'
import * as ConfigConstants from '../constants/config'
import * as Constants from '../constants/notifications'
import type * as RPCTypes from '../constants/types/rpc-gen'
import {isMobile} from '../constants/platform'

const badgeStateToBadgeCounts = (bs: RPCTypes.BadgeState) => {
  const {inboxVers, unverifiedEmails, unverifiedPhones} = bs
  const deletedTeams = bs.deletedTeams ?? []
  const newDevices = bs.newDevices ?? []
  const newGitRepoGlobalUniqueIDs = bs.newGitRepoGlobalUniqueIDs ?? []
  const newTeamAccessRequestCount = bs.newTeamAccessRequestCount ?? 0
  const newTeams = bs.newTeams ?? []
  const revokedDevices = bs.revokedDevices ?? []
  const teamsWithResetUsers = bs.teamsWithResetUsers ?? []
  const wotUpdates = bs.wotUpdates ?? new Map<string, RPCTypes.WotUpdate>()

  if (Constants.useState.getState().badgeVersion >= inboxVers) {
    return undefined
  }

  const counts = new Map<Tabs.Tab, number>()

  counts.set(Tabs.peopleTab, bs.homeTodoItems + Object.keys(wotUpdates).length)

  const allDeviceChanges = new Set(newDevices)
  newDevices.forEach(d => allDeviceChanges.add(d))
  revokedDevices.forEach(d => allDeviceChanges.add(d))

  // don't see badges related to this device
  const deviceID = ConfigConstants.useCurrentUserState.getState().deviceID
  counts.set(Tabs.devicesTab, allDeviceChanges.size - (allDeviceChanges.has(deviceID) ? 1 : 0))
  counts.set(Tabs.chatTab, bs.smallTeamBadgeCount + bs.bigTeamBadgeCount)
  counts.set(Tabs.gitTab, newGitRepoGlobalUniqueIDs.length)
  counts.set(
    Tabs.teamsTab,
    newTeams.length + newTeamAccessRequestCount + teamsWithResetUsers.length + deletedTeams.length
  )
  counts.set(Tabs.settingsTab, unverifiedEmails + unverifiedPhones)

  return counts
}

let lastFsBadges = {newTlfs: 0, rekeysNeeded: 0}
const shouldTriggerTlfLoad = (bs: RPCTypes.BadgeState) => {
  const {newTlfs, rekeysNeeded} = bs
  const same = newTlfs === lastFsBadges.newTlfs && rekeysNeeded === lastFsBadges.rekeysNeeded
  lastFsBadges = {newTlfs, rekeysNeeded}
  return !same
}

const receivedRootAuditError = (_: unknown, action: EngineGen.Keybase1NotifyAuditRootAuditErrorPayload) => {
  ConfigConstants.useConfigState
    .getState()
    .dispatch.setGlobalError(
      new Error(`Keybase is buggy, please report this: ${action.payload.params.message}`)
    )
}

const receivedBoxAuditError = (_: unknown, action: EngineGen.Keybase1NotifyAuditBoxAuditErrorPayload) => {
  ConfigConstants.useConfigState
    .getState()
    .dispatch.setGlobalError(
      new Error(
        `Keybase had a problem loading a team, please report this with \`keybase log send\`: ${action.payload.params.message}`
      )
    )
}

const initNotifications = () => {
  Container.listenAction(EngineGen.keybase1NotifyAuditRootAuditError, receivedRootAuditError)
  Container.listenAction(EngineGen.keybase1NotifyAuditBoxAuditError, receivedBoxAuditError)
  Container.listenAction(EngineGen.keybase1NotifyBadgesBadgeState, (_, action) => {
    const badgeState = action.payload.params.badgeState
    ConfigConstants.useConfigState.getState().dispatch.setBadgeState(badgeState)

    const counts = badgeStateToBadgeCounts(badgeState)
    if (!isMobile && shouldTriggerTlfLoad(badgeState)) {
      FsConstants.useState.getState().dispatch.favoritesLoad()
    }
    if (counts) {
      Constants.useState.getState().dispatch.setBadgeCounts(counts)
    }
  })
}

export default initNotifications
