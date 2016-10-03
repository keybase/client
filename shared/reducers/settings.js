// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/settings'
import type {Actions, State} from '../constants/settings'

const initialState: State = {
  allowDeleteAccount: false,
  notifications: {
    settings: null,
    unsubscribedFromAll: null,
    allowSave: false,
    allowEdit: false,
  },
}

function reducer (state: State = initialState, action: Actions): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.setAllowDeleteAccount:
      return {
        ...initialState,
        allowDeleteAccount: action.payload,
      }
    case Constants.notificationsToggle:
      if (!state.notifications.settings) {
        console.log('Warning: trying to toggle while not loaded')
        return state
      } else if (!state.notifications.allowEdit) {
        console.log('Warning: trying to toggle while allowEdit false')
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
          allowSave: true,
        },
      }
    case Constants.notificationsSave:
      return {
        ...state,
        notifications: {
          ...state.notifications,
          allowEdit: false,
        },
      }
    case Constants.notificationsSaved:
      return {
        ...state,
        notifications: {
          ...state.notifications,
          allowSave: false,
          allowEdit: true,
        },
      }
    case Constants.notificationsRefreshed:
      return {
        ...state,
        notifications: {
          ...action.payload,
          allowSave: false,
          allowEdit: true,
        },
      }
  }

  return state
}

export default reducer
