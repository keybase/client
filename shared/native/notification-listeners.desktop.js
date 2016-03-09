/* @flow */

import enums from '../constants/types/keybase-v1'
import type {incomingCallMapType} from '../constants/types/flow-types'
import path from 'path'
import {getTLF} from '../util/kbfs'

import {bootstrap} from '../actions/config'
import {logoutDone} from '../actions/login'

import type {Dispatch} from '../constants/types/flux'

// TODO: Once we have access to the Redux store from the thread running
// notification listeners, store the sentNotifications map in it.
var sentNotifications = {}

// Keep track of the last time we notified and ignore if its the same
let lastLoggedInNotifyUsername = null

// TODO(mm) Move these to their own actions
export default function (dispatch: Dispatch, notify: any): incomingCallMapType {
  return {
    'keybase.1.NotifySession.loggedOut': params => {
      lastLoggedInNotifyUsername = null
      notify('Logged out of Keybase')
      dispatch(logoutDone())
    },
    'keybase.1.NotifySession.loggedIn': ({username}, response) => {
      if (lastLoggedInNotifyUsername !== username) {
        lastLoggedInNotifyUsername = username
        notify('Logged in to Keybase as: ' + username)
      }

      dispatch(bootstrap())
      response.result()
    },
    'keybase.1.NotifyFS.FSActivity': ({notification}) => {
      const action = {
        [enums.kbfs.FSNotificationType.encrypting]: 'Encrypting and uploading',
        [enums.kbfs.FSNotificationType.decrypting]: 'Decrypting, verifying, and downloading',
        [enums.kbfs.FSNotificationType.signing]: 'Signing and uploading',
        [enums.kbfs.FSNotificationType.verifying]: 'Verifying and downloading',
        [enums.kbfs.FSNotificationType.rekeying]: 'Rekeying'
      }[notification.notificationType]

      const state = {
        [enums.kbfs.FSStatusCode.start]: 'starting',
        [enums.kbfs.FSStatusCode.finish]: 'finished',
        [enums.kbfs.FSStatusCode.error]: 'errored'
      }[notification.statusCode]

      // KBFS fires a notification when it changes state between connected
      // and disconnected (to the mdserver).  For now we just log it.
      if (notification.notificationType === enums.kbfs.FSNotificationType.connection) {
        const state = (notification.statusCode === enums.kbfs.FSStatusCode.start) ? 'connected' : 'disconnected'
        console.log(`KBFS is ${state}`)
        return
      }

      if (notification.statusCode === enums.kbfs.FSStatusCode.finish) {
        // Since we're aggregating dir operations and not showing state,
        // let's ignore file-finished notifications.
        return
      }

      const basedir = notification.filename.split(path.sep)[0]
      const tlf = getTLF(notification.publicTopLevelFolder, basedir)

      let title = `KBFS: ${action}`
      let body = `Files in ${tlf} ${notification.status}`

      // Don't show starting or finished, but do show error.
      if (notification.statusCode === enums.kbfs.FSStatusCode.error) {
        title += ` ${state}`
        body = notification.status
      }

      function rateLimitAllowsNotify (action, state, tlf) {
        if (!(action in sentNotifications)) {
          sentNotifications[action] = {}
        }
        if (!(state in sentNotifications[action])) {
          sentNotifications[action][state] = {}
        }

        // 20s in msec
        const delay = 20000
        const now = new Date()

        // If we haven't notified for {action,state,tlf} or it was >20s ago, do it.
        if (!(tlf in sentNotifications[action][state]) || now - sentNotifications[action][state][tlf] > delay) {
          sentNotifications[action][state][tlf] = now
          return true
        }

        // We've already notified recently, ignore this one.
        return false
      }

      if (rateLimitAllowsNotify(action, state, tlf)) {
        notify(title, {body})
      }
    }
  }
}
