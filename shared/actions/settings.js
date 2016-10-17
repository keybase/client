// @flow
import * as Constants from '../constants/settings'
import HiddenString from '../util/hidden-string'
import {apiserverGetRpcPromise, apiserverPostRpcPromise, apiserverPostJSONRpcPromise, loginAccountDeleteRpcPromise, accountPassphraseChangeRpcPromise, accountHasServerKeysRpcPromise} from '../constants/types/flow-types'
import {call, put, select, fork, cancel} from 'redux-saga/effects'
import {routeAppend, navigateUp} from '../actions/router'
import {setDeletedSelf} from '../actions/login'
import {takeEvery, takeLatest, delay} from 'redux-saga'

import type {SagaGenerator} from '../constants/types/saga'
import type {
  DeleteAccountForever,
  Invitation,
  InvitesReclaim,
  InvitesReclaimed,
  InvitesRefresh,
  InvitesSend,
  InvitesSent,
  NotificationsRefresh,
  NotificationsSave,
  NotificationsToggle,
  OnChangeNewPassphrase,
  OnChangeNewPassphraseConfirm,
  OnChangeShowPassphrase,
  OnSubmitNewPassphrase,
  OnUpdatePGPSettings,
  OnUpdatedPGPSettings,
  SetAllowDeleteAccount,
} from '../constants/settings'

function onChangeNewPassphrase (passphrase: HiddenString): OnChangeNewPassphrase {
  return {type: Constants.onChangeNewPassphrase, payload: {passphrase}}
}

function onChangeNewPassphraseConfirm (passphrase: HiddenString): OnChangeNewPassphraseConfirm {
  return {type: Constants.onChangeNewPassphraseConfirm, payload: {passphrase}}
}

function onChangeShowPassphrase (): OnChangeShowPassphrase {
  return {type: Constants.onChangeShowPassphrase, payload: undefined}
}

function onSubmitNewPassphrase (): OnSubmitNewPassphrase {
  return {type: Constants.onSubmitNewPassphrase, payload: undefined}
}

function onUpdatePGPSettings (): OnUpdatePGPSettings {
  return {type: Constants.onUpdatePGPSettings, payload: undefined}
}

function _onUpdatedPGPSettings (hasKeys: boolean): OnUpdatedPGPSettings {
  return {type: Constants.onUpdatedPGPSettings, payload: {hasKeys}}
}

function invitesReclaim (inviteId: string): InvitesReclaim {
  return {type: Constants.invitesReclaim, payload: {inviteId}}
}

function invitesRefresh (): InvitesRefresh {
  return {type: Constants.invitesRefresh, payload: undefined}
}

function invitesSend (email: string, message: ?string): InvitesSend {
  return {type: Constants.invitesSend, payload: {email, message}}
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

function * _onUpdatePGPSettings (): SagaGenerator<any, any> {
  try {
    // $ForceType
    const {hasServerKeys} = yield call(accountHasServerKeysRpcPromise)
    yield put(_onUpdatedPGPSettings(hasServerKeys))
  } catch (error) {
    yield put({type: Constants.onUpdatePassphraseError, payload: {error: error.message}})
  }
}

function * _onSubmitNewPassphrase (): SagaGenerator<any, any> {
  try {
    // $ForceType
    const {newPassphrase, newPassphraseConfirm} = yield select(state => state.settings.passphrase)
    if (newPassphrase.stringValue() !== newPassphraseConfirm.stringValue()) {
      yield put({type: Constants.onUpdatePassphraseError, payload: {error: "Passphrases don't match"}})
      return
    }
    yield call(accountPassphraseChangeRpcPromise, {
      param: {
        oldPassphrase: '',
        passphrase: newPassphrase.stringValue(),
        force: true,
      },
    })
    yield put(navigateUp())
  } catch (error) {
    yield put({type: Constants.onUpdatePassphraseError, payload: {error: error.message}})
  }
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

function * reclaimInviteSaga (invitesReclaimAction: InvitesReclaim): SagaGenerator<any, any> {
  const {inviteId} = invitesReclaimAction.payload
  try {
    yield call(apiserverPostRpcPromise, {
      param: {
        endpoint: 'cancel_invitation',
        args: [{key: 'invitation_id', value: inviteId}],
      },
    })
    yield put(({
      type: Constants.invitesReclaimed,
      payload: undefined,
    }: InvitesReclaimed))
  } catch (e) {
    console.warn('Error reclaiming an invite:', e)
    yield put(({
      type: Constants.invitesReclaimed,
      payload: {errorText: e.desc + e.name, errorObj: e},
      error: true,
    }: InvitesReclaimed))
  }
  yield put(invitesRefresh())
}

function * refreshInvitesSaga (): SagaGenerator<any, any> {
  try {
    const json: ?{body: string} = yield call(apiserverGetRpcPromise, {
      param: {
        endpoint: 'invitations_sent',
        args: [],
      },
    })

    const results: {
      invitations: Array<{
        assertion: ?string,
        ctime: number,
        email: string,
        invitation_id: string,
        short_code: string,
        type: string,
        uid: string,
        username: string,
      }>,
    } = JSON.parse(json && json.body || '')

    const acceptedInvites = []
    const pendingInvites = []

    results.invitations.forEach(i => {
      const invite: Invitation = {
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
        acceptedInvites,
        pendingInvites,
      },
    })
  } catch (err) {
    // TODO hook into global error handler
    console.error(err)
  }
}

function * sendInviteSaga (invitesSendAction: InvitesSend): SagaGenerator<any, any> {
  const {email, message} = invitesSendAction.payload
  const args = [{key: 'email', value: email}]
  if (message) {
    args.push({key: 'invitation_message', value: message})
  }
  try {
    const response: ?{body: string} = yield call(apiserverPostRpcPromise, {
      param: {
        endpoint: 'send_invitation',
        args,
      },
    })
    if (response) {
      const parsedBody = JSON.parse(response.body)
      const invitationId = parsedBody.invitation_id.slice(0, 10)
      const link = 'keybase.io/inv/' + invitationId
      yield put(({
        type: Constants.invitesSent,
        payload: {email, invitationId},
      }: InvitesSent))
      yield put(routeAppend({
        path: 'inviteSent',
        props: {email, link},
      }))
    }
  } catch (e) {
    console.warn('Error sending an invite:', e)
    yield put(({
      type: Constants.invitesSent,
      payload: {errorText: e.desc + e.name, errorObj: e},
      error: true,
    }: InvitesSent))
  }
  yield put(invitesRefresh())
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
    takeEvery(Constants.invitesReclaim, reclaimInviteSaga),
    takeLatest(Constants.invitesRefresh, refreshInvitesSaga),
    takeEvery(Constants.invitesSend, sendInviteSaga),
    takeLatest(Constants.notificationsRefresh, refreshNotificationsSaga),
    takeLatest(Constants.notificationsSave, saveNotificationsSaga),
    takeLatest(Constants.deleteAccountForever, deleteAccountForeverSaga),
    takeEvery(Constants.onSubmitNewPassphrase, _onSubmitNewPassphrase),
    takeEvery(Constants.onUpdatePGPSettings, _onUpdatePGPSettings),
  ]
}

export {
  deleteAccountForever,
  invitesReclaim,
  invitesRefresh,
  invitesSend,
  notificationsRefresh,
  notificationsSave,
  notificationsToggle,
  onChangeNewPassphrase,
  onChangeNewPassphraseConfirm,
  onChangeShowPassphrase,
  onSubmitNewPassphrase,
  onUpdatePGPSettings,
  setAllowDeleteAccount,
}

export default settingsSaga
