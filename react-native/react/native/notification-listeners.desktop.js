import enums from '../../react/constants/types/keybase_v1'
import type {NotifySession_loggedOut} from '../../react/constants/types/flow-types'
import {NotifySession_loggedOut_method} from '../../react/constants/types/flow-types'
import path from 'path'
import type {FSNotification} from '../../react/constants/types/flow-types'
import {getTLF} from '../util/kbfs'

import {getCurrentStatus} from '../actions/config'
import {logoutDone} from '../actions/login'

// TODO: Once we have access to the Redux store from the thread running
// notification listeners, store the sentNotifications map in it.
var sentNotifications = {}

// TODO(mm) Move these to their own actions
export default function (dispatch, notify) {
  const callMap: {
    'keybase.1.NotifySession.loggedOut': NotifySession_loggedOut
  } = {
    [NotifySession_loggedOut_method]: (() => {
      notify('Logged out of Keybase')
      dispatch(logoutDone())
      return 'hi' // this should fail TEMP
    }),
    'keybase.1.NotifySession.loggedIn': ({username}: {username: string}) => {
      notify('Logged in to Keybase as: ' + username)
      dispatch(getCurrentStatus())
    },
    'keybase.1.NotifyFS.FSActivity': params => {
      const notification: FSNotification = params.notification

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

      if (notification.statusCode === enums.kbfs.FSStatusCode.finish) {
        // Since we're aggregating dir operations and not showing state,
        // let's ignore file-finished notifications.
        return
      }

      const basedir = notification.filename.split(path.sep)[0]
      const tlf = getTLF(notification.publicTopLevelFolder, basedir)

      let title = `KBFS: ${action}`
      // Don't show starting or finished, but do show error.
      if (notification.statusCode === enums.kbfs.FSStatusCode.error) {
        title += ` ${state}`
      }
      const body = `Files in ${tlf} ${notification.status}`

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

  return callMap
}
