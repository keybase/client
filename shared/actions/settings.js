// @flow
import * as Constants from '../constants/settings'
import HiddenString from '../util/hidden-string'
import {
  apiserverGetWithSessionRpcPromise,
  apiserverPostRpcPromise,
  apiserverPostJSONRpcPromise,
  loginAccountDeleteRpcPromise,
  accountEmailChangeRpcPromise,
  accountPassphraseChangeRpcPromise,
  accountHasServerKeysRpcPromise,
  userLoadMySettingsRpcPromise,
} from '../constants/types/flow-types'
import {call, put, select, fork, cancel} from 'redux-saga/effects'
import {mapValues} from 'lodash'
import {navigateAppend, navigateUp} from '../actions/route-tree'
import {setDeletedSelf} from '../actions/login/creators'
import {delay} from 'redux-saga'
import {safeTakeEvery, safeTakeLatest} from '../util/saga'

import type {
  DeleteAccountForever,
  Invitation,
  InvitesReclaim,
  InvitesReclaimed,
  InvitesRefresh,
  InvitesSend,
  InvitesSent,
  LoadSettings,
  NotificationsRefresh,
  NotificationsSave,
  NotificationsToggle,
  OnChangeNewEmail,
  OnChangeNewPassphrase,
  OnChangeNewPassphraseConfirm,
  OnChangeShowPassphrase,
  OnSubmitNewEmail,
  OnSubmitNewPassphrase,
  OnUpdatePGPSettings,
  OnUpdatedPGPSettings,
  SetAllowDeleteAccount,
} from '../constants/settings'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

function onChangeNewPassphrase(passphrase: HiddenString): OnChangeNewPassphrase {
  return {type: Constants.onChangeNewPassphrase, payload: {passphrase}}
}

function onChangeNewPassphraseConfirm(passphrase: HiddenString): OnChangeNewPassphraseConfirm {
  return {type: Constants.onChangeNewPassphraseConfirm, payload: {passphrase}}
}

function onChangeShowPassphrase(): OnChangeShowPassphrase {
  return {type: Constants.onChangeShowPassphrase, payload: undefined}
}

function onSubmitNewPassphrase(): OnSubmitNewPassphrase {
  return {type: Constants.onSubmitNewPassphrase, payload: undefined}
}

function onChangeNewEmail(email: string): OnChangeNewEmail {
  return {type: Constants.onChangeNewEmail, payload: {email}}
}

function onSubmitNewEmail(): OnSubmitNewEmail {
  return {type: Constants.onSubmitNewEmail, payload: undefined}
}

function onUpdatePGPSettings(): OnUpdatePGPSettings {
  return {type: Constants.onUpdatePGPSettings, payload: undefined}
}

function _onUpdatedPGPSettings(hasKeys: boolean): OnUpdatedPGPSettings {
  return {type: Constants.onUpdatedPGPSettings, payload: {hasKeys}}
}

function invitesReclaim(inviteId: string): InvitesReclaim {
  return {type: Constants.invitesReclaim, payload: {inviteId}}
}

function invitesRefresh(): InvitesRefresh {
  return {type: Constants.invitesRefresh, payload: undefined}
}

function invitesSend(email: string, message: ?string): InvitesSend {
  return {type: Constants.invitesSend, payload: {email, message}}
}

function notificationsRefresh(): NotificationsRefresh {
  return {type: Constants.notificationsRefresh, payload: undefined}
}

function notificationsSave(): NotificationsSave {
  return {type: Constants.notificationsSave, payload: undefined}
}

function notificationsToggle(group?: string, name?: string): NotificationsToggle {
  return {type: Constants.notificationsToggle, payload: {group, name}}
}

function setAllowDeleteAccount(allow: boolean): SetAllowDeleteAccount {
  return {type: Constants.setAllowDeleteAccount, payload: allow}
}

function deleteAccountForever(): DeleteAccountForever {
  return {type: Constants.deleteAccountForever, payload: undefined}
}

function loadSettings(): LoadSettings {
  return {type: Constants.loadSettings, payload: undefined}
}

function* _onUpdatePGPSettings(): SagaGenerator<any, any> {
  try {
    const {hasServerKeys} = yield call(accountHasServerKeysRpcPromise)
    yield put(_onUpdatedPGPSettings(hasServerKeys))
  } catch (error) {
    yield put({type: Constants.onUpdatePassphraseError, payload: {error}})
  }
}

function* _onSubmitNewEmail(): SagaGenerator<any, any> {
  try {
    yield put(Constants.waiting(true))

    const newEmailSelector = ({settings: {email: {newEmail}}}: TypedState) => newEmail
    const newEmail: string = (yield select(newEmailSelector): any)
    yield call(accountEmailChangeRpcPromise, {
      param: {
        newEmail,
      },
    })
    yield put(loadSettings())
    yield put(navigateUp())
  } catch (error) {
    yield put({type: Constants.onUpdateEmailError, payload: {error}})
  } finally {
    yield put(Constants.waiting(false))
  }
}

function* _onSubmitNewPassphrase(): SagaGenerator<any, any> {
  try {
    yield put(Constants.waiting(true))

    const selector = (state: TypedState) => state.settings.passphrase
    const {newPassphrase, newPassphraseConfirm} = (yield select(selector): any)
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
    yield put({type: Constants.onUpdatePassphraseError, payload: {error}})
  } finally {
    yield put(Constants.waiting(false))
  }
}

function* saveNotificationsSaga(): SagaGenerator<any, any> {
  try {
    yield put(Constants.waiting(true))
    const current = yield select(state => state.settings.notifications)

    if (!current || !current.emailSettings) {
      throw new Error('No notifications loaded yet')
    }

    const emailSettings = current.emailSettings.map(s => ({
      key: `${s.name}|email`,
      value: s.subscribed ? '1' : '0',
    }))
    const pushSettings = current.pushSettings.map(s => ({
      key: `${s.name}|app_push`,
      value: s.subscribed ? '1' : '0',
    }))
    const unsub = {
      key: `unsub|email`,
      value: current.unsubscribedFromAll ? '1' : '0',
    }
    const JSONPayload = emailSettings.concat(pushSettings).concat(unsub)
    console.warn('JSONPayload', JSONPayload)
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
  } finally {
    yield put(Constants.waiting(false))
  }
}

function* reclaimInviteSaga(invitesReclaimAction: InvitesReclaim): SagaGenerator<any, any> {
  const {inviteId} = invitesReclaimAction.payload
  try {
    yield call(apiserverPostRpcPromise, {
      param: {
        endpoint: 'cancel_invitation',
        args: [{key: 'invitation_id', value: inviteId}],
      },
    })
    yield put(
      ({
        type: Constants.invitesReclaimed,
        payload: undefined,
      }: InvitesReclaimed)
    )
  } catch (e) {
    console.warn('Error reclaiming an invite:', e)
    yield put(
      ({
        type: Constants.invitesReclaimed,
        payload: {errorText: e.desc + e.name, errorObj: e},
        error: true,
      }: InvitesReclaimed)
    )
  }
  yield put(invitesRefresh())
}

function* refreshInvitesSaga(): SagaGenerator<any, any> {
  const json: ?{body: string} = yield call(apiserverGetWithSessionRpcPromise, {
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
  } = JSON.parse((json && json.body) || '')

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
}

function* sendInviteSaga(invitesSendAction: InvitesSend): SagaGenerator<any, any> {
  try {
    yield put(Constants.waiting(true))

    const {email, message} = invitesSendAction.payload
    const args = [{key: 'email', value: email}]
    if (message) {
      args.push({key: 'invitation_message', value: message})
    }

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
      yield put(
        ({
          type: Constants.invitesSent,
          payload: {email, invitationId},
        }: InvitesSent)
      )
      // TODO: if the user changes their route while working, this may lead to an invalid route
      yield put(
        navigateAppend([
          {
            selected: 'inviteSent',
            props: {
              email,
              link,
            },
          },
        ])
      )
    }
  } catch (e) {
    console.warn('Error sending an invite:', e)
    yield put(
      ({
        type: Constants.invitesSent,
        payload: {error: e},
        error: true,
      }: InvitesSent)
    )
  } finally {
    yield put(Constants.waiting(false))
  }
  yield put(invitesRefresh())
}

function* refreshNotificationsSaga(): SagaGenerator<any, any> {
  // If the rpc is fast don't clear it out first
  const delayThenEmptyTask = yield fork(function*() {
    yield call(delay, 500)
    yield put({
      payload: {
        email: null,
      },
      type: Constants.notificationsRefreshed,
    })
  })

  const json: ?{body: string} = yield call(apiserverGetWithSessionRpcPromise, {
    param: {
      endpoint: 'account/subscriptions',
      args: [],
    },
  })

  yield cancel(delayThenEmptyTask)

  const results: {
    notifications: Array<{
      settings: Array<{
        name: string,
        description: string,
        subscribed: boolean,
      }>,
      unsub: boolean,
    }>,
  } = JSON.parse((json && json.body) || '')

  const settingsToPayload = s =>
    ({
      name: s.name,
      subscribed: s.subscribed,
      description: s.description,
    } || [])

  console.warn('foo')
  console.warn(results.notifications)
  const groups = results.notifications
  const payload = mapValues(groups, group => {
    console.warn('in map', group)
    return group.settings.map(settingsToPayload)
  })
  console.warn('payload is', payload)
  yield put({
    type: Constants.notificationsRefreshed,
    payload: {
      ...payload,
    },
  })
}

function* deleteAccountForeverSaga(): SagaGenerator<any, any> {
  const username = yield select(state => state.config.username)
  const allowDeleteAccount = yield select(state => state.settings.allowDeleteAccount)

  if (!username) {
    throw new Error('Unable to delete account: no username set')
  }

  if (!allowDeleteAccount) {
    throw new Error('Account deletion failsafe was not disengaged. This is a bug!')
  }

  yield call(loginAccountDeleteRpcPromise)
  yield put(setDeletedSelf(username))
}

function* loadSettingsSaga(): SagaGenerator<any, any> {
  const userSettings = yield call(userLoadMySettingsRpcPromise)
  yield put({type: Constants.loadedSettings, payload: userSettings})
}

function* settingsSaga(): SagaGenerator<any, any> {
  yield safeTakeEvery(Constants.invitesReclaim, reclaimInviteSaga)
  yield safeTakeLatest(Constants.invitesRefresh, refreshInvitesSaga)
  yield safeTakeEvery(Constants.invitesSend, sendInviteSaga)
  yield safeTakeLatest(Constants.notificationsRefresh, refreshNotificationsSaga)
  yield safeTakeLatest(Constants.notificationsSave, saveNotificationsSaga)
  yield safeTakeLatest(Constants.deleteAccountForever, deleteAccountForeverSaga)
  yield safeTakeLatest(Constants.loadSettings, loadSettingsSaga)
  yield safeTakeEvery(Constants.onSubmitNewEmail, _onSubmitNewEmail)
  yield safeTakeEvery(Constants.onSubmitNewPassphrase, _onSubmitNewPassphrase)
  yield safeTakeEvery(Constants.onUpdatePGPSettings, _onUpdatePGPSettings)
}

export {
  deleteAccountForever,
  invitesReclaim,
  invitesRefresh,
  invitesSend,
  notificationsRefresh,
  notificationsSave,
  notificationsToggle,
  onChangeNewEmail,
  onChangeNewPassphrase,
  onChangeNewPassphraseConfirm,
  onChangeShowPassphrase,
  onSubmitNewEmail,
  onSubmitNewPassphrase,
  onUpdatePGPSettings,
  setAllowDeleteAccount,
  loadSettings,
}

export default settingsSaga
