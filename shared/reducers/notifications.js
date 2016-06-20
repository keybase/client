// @flow
import * as Constants from '../constants/notifications'
import * as CommonConstants from '../constants/common'
import type {NotificationKeys, NotificationAction} from '../constants/notifications'

type State = {
  menuBadge: boolean,
  keyState: {
    [key: NotificationKeys]: boolean
  }
}

const initialState = {
  menuBadge: false,
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

      // Badge if we have a new, other stuff later
      const menuBadge = keyState.newTLFs
      // TEMP if you want to see the menu badge change // const menuBadge = Math.random() < 0.5

      return {
        ...state,
        menuBadge,
        keyState,
      }
    default:
      return state
  }
}
