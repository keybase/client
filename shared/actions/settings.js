// @flow
import * as Constants from '../constants/settings'
import {apiserverGetRpcPromise, apiserverPostJSONRpcPromise} from '../constants/types/flow-types'
import {call, put, select, fork, cancel} from 'redux-saga/effects'
import {takeLatest, delay} from 'redux-saga'

import type {SagaGenerator} from '../constants/types/saga'
import type {NotificationsRefresh, NotificationsSave, NotificationsToggle} from '../constants/settings'

function notificationsRefresh (): NotificationsRefresh {
  return {type: Constants.notificationsRefresh, payload: undefined}
}

function notificationsSave (): NotificationsSave {
  return {type: Constants.notificationsSave, payload: undefined}
}

function notificationsToggle (name?: string): NotificationsToggle {
  return {type: Constants.notificationsToggle, payload: {name}}
}

function * saveNotificationsSaga (): SagaGenerator<any, any> {
  try {
    const current = yield select(state => state.settings.notifications)

    if (!current || !current.settings) {
      throw new Error('No notifications loaded yet')
    }

    const JSONPayload = current.settings
      .map(s => ({
        key: `${s.name}|email`,
        value: s.subscribed ? '1' : '0'}))
      .concat({
        key: `unsub|email`,
        value: current.unsubscribedFromAll ? '1' : '0'})

    const result = yield call(apiserverPostJSONRpcPromise, {
      param: {
        endpoint: 'account/subscribe',
        args: [],
        JSONPayload,
      },
    })

    if (!result || !result.body || JSON.parse(result.body).status.code !== 0) {
      throw new Error(`Invalid response ${result || '(no result)'}`)
    }

    yield put({
      type: Constants.notificationsSaved,
      payload: undefined,
    })
  } catch (err) {
    // TODO hook into global error handler
    console.error(err)
  }
}

function * refreshNotificationsSaga (): SagaGenerator<any, any> {
  try {
    // If the rpc is fast don't clear it out first
    const delayThenEmptyTask = yield fork(function * () {
      yield call(delay, 500)
      yield put({
        type: Constants.notificationsRefreshed,
        payload: {
          settings: null,
          unsubscribedFromAll: null,
        }})
    })

    const json: ?{body: string} = yield call(apiserverGetRpcPromise, {
      param: {
        endpoint: 'account/subscriptions',
        args: [],
      },
    })

    yield cancel(delayThenEmptyTask)

    const results: {
      notifications: {
        email: {
          settings: Array<{
            name: string,
            description: string,
            subscribed: boolean,
          }>,
          unsub: boolean,
        },
      },
    } = JSON.parse(json && json.body || '')

    const unsubscribedFromAll = results.notifications.email.unsub

    const settings = results.notifications.email.settings.map(s => ({
      name: s.name,
      subscribed: s.subscribed,
      description: s.description,
    })) || []

    yield put({
      type: Constants.notificationsRefreshed,
      payload: {
        unsubscribedFromAll,
        settings,
      },
    })
  } catch (err) {
    // TODO hook into global error handler
    console.error(err)
  }
}

function * notificationsSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.notificationsRefresh, refreshNotificationsSaga),
    takeLatest(Constants.notificationsSave, saveNotificationsSaga),
  ]
}

function * settingsSaga (): SagaGenerator<any, any> {
  yield [
    call(notificationsSaga),
  ]
}

export {
  notificationsRefresh,
  notificationsSave,
  notificationsToggle,
}

export default settingsSaga
