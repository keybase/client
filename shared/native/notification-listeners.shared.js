// @flow
import logger from '../logger'
import * as ConfigGen from '../actions/config-gen'
import * as LoginGen from '../actions/login-gen'
import * as NotificationsGen from '../actions/notifications-gen'
import {throttle} from 'lodash-es'

import type {Dispatch} from '../constants/types/flux'
import type {IncomingCallMapType} from '../constants/types/rpc-gen'

// Keep track of the last time we notified and ignore if it's the same
let lastLoggedInNotifyUsername = null

// We get a counter for badge state, if we get one that's less than what we've seen we toss it
let lastBadgeStateVersion = -1

export default function(dispatch: Dispatch, getState: () => Object, notify: any): IncomingCallMapType {
  const throttledDispatch = throttle(action => dispatch(action), 1000, {
    leading: false,
    trailing: true,
  })
  return {
    'keybase.1.NotifyBadges.badgeState': ({badgeState}) => {
      if (badgeState.inboxVers < lastBadgeStateVersion) {
        logger.info(
          `Ignoring older badgeState, got ${badgeState.inboxVers} but have seen ${lastBadgeStateVersion}`
        )
        return
      }

      lastBadgeStateVersion = badgeState.inboxVers

      const conversations = badgeState.conversations
      const totalChats = (conversations || []).reduce((total, c) => total + c.unreadMessages, 0)
      const action = NotificationsGen.createReceivedBadgeState({badgeState})
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
      lastBadgeStateVersion = -1
      if (lastLoggedInNotifyUsername !== username) {
        lastLoggedInNotifyUsername = username
      }

      dispatch(ConfigGen.createBootstrap({}))
      response.result()
    },
    'keybase.1.NotifySession.loggedOut': () => {
      lastBadgeStateVersion = -1
      lastLoggedInNotifyUsername = null

      // Do we actually think we're logged in?
      if (getState().config.loggedIn) {
        dispatch(LoginGen.createLogoutDone())
      }
    },
    'keybase.1.NotifyTracking.trackingChanged': ({username, isTracking}) => {
      dispatch(ConfigGen.createUpdateFollowing({username, isTracking}))
    },
  }
}
