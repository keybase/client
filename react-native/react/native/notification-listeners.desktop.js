import notify from '../../../desktop/app/hidden-window-notifications'
import enums from '../../react/keybase_v1'

export default {
  'keybase.1.NotifySession.loggedOut': () => {
    notify('Logged Out')
  },
  'keybase.1.NotifyFS.FSActivity': ({notification}) => {
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

    const pubPriv = notification.publicTopLevelFolder ? '[Public]' : '[Private]'

    const title = `KBFS: ${action} ${state}`
    const body = `File: ${notification.filename} ${pubPriv} ${notification.status}`

    notify(title, {body})
  }
}
