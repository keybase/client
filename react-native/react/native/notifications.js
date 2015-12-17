/* @flow */

import engine from '../engine'
// $FlowIssue can't deal with platform files
import ListenerCreator from './notification-listeners'

var initialized = false

// A function that can display a notification
type NotifyFn = (title: string, opts: Object) => void

export default function (notify: NotifyFn) {
  if (initialized) {
    return
  }

  const param = {
    channels: {
      session: true,
      users: true,
      kbfs: true
    }
  }

  engine.listenOnConnect(() => {
    engine.rpc('notifyCtl.setNotifications', param, {}, (error, response) => {
      if (error != null) {
        console.error('error in toggling notifications: ', error)
      }
    })
  })

  const listeners = ListenerCreator(notify)
  Object.keys(listeners).forEach(k => engine.listenGeneralIncomingRpc(k, listeners[k]))
  initialized = true
}
