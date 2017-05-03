// @flow
import * as Constants from '../constants/notifications'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import ListenerCreator from '../native/notification-listeners'
import engine, {Engine} from '../engine'
import {NotifyPopup} from '../native/notifications'
import {call, put, take, fork} from 'redux-saga/effects'
import {isMobile} from '../constants/platform'
import {log} from '../native/log/logui'
import {registerIdentifyUi, setupUserChangedHandler} from './tracker'
import {setupChatHandlers, badgeAppForChat} from './chat'
import {badgeStateToUnreadMessages} from './chat/shared'
import {setupKBFSChangedHandler} from './favorite'
import {clearLocalPushNotifications} from './platform-specific'

import type {SagaGenerator} from '../constants/types/saga'

function logUiLog ({text, level}: {text: RPCTypes.Text, level: RPCTypes.LogLevel}, response: any): Constants.LogAction {
  log({level, text}, response)
  return {payload: {level, text: text.data}, type: 'notifications:log'}
}

function listenForNotifications (): Constants.ListenForNotifications {
  return {payload: undefined, type: 'notifications:listenForNotifications'}
}

function listenForKBFSNotifications (): Constants.ListenForKBFSNotifications {
  return {payload: undefined, type: 'notifications:listenForKBFSNotifications'}
}

function badgeApp (key: Constants.NotificationKeys, on: boolean, count: number = 0): Constants.BadgeAppAction {
  return {payload: {count, key, on}, type: 'notifications:badgeApp'}
}

function receivedBadgeState (badgeState: RPCTypes.BadgeState): Constants.ReceivedBadgeState {
  return {payload: {badgeState}, type: 'notifications:receivedBadgeState'}
}

function * _listenSaga (): SagaGenerator<any, any> {
  const channels = {
    app: true,
    badges: true,
    chat: true,
    favorites: false,
    kbfs: !isMobile,
    kbfsrequest: !isMobile,
    keyfamily: false,
    paperkeys: false,
    pgp: true,
    reachability: true,
    service: true,
    session: true,
    tracking: true,
    users: true,
  }

  const engineInst: Engine = yield call(engine)
  yield call([engineInst, engineInst.listenOnConnect], 'setNotifications', () => {
    RPCTypes.notifyCtlSetNotificationsRpc({
      param: {channels},
      callback: (error, response) => {
        if (error != null) {
          console.warn('error in toggling notifications: ', error)
        }
      },
    })
  })

  yield put((dispatch, getState) => {
    const listeners = ListenerCreator(dispatch, getState, NotifyPopup)
    Object.keys(listeners).forEach(key => {
      engine().setIncomingHandler(key, listeners[key])
    })
  })

  yield put(registerIdentifyUi())
  yield put(setupUserChangedHandler())
}

function * _listenKBFSSaga (): SagaGenerator<any, any> {
  yield put(setupKBFSChangedHandler())
  yield put(setupChatHandlers())
}

function * _onReceivedBadgeState (action: Constants.ReceivedBadgeState): SagaGenerator<any, any> {
  const {badgeState} = action.payload
  const {conversations} = badgeState
  yield put(badgeAppForChat(conversations))
  const newMessages = badgeStateToUnreadMessages(badgeState)
  if (newMessages === 0) {
    yield put(clearLocalPushNotifications)
  }
}

function * _listenNotifications (): SagaGenerator<any, any> {
  yield take('notifications:listenForNotifications')
  yield call(_listenSaga)
}

function * _listenForKBFSNotifications (): SagaGenerator<any, any> {
  yield take('notifications:listenForKBFSNotifications')
  yield call(_listenKBFSSaga)
}

function * notificationsSaga (): SagaGenerator<any, any> {
  yield fork(_listenNotifications)
  yield fork(_listenForKBFSNotifications)
  yield Saga.safeTakeLatest('notifications:receivedBadgeState', _onReceivedBadgeState)
}

export {
  badgeApp,
  listenForNotifications,
  listenForKBFSNotifications,
  logUiLog,
  receivedBadgeState,
}

export default notificationsSaga
