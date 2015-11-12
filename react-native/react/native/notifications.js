'use strict'
/* @flow */

import engine from '../engine'
import listeners from './notification-listeners'

var initialized = false

export function init () {
  if (initialized) {
    throw new Error('notifications were already initialized')
  }

  const param = {
    channels: {
      session: true,
      users: true
    }
  }

  engine.listenOnConnect(() => {
    engine.rpc('notifyCtl.setNotifications', param, {}, (error, response) => {
      if (error != null) {
        console.error('error in toggling notifications: ', error)
      }
    })
  })

  Object.keys(listeners).forEach(k => engine.listenGeneralIncomingRpc(k, listeners[k]))
  initialized = true
}
