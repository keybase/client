// @flow
import * as Constants from '../constants/notifications'
import * as CommonConstants from '../constants/common'

import type {NotificationKeys, NotificationAction, BadgeType} from '../constants/notifications'

type State = {
  menuBadge: BadgeType,
  keyState: {
    [key: NotificationKeys]: boolean,
  },
}

const initialState = {
  menuBadge: 'regular',
  keyState: {},
}

export default function (state: State = initialState, action: NotificationAction): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.badgeApp:
      if (action.error) {
        return state
      }
      let keyState = {
        ...state.keyState,
      }

      keyState[action.payload.key] = action.payload.on

      let menuBadge = 'regular'
      if (keyState.kbfsUploading) {
        menuBadge = 'uploading'
      } else if (keyState.newTLFs) {
        menuBadge = 'badged'
      }

      return {
        ...state,
        menuBadge,
        keyState,
      }
    default:
      return state
  }
}
