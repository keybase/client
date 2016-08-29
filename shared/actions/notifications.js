// @flow
import * as Constants from '../constants/notifications'
import ListenerCreator from '../native/notification-listeners'
import engine from '../engine'
import setNotifications from '../util/set-notifications'
import type {Dispatch} from '../constants/types/flux'
import type {LogAction, NotificationKeys, NotificationAction} from '../constants/notifications'
import type {Text as KBText, LogLevel} from '../constants/types/flow-types'
import {NotifyPopup} from '../native/notifications'
import {log} from '../native/log/logui'

export function logUiLog ({text, level}: {text: KBText, level: LogLevel}, response: any): LogAction {
  log({text, level}, response)
  return {type: Constants.log, payload: {text: text.data, level}}
}

var initialized = false
export function listenForNotifications (): (dispatch: Dispatch) => void {
  return (dispatch, getState) => {
    if (initialized) {
      return
    }

    setNotifications({
      session: true,
      users: true,
      kbfs: true,
      service: true,
      app: true,
      pgp: true,
    })

    const listeners = ListenerCreator(dispatch, getState, NotifyPopup)
    Object.keys(listeners).forEach(key => {
      engine().setIncomingHandler(key, listeners[key])
    })
    initialized = true
  }
}

export function badgeApp (key: NotificationKeys, on: boolean): NotificationAction {
  return {
    type: Constants.badgeApp,
    payload: {key, on},
  }
}
