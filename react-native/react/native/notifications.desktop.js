'use strict'
/* @flow */

import engine from '../engine'

export function enableNotifications () {
  console.log('setting up notification')

  const param = {
    channels: {
      session: true,
      users: true
    }
  }

  engine.listenOnConnect(() => {
    engine.rpc('notifyCtl.toggleNotifications', param, {}, (error, response) => {
      if (error != null) {
        console.error('error in toggling notifications: ', error)
      } else {
        console.log('Enabled Notifications')
      }
    })
  })
}

const listeners = {
  'keybase.1.NotifySession.loggedOut': logoutNotification
}

// Returns function that should be called to unbind listeners
export function bindNotifications () {
  Object.keys(listeners).forEach(k => engine.listenGeneralIncomingRpc(k, listeners[k]))
  return () => {
    Object.keys(listeners).forEach(k => engine.unlistenGeneralIncomingRpc(k, listeners[k]))
  }
}

function logoutNotification (param) {
  new Notification('Logged Out') // eslint-disable-line
}
