// @flow
import {receivedBadgeState} from '../actions/notifications'
import {bootstrap, updateFollowing} from '../actions/config'
import {logoutDone} from '../actions/login/creators'
import {throttle} from 'lodash'

import type {Dispatch} from '../constants/types/flux'
import type {incomingCallMapType} from '../constants/types/flow-types'

// Keep track of the last time we notified and ignore if its the same
let lastLoggedInNotifyUsername = null

export default function(dispatch: Dispatch, getState: () => Object, notify: any): incomingCallMapType {
  const throttledDispatch = throttle(action => dispatch(action), 1000, {leading: false, trailing: true})
  return {
    'keybase.1.NotifyBadges.badgeState': ({badgeState}) => {
      const totalChats = (badgeState.conversations || []).reduce((total, c) => total + c.UnreadMessages, 0)

      const action = receivedBadgeState(badgeState)
      if (totalChats > 0) {
        // Defer this slightly so we don't get flashing if we're quickly receiving and reading
        throttledDispatch(action)
      } else {
        // If clearing go immediately
        throttledDispatch.cancel()
        dispatch(action)
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
    'keybase.1.NotifySession.loggedOut': params => {
      lastLoggedInNotifyUsername = null

      // Do we actually think we're logged in?
      if (getState().config.loggedIn) {
        notify('Logged out of Keybase')
        dispatch(logoutDone())
      }
    },
    'keybase.1.NotifyTracking.trackingChanged': ({username, isTracking}) => {
      dispatch(updateFollowing(username, isTracking))
    },
  }
}
