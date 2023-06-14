import * as Tabs from '../constants/tabs'
import * as EngineGen from './engine-gen-gen'
import * as NotificationsGen from './notifications-gen'
import * as FsGen from './fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import * as ConfigConstants from '../constants/config'
import logger from '../logger'
import {isMobile} from '../constants/platform'

const setupNotifications = async () => {
  try {
    await RPCTypes.notifyCtlSetNotificationsRpcPromise({
      channels: {
        allowChatNotifySkips: true,
        app: true,
        audit: true,
        badges: true,
        chat: true,
        chatattachments: true,
        chatdev: false,
        chatemoji: false,
        chatemojicross: false,
        chatkbfsedits: false,
        deviceclone: false,
        ephemeral: false,
        favorites: false,
        featuredBots: true,
        kbfs: true,
        kbfsdesktop: !isMobile,
        kbfslegacy: false,
        kbfsrequest: false,
        kbfssubscription: true,
        keyfamily: false,
        paperkeys: false,
        pgp: true,
        reachability: true,
        runtimestats: true,
        saltpack: true,
        service: true,
        session: true,
        team: true,
        teambot: false,
        tracking: true,
        users: true,
        wallet: true,
      },
    })
  } catch (error) {
    if (error != null) {
      logger.warn('error in toggling notifications: ', error)
    }
  }
}

const createBadgeState = (_: unknown, action: EngineGen.Keybase1NotifyBadgesBadgeStatePayload) =>
  NotificationsGen.createReceivedBadgeState({badgeState: action.payload.params.badgeState})

const badgeStateToBadgeCounts = (state: Container.TypedState, bs: RPCTypes.BadgeState) => {
  const {inboxVers, unverifiedEmails, unverifiedPhones} = bs
  const deletedTeams = bs.deletedTeams ?? []
  const newDevices = bs.newDevices ?? []
  const newGitRepoGlobalUniqueIDs = bs.newGitRepoGlobalUniqueIDs ?? []
  const newTeamAccessRequestCount = bs.newTeamAccessRequestCount ?? 0
  const newTeams = bs.newTeams ?? []
  const revokedDevices = bs.revokedDevices ?? []
  const teamsWithResetUsers = bs.teamsWithResetUsers ?? []
  const unreadWalletAccounts = bs.unreadWalletAccounts ?? []
  const wotUpdates = bs.wotUpdates ?? new Map<string, RPCTypes.WotUpdate>()

  if (state.notifications.badgeVersion >= inboxVers) {
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
  counts.set(
    Tabs.walletsTab,
    unreadWalletAccounts.reduce<number>((total, a) => total + a.numUnread, 0)
  )
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

const receivedBadgeState = (
  state: Container.TypedState,
  action: NotificationsGen.ReceivedBadgeStatePayload
) => {
  const counts = badgeStateToBadgeCounts(state, action.payload.badgeState)
  return [
    counts && NotificationsGen.createSetBadgeCounts({counts}),
    !isMobile && shouldTriggerTlfLoad(action.payload.badgeState) && FsGen.createFavoritesLoad(),
  ]
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
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  Container.listenAction(EngineGen.keybase1NotifyAuditRootAuditError, receivedRootAuditError)
  Container.listenAction(EngineGen.keybase1NotifyAuditBoxAuditError, receivedBoxAuditError)
  Container.listenAction(EngineGen.connected, setupNotifications)
  Container.listenAction(EngineGen.keybase1NotifyBadgesBadgeState, createBadgeState)
}

export default initNotifications
