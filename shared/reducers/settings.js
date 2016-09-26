// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/settings'
import type {Actions, State} from '../constants/settings'

const initialState: State = {
  notifications: {
    settings: null,
    unsubscribedFromAll: null,
  },
}

function reducer (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.notificationsToggle:
      if (!state.notifications.settings) {
        return state
      }

      // No name means the unsubscribe option
      const name = action.payload.name

      const updateSubscribe = setting => {
        let subscribed = setting.subscribed

        if (!name) { // clicked unsub all
          subscribed = false
        } else if (name === setting.name) { // flip if its the one we're looking for
          subscribed = !subscribed
        }

        return {
          ...setting,
          subscribed,
        }
      }

      return {
        ...state,
        notifications: {
          ...state.notifications,
          settings: state.notifications.settings.map(updateSubscribe),
          unsubscribedFromAll: name ? false : !state.notifications.unsubscribedFromAll,
        },
      }
    case Constants.notificationsRefreshed:
      if (action.error) { break }
      return {
        ...state,
        notifications: action.payload,
      }
  }

  return state
}

export default reducer
