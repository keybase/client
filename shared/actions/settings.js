// @flow
import * as Constants from '../constants/settings'
import {apiserverGetRpcPromise} from '../constants/types/flow-types'
import {call, put} from 'redux-saga/effects'
import {takeLatest} from 'redux-saga'

import type {SagaGenerator} from '../constants/types/saga'
import type {NotificationsRefresh} from '../constants/settings'

function notificationsRefresh (): NotificationsRefresh {
  return {type: Constants.notificationsRefresh, payload: undefined}
}

function * refreshNotificationsSaga (): SagaGenerator<any, any> {
  try {
    const json: ?{body: string} = yield call(apiserverGetRpcPromise, {
      param: {
        endpoint: 'account/subscriptions',
        args: [],
      },
    })

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
    // TODO global error
  }
}

function * notificationsSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.notificationsRefresh, refreshNotificationsSaga),
  ]
}

function * settingsSaga (): SagaGenerator<any, any> {
  yield [
    call(notificationsSaga),
  ]
}

export {
  notificationsRefresh,
}

export default settingsSaga
