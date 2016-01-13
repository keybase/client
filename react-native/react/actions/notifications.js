/* @flow */
import engine from '../engine'
import {NotifyPopup} from '../native/notifications'
import {logUi} from '../constants/types/keybase_v1'
import ListenerCreator from '../native/notification-listeners'
import setNotifications from '../util/setNotifications'
import * as Constants from '../constants/notifications'

import type {Dispatch} from '../constants/types/flux'
import type {Text, LogLevel} from '../constants/types/flow-types'
import type {LogAction} from '../constants/notifications'

export function logUiLog ({text, level}: {text: Text, level: LogLevel}): LogAction {
  console.log('fooo: keybase.1.logUi.log:', text.data)
  if (level >= logUi.LogLevel.error) {
    NotifyPopup(text.data, {})
  }
  return {type: Constants.log, payload: {text: text.data, level}}
}

var initialized = false
export function listenForNotifications (): (dispatch: Dispatch) => void {
  return dispatch => {
    if (initialized) {
      return
    }

    setNotifications({
      session: true,
      users: true,
      kbfs: true
    })

    const listeners = ListenerCreator(dispatch, NotifyPopup)
    Object.keys(listeners).forEach(k => engine.listenGeneralIncomingRpc(k, listeners[k]))
    initialized = true
  }
}
