/* @flow */

import {bootstrap} from '../actions/config'
import {logoutDone} from '../actions/login'
import {favoriteList} from '../actions/favorite'
import {kbfsNotification} from '../util/kbfs-notifications'
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
    'keybase.1.NotifySession.clientOutOfDate': ({upgradeTo, upgradeURI, upgradeMsg}) => {
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      notify('Client out of date!', {body}, 60 * 60)
    },
    'keybase.1.NotifyFS.FSActivity': ({notification}) => {
      kbfsNotification(notification, notify, getState)
    },
    'keybase.1.GREGOR.TODO': ({model}) => { // TODO: This isn't the real message. Mocking this out until we get the real one
      if (model.type === 'RefreshFavorites') {
        dispatch(favoriteList())
      }
    },
  }
}
