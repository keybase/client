// @flow
import * as Types from '../constants/types/notifications'
import * as Constants from '../constants/notifications'
import * as NotificationsGen from '../actions/notifications-gen'

const initialState: Types.State = Constants.makeState()

const _updateWidgetBadge = (s: Types.State): Types.State => {
  let widgetBadge = 'regular'
  if (s.getIn(['keyState', 'kbfsUploading'])) {
    widgetBadge = 'uploading'
  } else if (s.desktopAppBadgeCount) {
    widgetBadge = 'badged'
  }

  return s.set('widgetBadge', widgetBadge)
}

export default function(state: Types.State = initialState, action: NotificationsGen.Actions): Types.State {
  switch (action.type) {
    case NotificationsGen.resetStore: {
      return initialState
    }
    case NotificationsGen.receivedBadgeState: {
      const newState = state.merge(action.payload)
      return _updateWidgetBadge(newState)
    }
    case NotificationsGen.badgeApp: {
      const {key, on} = action.payload
      const newState = state.update('keyState', ks => ks.set(key, on))
      return _updateWidgetBadge(newState)
    }
    // Saga only actions
    case NotificationsGen.listenForKBFSNotifications:
    case NotificationsGen.listenForNotifications:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
