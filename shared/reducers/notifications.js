// @flow
import * as Constants from '../constants/notifications'
import * as CommonConstants from '../constants/common'

import type {NotificationKeys, NotificationAction, BadgeType, MenuNotificationState} from '../constants/notifications'

type State = {
  menuBadge: BadgeType,
  menuBadgeCount: number,
  menuNotifications: MenuNotificationState,
  keyState: {
    [key: NotificationKeys]: boolean,
  },
}

const initialState = {
  menuBadge: 'regular',
  menuBadgeCount: 0,
  keyState: {},
  menuNotifications: {
    folderBadge: 0,
    peopleBadge: 0,
    chatBadge: 0,
    deviceBadge: 0,
  },
}

export default function (state: State = initialState, action: NotificationAction): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.badgeApp:
      // $ForceType
      const badgeAction: BadgeAppAction = action

      if (badgeAction.error) {
        return state
      }
      let keyState = {
        ...state.keyState,
      }

      keyState[badgeAction.payload.key] = badgeAction.payload.on
      const menuNotifications = {...state.menuNotifications}

      let menuBadge = 'regular'
      if (keyState.kbfsUploading) {
        menuBadge = 'uploading'
      } else if (keyState.newTLFs || keyState.chatInbox) {
        menuBadge = 'badged'
      }

      if (badgeAction.payload.key === 'newTLFs') {
        menuNotifications.folderBadge = badgeAction.payload.count || 0
      } else if (badgeAction.payload.key === 'chatInbox') {
        menuNotifications.chatBadge = badgeAction.payload.count || 0
      }

      const menuBadgeCount = Object.keys(menuNotifications).reduce((total, n) => total + menuNotifications[n], 0)

      return {
        ...state,
        menuBadge,
        menuBadgeCount,
        keyState,
        menuNotifications,
      }
    default:
      return state
  }
}
