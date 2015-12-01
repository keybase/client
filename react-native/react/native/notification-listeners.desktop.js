import notify from '../../../desktop/app/hidden-window-notifications'
import enums from '../../react/constants/types/keybase_v1'
import type {FSNotification} from '../../react/constants/types/flow-types'

// TODO: Once we have access to the Redux store from the thread running
// notification listeners, store the sentNotifications map in it.
var sentNotifications = {}

export default {
  'keybase.1.NotifySession.loggedOut': () => {
    notify('Logged Out')
  },
  'keybase.1.NotifyFS.FSActivity': params => {
    const notification: FSNotification = params.notification

    const action = {
      [enums.kbfs.FSNotificationType.encrypting]: 'Encrypting',
      [enums.kbfs.FSNotificationType.decrypting]: 'Decrypting',
      [enums.kbfs.FSNotificationType.signing]: 'Signing',
      [enums.kbfs.FSNotificationType.verifying]: 'Verifying',
      [enums.kbfs.FSNotificationType.rekeying]: 'Rekeying'
    }[notification.notificationType]

    const state = {
      [enums.kbfs.FSStatusCode.start]: 'Starting',
      [enums.kbfs.FSStatusCode.finish]: 'Finished',
      [enums.kbfs.FSStatusCode.error]: 'Errored'
    }[notification.statusCode]

    const basedir = notification.filename.split(path.sep)[0]
    let tlf
    if (notification.publicTopLevelFolder) {
      // Public filenames look like cjb#public/foo.txt
      tlf = `/public/${basedir.replace('#public', '')}`
    } else {
      // Private filenames look like cjb/foo.txt
      tlf = `/private/${basedir}`
    }

    const title = `KBFS: ${action} ${state}`
    const body = `Files in ${tlf} ${notification.status}`

    function rateLimitAllowsNotify(action, state, tlf) {
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
