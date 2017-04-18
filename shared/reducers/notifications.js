// @flow
import * as Constants from '../constants/notifications'
import * as CommonConstants from '../constants/common'
import {isMobile} from '../constants/platform'
import {Map} from 'immutable'

const initialState: Constants.State = new Constants.StateRecord()

const widgetBadgeFromKeyState = (keyState: Map<Constants.NotificationKeys, boolean>) => {
  let widgetBadge = 'regular'
  if (keyState.kbfsUploading) {
    widgetBadge = 'uploading'
  } else if (keyState.newTLFs || keyState.chatInbox) {
    widgetBadge = 'badged'
  }

  return widgetBadge
}

export default function (state: Constants.State = initialState, action: Constants.Actions): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return initialState
    case 'notifications:badgeApp':
      const badgeAction: Constants.BadgeAppAction = action

      const newKeyState = state.get('keyState').set(badgeAction.payload.key, badgeAction.payload.on)
      const newWidgetBadge = widgetBadgeFromKeyState(newKeyState)

      let newMenuNotifications: Map<Constants.MenuStateKeys, number> = state.get('menuNotifications')

      if (badgeAction.payload.key === 'newTLFs') {
        newMenuNotifications = newMenuNotifications.set('folderBadge', badgeAction.payload.count || 0)
      } else if (badgeAction.payload.key === 'chatInbox') {
        newMenuNotifications = newMenuNotifications.set('chatBadge', badgeAction.payload.count || 0)
      }

      // Menu badge is chat only currently
      const newMenuBadgeCount = isMobile
        ? newMenuNotifications.get('chatBadge')
        : newMenuNotifications.reduce((total, val) => total + val, 0)

      // $FlowIssue doesn't understand withMutations
      return state.withMutations(s => {
        s.set('keyState', newKeyState)
        s.set('widgetBadge', newWidgetBadge)
        s.set('menuNotifications', newMenuNotifications)
        s.set('menuBadgeCount', newMenuBadgeCount)
      })
    default:
      return state
  }
}
