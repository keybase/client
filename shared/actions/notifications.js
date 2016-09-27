// @flow
import * as Constants from '../constants/notifications'
import ListenerCreator from '../native/notification-listeners'
import engine from '../engine'
import {NotifyPopup} from '../native/notifications'
import {log} from '../native/log/logui'
import {notifyCtlSetNotificationsRpc} from '../constants/types/flow-types'
import {registerIdentifyUi, setupUserChangedHandler} from './tracker'

import type {Dispatch} from '../constants/types/flux'
import type {LogAction, NotificationKeys, NotificationAction} from '../constants/notifications'
import type {Text as KBText, LogLevel} from '../constants/types/flow-types'

function logUiLog ({text, level}: {text: KBText, level: LogLevel}, response: any): LogAction {
  log({text, level}, response)
  return {type: Constants.log, payload: {text: text.data, level}}
}

var initialized = false
function listenForNotifications (): (dispatch: Dispatch) => void {
  return (dispatch, getState) => {
    if (initialized) {
      return
    }

    const channels = {
      app: true,
      chat: false,
      favorites: false,
      kbfs: true,
      kbfsrequest: false,
      keyfamily: false,
      paperkeys: false,
      pgp: true,
      service: true,
      session: true,
      tracking: true,
      users: true,
    }

    engine().listenOnConnect('setNotifications', () => {
      notifyCtlSetNotificationsRpc({
        param: {channels},
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in toggling notifications: ', error)
          }
        },
      })
    })

    const listeners = ListenerCreator(dispatch, getState, NotifyPopup)
    Object.keys(listeners).forEach(key => {
      engine().setIncomingHandler(key, listeners[key])
    })

    dispatch(registerIdentifyUi())
    dispatch(setupUserChangedHandler())

    initialized = true
  }
}

function badgeApp (key: NotificationKeys, on: boolean): NotificationAction {
  return {
    type: Constants.badgeApp,
    payload: {key, on},
  }
}

export {
  badgeApp,
  listenForNotifications,
  logUiLog,
}
