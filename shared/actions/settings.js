// @flow
import * as ChatTypes from '../constants/types/flow-types-chat'
import * as Constants from '../constants/settings'
import * as LoginGen from '../actions/login-gen'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import HiddenString from '../util/hidden-string'
import mapValues from 'lodash/mapValues'
import trim from 'lodash/trim'
import {delay} from 'redux-saga'
import {navigateAppend, navigateUp} from '../actions/route-tree'
import {type TypedState} from '../constants/reducer'

function onChangeNewPassphrase(passphrase: HiddenString): Constants.OnChangeNewPassphrase {
  return {type: Constants.onChangeNewPassphrase, payload: {passphrase}}
}

function onChangeNewPassphraseConfirm(passphrase: HiddenString): Constants.OnChangeNewPassphraseConfirm {
  return {type: Constants.onChangeNewPassphraseConfirm, payload: {passphrase}}
}

function onChangeShowPassphrase(): Constants.OnChangeShowPassphrase {
  return {type: Constants.onChangeShowPassphrase, payload: undefined}
}

function onSubmitNewPassphrase(): Constants.OnSubmitNewPassphrase {
  return {type: Constants.onSubmitNewPassphrase, payload: undefined}
}

function onChangeNewEmail(email: string): Constants.OnChangeNewEmail {
  return {type: Constants.onChangeNewEmail, payload: {email}}
}

function onSubmitNewEmail(): Constants.OnSubmitNewEmail {
  return {type: Constants.onSubmitNewEmail, payload: undefined}
}

function onUpdatePGPSettings(): Constants.OnUpdatePGPSettings {
  return {type: Constants.onUpdatePGPSettings, payload: undefined}
}

function _onUpdatedPGPSettings(hasKeys: boolean): Constants.OnUpdatedPGPSettings {
  return {type: Constants.onUpdatedPGPSettings, payload: {hasKeys}}
}

function invitesReclaim(inviteId: string): Constants.InvitesReclaim {
  return {type: Constants.invitesReclaim, payload: {inviteId}}
}

function invitesRefresh(): Constants.InvitesRefresh {
  return {type: Constants.invitesRefresh, payload: undefined}
}

function invitesSend(email: string, message: ?string): Constants.InvitesSend {
  return {type: Constants.invitesSend, payload: {email, message}}
}

function notificationsRefresh(): Constants.NotificationsRefresh {
  return {type: Constants.notificationsRefresh, payload: undefined}
}

function notificationsToggle(group: string, name?: string): Constants.NotificationsToggle {
  return {type: Constants.notificationsToggle, payload: {group, name}}
}

function setAllowDeleteAccount(allow: boolean): Constants.SetAllowDeleteAccount {
  return {type: Constants.setAllowDeleteAccount, payload: allow}
}

function dbNuke(): Constants.DBNuke {
  return {type: Constants.dbNuke, payload: undefined}
}

function deleteAccountForever(): Constants.DeleteAccountForever {
  return {type: Constants.deleteAccountForever, payload: undefined}
}

function loadSettings(): Constants.LoadSettings {
  return {type: Constants.loadSettings, payload: undefined}
}

function* _onUpdatePGPSettings(): Saga.SagaGenerator<any, any> {
  try {
    const {hasServerKeys} = yield Saga.call(RPCTypes.accountHasServerKeysRpcPromise)
    yield Saga.put(_onUpdatedPGPSettings(hasServerKeys))
  } catch (error) {
    yield Saga.put({type: Constants.onUpdatePassphraseError, payload: {error}})
  }
}

function* _onSubmitNewEmail(): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put(Constants.waiting(true))

    const newEmailSelector = ({settings: {email: {newEmail}}}: TypedState) => newEmail
    const newEmail: string = yield Saga.select(newEmailSelector)
    yield Saga.call(RPCTypes.accountEmailChangeRpcPromise, {
      param: {
        newEmail,
      },
    })
    yield Saga.put(loadSettings())
    yield Saga.put(navigateUp())
  } catch (error) {
    yield Saga.put({type: Constants.onUpdateEmailError, payload: {error}})
  } finally {
    yield Saga.put(Constants.waiting(false))
  }
}

function* _onSubmitNewPassphrase(): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put(Constants.waiting(true))

    const selector = (state: TypedState) => state.settings.passphrase
    const {newPassphrase, newPassphraseConfirm} = yield Saga.select(selector)
    if (newPassphrase.stringValue() !== newPassphraseConfirm.stringValue()) {
      yield Saga.put({
        type: Constants.onUpdatePassphraseError,
        payload: {error: new Error("Passphrases don't match")},
      })
      return
    }
    yield Saga.call(RPCTypes.accountPassphraseChangeRpcPromise, {
      param: {
        oldPassphrase: '',
        passphrase: newPassphrase.stringValue(),
        force: true,
      },
    })
    yield Saga.put(navigateUp())
  } catch (error) {
    yield Saga.put({type: Constants.onUpdatePassphraseError, payload: {error}})
  } finally {
    yield Saga.put(Constants.waiting(false))
  }
}

function* toggleNotificationsSaga(): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put(Constants.waiting(true))
    const current = yield Saga.select((state: TypedState) => state.settings.notifications)

    if (!current || !current.groups.email) {
      throw new Error('No notifications loaded yet')
    }

    let JSONPayload = []
    let chatGlobalArg = {}
    for (const groupName in current.groups) {
      const group = current.groups[groupName]
      if (groupName === Constants.securityGroup) {
        // Special case this since it will go to chat settings endpoint
        for (const key in group.settings) {
          const setting = group.settings[key]
          chatGlobalArg[`${ChatTypes.commonGlobalAppNotificationSetting[setting.name]}`] = setting.subscribed
        }
      } else {
        for (const key in group.settings) {
          const setting = group.settings[key]
          JSONPayload.push({
            key: `${setting.name}|${groupName}`,
            value: setting.subscribed ? '1' : '0',
          })
        }
        JSONPayload.push({
          key: `unsub|${groupName}`,
          value: group.unsubscribedFromAll ? '1' : '0',
        })
      }
    }

    const [result] = yield Saga.all([
      Saga.call(RPCTypes.apiserverPostJSONRpcPromise, {
        param: {
          endpoint: 'account/subscribe',
          args: [],
          JSONPayload,
        },
      }),
      Saga.call(ChatTypes.localSetGlobalAppNotificationSettingsLocalRpcPromise, {
        param: {
          settings: {
            ...chatGlobalArg,
          },
        },
      }),
    ])
    if (!result || !result.body || JSON.parse(result.body).status.code !== 0) {
      throw new Error(`Invalid response ${result || '(no result)'}`)
    }

    yield Saga.put({
      type: Constants.notificationsSaved,
      payload: undefined,
    })
  } finally {
    yield Saga.put(Constants.waiting(false))
  }
}

function* reclaimInviteSaga(invitesReclaimAction: Constants.InvitesReclaim): Saga.SagaGenerator<any, any> {
  const {inviteId} = invitesReclaimAction.payload
  try {
    yield Saga.call(RPCTypes.apiserverPostRpcPromise, {
      param: {
        endpoint: 'cancel_invitation',
        args: [{key: 'invitation_id', value: inviteId}],
      },
    })
    yield Saga.put(
      ({
        type: Constants.invitesReclaimed,
        payload: undefined,
      }: Constants.InvitesReclaimed)
    )
  } catch (e) {
    console.warn('Error reclaiming an invite:', e)
    yield Saga.put(
      ({
        type: Constants.invitesReclaimed,
        payload: {errorText: e.desc + e.name, errorObj: e},
        error: true,
      }: Constants.InvitesReclaimed)
    )
  }
  yield Saga.put(invitesRefresh())
}

function* refreshInvitesSaga(): Saga.SagaGenerator<any, any> {
  const json: ?{body: string} = yield Saga.call(RPCTypes.apiserverGetWithSessionRpcPromise, {
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
    const invite: Constants.Invitation = {
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
  yield Saga.put({
    type: Constants.invitesRefreshed,
    payload: {
      acceptedInvites,
      pendingInvites,
    },
  })
}

function* sendInviteSaga(invitesSendAction: Constants.InvitesSend): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put(Constants.waiting(true))

    const {email, message} = invitesSendAction.payload
    const args = [{key: 'email', value: trim(email)}]
    if (message) {
      args.push({key: 'invitation_message', value: message})
    }

    const response: ?{body: string} = yield Saga.call(RPCTypes.apiserverPostRpcPromise, {
      param: {
        endpoint: 'send_invitation',
        args,
      },
    })
    if (response) {
      const parsedBody = JSON.parse(response.body)
      const invitationId = parsedBody.invitation_id.slice(0, 10)
      const link = 'keybase.io/inv/' + invitationId
      yield Saga.put(
        ({
          type: Constants.invitesSent,
          payload: {email, invitationId},
        }: Constants.InvitesSent)
      )
      // TODO: if the user changes their route while working, this may lead to an invalid route
      yield Saga.put(
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
    yield Saga.put(
      ({
        type: Constants.invitesSent,
        payload: {error: e},
        error: true,
      }: Constants.InvitesSent)
    )
  } finally {
    yield Saga.put(Constants.waiting(false))
  }
  yield Saga.put(invitesRefresh())
}

function* refreshNotificationsSaga(): Saga.SagaGenerator<any, any> {
  // If the rpc is fast don't clear it out first
  const delayThenEmptyTask = yield Saga.fork(function*(): Generator<any, void, any> {
    yield Saga.call(delay, 500)
    yield Saga.put({
      type: Constants.notificationsRefreshed,
      payload: {
        groups: null,
      },
    })
  })

  const [
    json: ?{body: string},
    chatGlobalSettings: ChatTypes.GlobalAppNotificationSettings,
  ] = yield Saga.all([
    Saga.call(RPCTypes.apiserverGetWithSessionRpcPromise, {
      param: {
        endpoint: 'account/subscriptions',
        args: [],
      },
    }),
    Saga.call(ChatTypes.localGetGlobalAppNotificationSettingsLocalRpcPromise, {}),
  ])
  yield Saga.cancel(delayThenEmptyTask)

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
      security: {
        settings: Array<{
          name: string,
          description: string,
          subscribed: boolean,
        }>,
        unsub: boolean,
      },
    },
  } = JSON.parse((json && json.body) || '')
  // Add security group extra since it does not come from API endpoint
  results.notifications[Constants.securityGroup] = {
    settings: [
      {
        name: 'plaintextmobile',
        description: 'Display mobile plaintext notifications',
        subscribed: chatGlobalSettings.settings[
          `${ChatTypes.commonGlobalAppNotificationSetting.plaintextmobile}`
        ],
      },
    ],
    unsub: false,
  }

  const settingsToPayload = s =>
    ({
      name: s.name,
      subscribed: s.subscribed,
      description: s.description,
    } || [])

  const groups = results.notifications
  const payload = mapValues(groups, group => ({
    settings: group.settings.map(settingsToPayload),
    unsub: group.unsub,
  }))

  yield Saga.put({
    type: Constants.notificationsRefreshed,
    payload,
  })
}

function* dbNukeSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.call(RPCTypes.ctlDbNukeRpcPromise)
}

function* deleteAccountForeverSaga(): Saga.SagaGenerator<any, any> {
  const username = yield Saga.select((state: TypedState) => state.config.username)
  const allowDeleteAccount = yield Saga.select((state: TypedState) => state.settings.allowDeleteAccount)

  if (!username) {
    throw new Error('Unable to delete account: no username set')
  }

  if (!allowDeleteAccount) {
    throw new Error('Account deletion failsafe was not disengaged. This is a bug!')
  }

  yield Saga.call(RPCTypes.loginAccountDeleteRpcPromise)
  yield Saga.put(LoginGen.createSetDeletedSelf({deletedUsername: username}))
}

function* loadSettingsSaga(): Saga.SagaGenerator<any, any> {
  const userSettings = yield Saga.call(RPCTypes.userLoadMySettingsRpcPromise)
  yield Saga.put({type: Constants.loadedSettings, payload: userSettings})
}

function* settingsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(Constants.invitesReclaim, reclaimInviteSaga)
  yield Saga.safeTakeLatest(Constants.invitesRefresh, refreshInvitesSaga)
  yield Saga.safeTakeEvery(Constants.invitesSend, sendInviteSaga)
  yield Saga.safeTakeLatest(Constants.notificationsRefresh, refreshNotificationsSaga)
  yield Saga.safeTakeLatest(Constants.notificationsToggle, toggleNotificationsSaga)
  yield Saga.safeTakeLatest(Constants.dbNuke, dbNukeSaga)
  yield Saga.safeTakeLatest(Constants.deleteAccountForever, deleteAccountForeverSaga)
  yield Saga.safeTakeLatest(Constants.loadSettings, loadSettingsSaga)
  yield Saga.safeTakeEvery(Constants.onSubmitNewEmail, _onSubmitNewEmail)
  yield Saga.safeTakeEvery(Constants.onSubmitNewPassphrase, _onSubmitNewPassphrase)
  yield Saga.safeTakeEvery(Constants.onUpdatePGPSettings, _onUpdatePGPSettings)
}

export {
  dbNuke,
  deleteAccountForever,
  invitesReclaim,
  invitesRefresh,
  invitesSend,
  notificationsRefresh,
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
