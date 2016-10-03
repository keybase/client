// @flow
import * as Constants from '../constants/settings'
import {apiserverGetRpcPromise, apiserverPostJSONRpcPromise, loginAccountDeleteRpcPromise} from '../constants/types/flow-types'
import {setDeletedSelf} from '../actions/login'
import {call, put, select, fork, cancel} from 'redux-saga/effects'
import {takeLatest, delay} from 'redux-saga'

import type {SagaGenerator} from '../constants/types/saga'
import type {InvitesRefresh, NotificationsRefresh, NotificationsSave, NotificationsToggle, SetAllowDeleteAccount, DeleteAccountForever} from '../constants/settings'

function invitesRefresh (): InvitesRefresh {
  return {type: Constants.invitesRefresh, payload: undefined}
}

function notificationsRefresh (): NotificationsRefresh {
  return {type: Constants.notificationsRefresh, payload: undefined}
}

function notificationsSave (): NotificationsSave {
  return {type: Constants.notificationsSave, payload: undefined}
}

function notificationsToggle (name?: string): NotificationsToggle {
  return {type: Constants.notificationsToggle, payload: {name}}
}

function setAllowDeleteAccount (allow: boolean): SetAllowDeleteAccount {
  return {type: Constants.setAllowDeleteAccount, payload: allow}
}

function deleteAccountForever (): DeleteAccountForever {
  return {type: Constants.deleteAccountForever, payload: undefined}
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

function * refreshInvitesSaga (): SagaGenerator<any, any> {
  try {
    // If the rpc is fast don't clear it out first
    const delayThenEmptyTask = yield fork(function * () {
      yield call(delay, 500)
      yield put({
        type: Constants.invitesRefreshed,
        payload: {
          settings: null,
          unsubscribedFromAll: null,
        }})
    })

    const json: ?{body: string} = yield call(apiserverGetRpcPromise, {
      param: {
        endpoint: 'invitations_sent',
        args: [],
      },
    })

    yield cancel(delayThenEmptyTask)

    const results: {
      invitations: [{
        assertion: ?string,
        ctime: number,
        email: string,
        invitation_id: string,
        short_code: string,
        type: string,
        uid: number,
        username: string,
      }],
    } = JSON.parse(json && json.body || '')

    const acceptedInvites = []
    const pendingInvites = []

    results.invitations.forEach(i => {
      const invite = {
        created: i.ctime,
        email: i.email,
        id: i.invitation_id,
        key: i.invitation_id,
        // type will get filled in later
        type: '',
        username: i.username,
        uid: i.uid,
        // First ten chars of invite code is sufficient
        url: 'keybase.io/inv/' + i.invitation_id.slice(0, 10),
      }
      // Here's an algorithm for interpreting invitation entries.
      // 1: username+uid => accepted invite, else
      // 2: email set => pending email invite, else
      // 3: pending invitation code invite
      if (i.username && i.uid) {
        invite.type = 'accepted'
        acceptedInvites.push(invite)
      } else {
        invite.type = i.email ? 'pending-email' : 'pending-url'
        pendingInvites.push(invite)
      }
    })
    yield put({
      type: Constants.invitesRefreshed,
      payload: {
        ...results,
        acceptedInvites,
        pendingInvites,
      },
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

function * deleteAccountForeverSaga (): SagaGenerator<any, any> {
  try {
    const username = yield select(state => state.config.username)
    const allowDeleteAccount = yield select(state => state.settings.allowDeleteAccount)

    if (!username) {
      throw new Error('Unable to delete account: not username set')
    }

    if (!allowDeleteAccount) {
      throw new Error('Account deletion failsafe was not disengaged. This is a bug!')
    }

    yield call(loginAccountDeleteRpcPromise)
    yield put(setDeletedSelf(username))
  } catch (err) {
    // TODO hook into global error handler
    console.error(err)
  }
}

function * settingsSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.invitesRefresh, refreshInvitesSaga),
    takeLatest(Constants.notificationsRefresh, refreshNotificationsSaga),
    takeLatest(Constants.notificationsSave, saveNotificationsSaga),
    takeLatest(Constants.deleteAccountForever, deleteAccountForeverSaga),
  ]
}

export {
  invitesRefresh,
  notificationsRefresh,
  notificationsSave,
  notificationsToggle,
  setAllowDeleteAccount,
  deleteAccountForever,
}

export default settingsSaga
