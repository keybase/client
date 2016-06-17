/* @flow */

import {bootstrap} from '../actions/config'
import {logoutDone} from '../actions/login'
import type {Dispatch} from '../constants/types/flux'
import type {incomingCallMapType} from '../constants/types/flow-types'

// Keep track of the last time we notified and ignore if its the same
let lastLoggedInNotifyUsername = null

// TODO(mm) Move these to their own actions
export default function (dispatch: Dispatch, getState: () => Object, notify: any): incomingCallMapType {
  return {
    'keybase.1.NotifySession.loggedOut': params => {
      lastLoggedInNotifyUsername = null

      // Do we actually think we're logged in?
      if (getState().config &&
        getState().config.status &&
        getState().config.status.loggedIn) {
        notify('Logged out of Keybase')
        dispatch(logoutDone())
      }
    },
    'keybase.1.NotifySession.loggedIn': ({username}, response) => {
      if (lastLoggedInNotifyUsername !== username) {
        lastLoggedInNotifyUsername = username
        notify('Logged in to Keybase as: ' + username)
      }

      dispatch(bootstrap())
      response.result()
    },
  }
}
