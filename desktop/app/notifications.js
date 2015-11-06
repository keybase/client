import engine from '../../react-native/react/engine'
import notifier from 'node-notifier'

engine.listenOnConnect(() => {
  engine.rpc('notifyCtl.toggleNotifications', {
    channels: { session: true, users: true }
  }, {}, (error, response) => {
    if (error) {
      console.error('error toggling notifications: ', error)
    }
  })
})

const notifications = {
  'keybase.1.NotifySession.loggedOut': () => {
    notifier.notify({
      title: 'Logged out',
      message: 'Apparently message is mandatory, let\'s switch to a better notification library.'
    })
  },

  'keybase.1.NotifyUsers.userChanged': uid => {
    notifier.notify({
      title: 'Logged in',
      message: uid
    })
  }
}

for (const name in notifications) {
  engine.listenGeneralIncomingRpc(name, notifications[name])
}
