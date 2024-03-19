import * as C from '.'
import * as Z from '@/util/zustand'
import * as EngineGen from '../actions/engine-gen-gen'
import * as T from './types'
import {isMobile} from './platform'
import logger from '@/logger'
import isEqual from 'lodash/isEqual'
import * as Tabs from './tabs'

export type BadgeType = 'regular' | 'update' | 'error' | 'uploading'
export type NotificationKeys = 'kbfsUploading' | 'outOfSpace'

type Store = T.Immutable<{
  badgeVersion: number
  desktopAppBadgeCount: number
  keyState: Map<NotificationKeys, boolean>
  mobileAppBadgeCount: number
  navBadges: Map<Tabs.Tab, number>
  widgetBadge: BadgeType
}>
const initialStore: Store = {
  badgeVersion: -1,
  desktopAppBadgeCount: 0,
  keyState: new Map(),
  mobileAppBadgeCount: 0,
  navBadges: new Map(),
  widgetBadge: 'regular',
}

type State = Store & {
  dispatch: {
    onEngineConnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: 'default'
    badgeApp: (key: NotificationKeys, on: boolean) => void
    setBadgeCounts: (counts: Map<Tabs.Tab, number>) => void
  }
}

let lastFsBadges = {newTlfs: 0, rekeysNeeded: 0}
const shouldTriggerTlfLoad = (bs: T.RPCGen.BadgeState) => {
  const {newTlfs, rekeysNeeded} = bs
  const same = newTlfs === lastFsBadges.newTlfs && rekeysNeeded === lastFsBadges.rekeysNeeded
  lastFsBadges = {newTlfs, rekeysNeeded}
  return !same
}

const badgeStateToBadgeCounts = (bs: T.RPCGen.BadgeState) => {
  const {inboxVers, unverifiedEmails, unverifiedPhones} = bs
  const deletedTeams = bs.deletedTeams ?? []
  const newDevices = bs.newDevices ?? []
  const newGitRepoGlobalUniqueIDs = bs.newGitRepoGlobalUniqueIDs ?? []
  const newTeamAccessRequestCount = bs.newTeamAccessRequestCount
  const newTeams = bs.newTeams ?? []
  const revokedDevices = bs.revokedDevices ?? []
  const teamsWithResetUsers = bs.teamsWithResetUsers ?? []
  const wotUpdates = /*bs.wotUpdates ?? */ new Map<string, T.RPCGen.WotUpdate>()

  if (_useState.getState().badgeVersion >= inboxVers) {
    return undefined
  }

  const counts = new Map<Tabs.Tab, number>()

  counts.set(Tabs.peopleTab, bs.homeTodoItems + Object.keys(wotUpdates).length)

  const allDeviceChanges = new Set(newDevices)
  newDevices.forEach(d => allDeviceChanges.add(d))
  revokedDevices.forEach(d => allDeviceChanges.add(d))

  // don't see badges related to this device
  const deviceID = C.useCurrentUserState.getState().deviceID
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
export const _useState = Z.createZustand<State>((set, get) => {
  const updateWidgetBadge = (s: Z.WritableDraft<State>) => {
    let widgetBadge: BadgeType = 'regular'
    const {keyState} = s
    if (keyState.get('outOfSpace')) {
      widgetBadge = 'error'
    } else if (keyState.get('kbfsUploading')) {
      widgetBadge = 'uploading'
    }
    s.widgetBadge = widgetBadge
  }

  const dispatch: State['dispatch'] = {
    badgeApp: (key, on) => {
      set(s => {
        const {keyState} = s
        keyState.set(key, on)
        updateWidgetBadge(s)
      })
    },
    onEngineConnected: () => {
      const f = async () => {
        try {
          await T.RPCGen.notifyCtlSetNotificationsRpcPromise({
            channels: {
              allowChatNotifySkips: true,
              app: true,
              audit: true,
              badges: true,
              chat: true,
              chatarchive: true,
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
              notifysimplefs: true,
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
              wallet: false,
            },
          })
        } catch (error) {
          if (error) {
            logger.warn('error in toggling notifications: ', error)
          }
        }
      }
      C.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyAuditRootAuditError:
          C.useConfigState
            .getState()
            .dispatch.setGlobalError(
              new Error(`Keybase is buggy, please report this: ${action.payload.params.message}`)
            )

          break
        case EngineGen.keybase1NotifyAuditBoxAuditError:
          C.useConfigState
            .getState()
            .dispatch.setGlobalError(
              new Error(
                `Keybase had a problem loading a team, please report this with \`keybase log send\`: ${action.payload.params.message}`
              )
            )
          break
        case EngineGen.keybase1NotifyBadgesBadgeState: {
          const badgeState = action.payload.params.badgeState
          C.useConfigState.getState().dispatch.setBadgeState(badgeState)

          const counts = badgeStateToBadgeCounts(badgeState)
          if (!isMobile && shouldTriggerTlfLoad(badgeState)) {
            C.useFSState.getState().dispatch.favoritesLoad()
          }
          if (counts) {
            get().dispatch.setBadgeCounts(counts)
          }
          break
        }
        default:
      }
    },
    resetState: 'default',
    setBadgeCounts: counts => {
      set(s => {
        const chatCount = counts.get(Tabs.chatTab)
        if (chatCount) {
          s.mobileAppBadgeCount = chatCount
        }

        // desktopAppBadgeCount is the sum of badge counts on all tabs. What
        // happens here is for each tab we deduct the old count from the
        // current desktopAppBadgeCount, then add the new count into it.
        //
        // For example, assume following existing state:
        // 1) the overall app badge has 12, i.e. state.desktopAppBadgeCount === 12;
        // 2) and the FS tab count is 4, i.e. state.navBadges.get(Tabs.fsTab) === 4;
        // Nw we receive `{count: {[Tabs.fsTab]: 7}}` indicating that the
        // new FS tab badge count should become 7. So we deduct 4 from 12 and
        // add 7, and we'd get 15.
        //
        // This way the app badge count is always consistent with the badged
        // tabs.
        s.desktopAppBadgeCount = [...counts.entries()].reduce<number>(
          (count, [k, v]) => count - (s.navBadges.get(k) || 0) + v,
          s.desktopAppBadgeCount
        )

        const navBadges = new Map([...s.navBadges, ...counts])
        if (!isEqual(navBadges, s.navBadges)) {
          s.navBadges = navBadges
        }
        updateWidgetBadge(s)
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
