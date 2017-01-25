// @flow
import {remote} from 'electron'
import {List, Record} from 'immutable'
import {bootstrap} from '../actions/config'
import {logoutDone} from '../actions/login'
import {badgeApp} from '../actions/notifications'
import {badgeAppForChat} from '../actions/chat'
import {kbfsNotification} from '../util/kbfs-notifications'
import {pgpKeyInSecretStoreFile} from '../constants/pgp'

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
    'keybase.1.NotifyBadges.badgeState': ({badgeState}) => {
      const {conversations, newTlfs} = badgeState
      const convos = List(conversations.map(conversation => Record(conversation)))
      console.warn('convos is ', convos)
      console.warn(convos)
      dispatch(badgeAppForChat(convos))
      dispatch(badgeApp('newTLFs', newTlfs > 0, newTlfs))
    },
    'keybase.1.NotifyService.shutdown': () => {
      // console.log('Quitting due to service shutdown')
      // App quiting will call ctl stop, which will stop the service
      // remote.app.quit()
    },
    'keybase.1.NotifyApp.exit': () => {
      console.log('App exit requested')
      remote.app.exit(0)
    },
    'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': () => {
      dispatch({type: pgpKeyInSecretStoreFile, payload: undefined})
    },
  }
}
