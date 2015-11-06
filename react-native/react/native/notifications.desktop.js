'use strict'
/* @flow */

import engine from '../engine'

const param = {
  channels: {
    session: true,
    users: true
  }
}

export function enableNotifications () {
  console.log('setting up notification')
  engine.listenOnConnect(() => {
    engine.rpc('notifyCtl.toggleNotifications', param, {}, (error, response) => {
      if (error != null) {
        console.error('error in toggling notifications: ', error)
      }
      console.log('Enabled Notifications')
    })
  })
}

export function bindNotifications () {
  engine.listenGeneralIncomingRpc('keybase.1.NotifySession.loggedOut', logoutNotification)
}

export function unbindNotifications () {
  engine.unlistenGeneralIncomingRpc('keybase.1.NotifySession.loggedOut', logoutNotification)
}

function logoutNotification (param) {
  new Notification('Logged Out')
}
