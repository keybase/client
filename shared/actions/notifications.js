/* @flow */
import engine from '../engine'
import {NotifyPopup} from '../native/notifications'
import ListenerCreator from '../native/notification-listeners'
import setNotifications from '../util/set-notifications'
import * as Constants from '../constants/notifications'
import {log} from '../native/log/logui'

import type {Dispatch} from '../constants/types/flux'
import type {Text as KBText, LogLevel, incomingCallMapType} from '../constants/types/flow-types'
import type {LogAction, NotificationKeys, NotificationAction} from '../constants/notifications'

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
    })

    const listeners: incomingCallMapType = ListenerCreator(dispatch, getState, NotifyPopup)
    engine.listenGeneralIncomingRpc(listeners)
    initialized = true
  }
}

export function badgeApp (key: NotificationKeys, on: boolean): NotificationAction {
  return {
    type: Constants.badgeApp,
    payload: {key, on},
  }
}
