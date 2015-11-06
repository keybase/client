import notify from '../../../desktop/app/hidden-window-notifications'

export default {
  'keybase.1.NotifySession.loggedOut': () => {
    notify('Logged Out')
  }
}
