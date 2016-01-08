/* @flow */

import engine from '../engine'
// $FlowIssue can't deal with platform files
import ListenerCreator from './notification-listeners'
import setNotifications from '../util/setNotifications'

var initialized = false

// A function that can display a notification
type NotifyFn = (title: string, opts: Object) => void

export default function (notify: NotifyFn) {
  if (initialized) {
    return
  }

  setNotifications({
    session: true,
    users: true,
    kbfs: true
  })

  const listeners = ListenerCreator(notify)
  Object.keys(listeners).forEach(k => engine.listenGeneralIncomingRpc(k, listeners[k]))
  initialized = true
}
