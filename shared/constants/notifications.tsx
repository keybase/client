import * as Z from '../util/zustand'
import * as RPCTypes from '../constants/types/rpc-gen'
import {isMobile} from './platform'
import logger from '../logger'
import isEqual from 'lodash/isEqual'
import * as Tabs from './tabs'

export type BadgeType = 'regular' | 'update' | 'error' | 'uploading'
export type NotificationKeys = 'kbfsUploading' | 'outOfSpace'

type Store = {
  badgeVersion: number
  desktopAppBadgeCount: number
  keyState: Map<NotificationKeys, boolean>
  mobileAppBadgeCount: number
  navBadges: Map<Tabs.Tab, number>
  widgetBadge: BadgeType
}
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
    resetState: 'default'
    badgeApp: (key: NotificationKeys, on: boolean) => void
    setBadgeCounts: (counts: Map<Tabs.Tab, number>) => void
  }
}

export const useState = Z.createZustand<State>(set => {
  const updateWidgetBadge = (s: State) => {
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
              wallet: false,
            },
          })
        } catch (error) {
          if (error != null) {
            logger.warn('error in toggling notifications: ', error)
          }
        }
      }
      Z.ignorePromise(f())
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
