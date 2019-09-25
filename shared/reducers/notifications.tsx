import * as Container from '../util/container'
import * as NotificationsGen from '../actions/notifications-gen'
import * as Tabs from '../constants/tabs'
import * as Types from '../constants/types/notifications'
import {isEqual} from 'lodash-es'

const initialState: Types.State = {
  badgeVersion: -1,
  desktopAppBadgeCount: 0,
  keyState: new Map(),
  mobileAppBadgeCount: 0,
  navBadges: new Map(),
  widgetBadge: 'regular',
}

const updateWidgetBadge = (draftState: Container.Draft<Types.State>) => {
  let widgetBadge: Types.BadgeType = 'regular'
  const {keyState} = draftState
  if (keyState.get('outOfSpace')) {
    widgetBadge = 'error'
  } else if (keyState.get('kbfsUploading')) {
    widgetBadge = 'uploading'
  }
  if (widgetBadge !== draftState.widgetBadge) {
    draftState.widgetBadge = widgetBadge
  }
}

export default (state: Types.State = initialState, action: NotificationsGen.Actions): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case NotificationsGen.resetStore:
        return initialState
      case NotificationsGen.setBadgeCounts: {
        const {counts} = action.payload
        const chatCount = counts.get(Tabs.chatTab)
        if (chatCount) {
          draftState.mobileAppBadgeCount = chatCount
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
        draftState.desktopAppBadgeCount = [...counts.entries()].reduce<number>(
          (count, [k, v]) => count - (draftState.navBadges.get(k) || 0) + v,
          draftState.desktopAppBadgeCount
        )

        const navBadges = new Map([...draftState.navBadges, ...counts])
        if (!isEqual(navBadges, draftState.navBadges)) {
          draftState.navBadges = navBadges
        }
        updateWidgetBadge(draftState)
        return
      }
      case NotificationsGen.badgeApp: {
        const keyState = new Map(draftState.keyState)
        const {key, on} = action.payload
        keyState.set(key, on)
        draftState.keyState = keyState
        updateWidgetBadge(draftState)
        return
      }
      // Saga only actions
      case NotificationsGen.listenForKBFSNotifications:
      case NotificationsGen.listenForNotifications:
      case NotificationsGen.receivedBadgeState:
        return
    }
  })
