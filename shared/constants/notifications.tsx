import * as Z from '../util/zustand'
import isEqual from 'lodash/isEqual'
import * as Tabs from './tabs'

export type BadgeType = 'regular' | 'update' | 'error' | 'uploading'
export type NotificationKeys = 'kbfsUploading' | 'outOfSpace'

type State = {
  badgeVersion: number
  desktopAppBadgeCount: number
  keyState: Map<NotificationKeys, boolean>
  mobileAppBadgeCount: number
  navBadges: Map<Tabs.Tab, number>
  widgetBadge: BadgeType
}
const initialState: State = {
  badgeVersion: -1,
  desktopAppBadgeCount: 0,
  keyState: new Map(),
  mobileAppBadgeCount: 0,
  navBadges: new Map(),
  widgetBadge: 'regular',
}

type ZState = State & {
  dispatch: {
    reset: () => void
    badgeApp: (key: NotificationKeys, on: boolean) => void
    setBadgeCounts: (counts: Map<Tabs.Tab, number>) => void
  }
}

export const useState = Z.createZustand(
  Z.immerZustand<ZState>(set => {
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

    const dispatch = {
      badgeApp: (key: NotificationKeys, on: boolean) => {
        set(s => {
          const {keyState} = s
          keyState.set(key, on)
          updateWidgetBadge(s)
        })
      },
      reset: () => {
        set(() => initialState)
      },
      setBadgeCounts: (counts: Map<Tabs.Tab, number>) => {
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
          // Now we receive `{count: {[Tabs.fsTab]: 7}}` indicating that the
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
      ...initialState,
      dispatch,
    }
  })
)
