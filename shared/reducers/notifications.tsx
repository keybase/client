import * as Tabs from '../constants/tabs'
import * as Types from '../constants/types/notifications'
import * as Constants from '../constants/notifications'
import * as NotificationsGen from '../actions/notifications-gen'

const initialState: Types.State = Constants.makeState()

const _updateWidgetBadge = (s: Types.State): Types.State => {
  let widgetBadge = 'regular' as Types.BadgeType
  if (s.getIn(['keyState', 'outOfSpace'])) {
    widgetBadge = 'error'
  } else if (s.getIn(['keyState', 'kbfsUploading'])) {
    widgetBadge = 'uploading'
  }
  return s.set('widgetBadge', widgetBadge)
}

export default function(state: Types.State = initialState, action: NotificationsGen.Actions): Types.State {
  switch (action.type) {
    case NotificationsGen.resetStore:
      return initialState
    case NotificationsGen.setBadgeCounts: {
      const chatCount = action.payload.counts.get(Tabs.chatTab)
      const newState = (chatCount ? state.set('mobileAppBadgeCount', chatCount) : state)
        .set(
          'desktopAppBadgeCount',
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
          action.payload.counts.reduce(
            (count, v, k) => count - state.navBadges.get(k, 0) + v,
            state.desktopAppBadgeCount
          )
        )
        .mergeIn(['navBadges'], action.payload.counts)
      return _updateWidgetBadge(newState)
    }
    case NotificationsGen.badgeApp: {
      const newState = state.update('keyState', ks => ks.set(action.payload.key, action.payload.on))
      return _updateWidgetBadge(newState)
    }
    // Saga only actions
    case NotificationsGen.listenForKBFSNotifications:
    case NotificationsGen.listenForNotifications:
    case NotificationsGen.receivedBadgeState:
      return state
    default:
      return state
  }
}
