import enums from '../../react/constants/types/keybase_v1'
import path from 'path'
import type {FSNotification} from '../../react/constants/types/flow-types'

// TODO: Once we have access to the Redux store from the thread running
// notification listeners, store the sentNotifications map in it.
var sentNotifications = {}

export default function (notify) {
  return {
    'keybase.1.NotifySession.loggedOut': () => {
      notify('Logged Out')
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
      let tlf
      if (notification.publicTopLevelFolder) {
        // Public filenames look like cjb#public/foo.txt
        tlf = `/public/${basedir.replace('#public', '')}`
      } else {
        // Private filenames look like cjb/foo.txt
        tlf = `/private/${basedir}`
      }

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
}
