// @flow
// TODO use WaitingGen which will allow more chainAction handlers
import logger from '../logger'
import * as I from 'immutable'
import * as ChatTypes from '../constants/types/rpc-chat-gen'
import * as Saga from '../util/saga'
import * as Types from '../constants/types/settings'
import * as Constants from '../constants/settings'
import * as ConfigGen from '../actions/config-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as WaitingGen from '../actions/waiting-gen'
import {mapValues, trim} from 'lodash-es'
import {delay} from 'redux-saga'
import {isAndroidNewerThanN, pprofDir} from '../constants/platform'

const onUpdatePGPSettings = () =>
  RPCTypes.accountHasServerKeysRpcPromise()
    .then(({hasServerKeys}) => SettingsGen.createOnUpdatedPGPSettings({hasKeys: hasServerKeys}))
    .catch(error => SettingsGen.createOnUpdatePasswordError({error}))

function* onSubmitNewEmail(state) {
  try {
    yield Saga.put(SettingsGen.createWaitingForResponse({waiting: true}))
    const newEmail = state.settings.email.newEmail
    yield* Saga.callPromise(RPCTypes.accountEmailChangeRpcPromise, {
      newEmail,
    })
    yield Saga.put(SettingsGen.createLoadSettings())
    yield Saga.put(RouteTreeGen.createNavigateUp())
  } catch (error) {
    yield Saga.put(SettingsGen.createOnUpdateEmailError({error}))
  } finally {
    yield Saga.put(SettingsGen.createWaitingForResponse({waiting: false}))
  }
}

function* onSubmitNewPassword(state, action) {
  try {
    yield Saga.put(SettingsGen.createWaitingForResponse({waiting: true}))
    const {newPassword, newPasswordConfirm} = state.settings.password
    if (newPassword.stringValue() !== newPasswordConfirm.stringValue()) {
      yield Saga.put(SettingsGen.createOnUpdatePasswordError({error: new Error("Passwords don't match")}))
      return
    }
    yield* Saga.callPromise(RPCTypes.accountPassphraseChangeRpcPromise, {
      force: true,
      oldPassphrase: '',
      passphrase: newPassword.stringValue(),
    })
    yield Saga.put(RouteTreeGen.createNavigateUp())
    if (action.payload.thenSignOut) {
      yield Saga.put(ConfigGen.createLogout())
    }
  } catch (error) {
    yield Saga.put(SettingsGen.createOnUpdatePasswordError({error}))
  } finally {
    yield Saga.put(SettingsGen.createWaitingForResponse({waiting: false}))
  }
}

function* toggleNotifications(state) {
  try {
    yield Saga.put(SettingsGen.createWaitingForResponse({waiting: true}))
    const current = state.settings.notifications

    if (!current || !current.groups.get('email')) {
      throw new Error('No notifications loaded yet')
    }

    let JSONPayload = []
    let chatGlobalArg = {}
    current.groups.forEach((group, groupName) => {
      if (groupName === Constants.securityGroup) {
        // Special case this since it will go to chat settings endpoint
        group.settings.forEach(
          setting =>
            (chatGlobalArg[
              `${ChatTypes.commonGlobalAppNotificationSetting[setting.name]}`
            ] = !!setting.subscribed)
        )
      } else {
        group.settings.forEach(setting =>
          JSONPayload.push({
            key: `${setting.name}|${groupName}`,
            value: setting.subscribed ? '1' : '0',
          })
        )
        JSONPayload.push({
          key: `unsub|${groupName}`,
          value: group.unsubscribedFromAll ? '1' : '0',
        })
      }
    })

    const [result] = yield Saga.all([
      Saga.callUntyped(RPCTypes.apiserverPostJSONRpcPromise, {
        JSONPayload,
        args: [],
        endpoint: 'account/subscribe',
      }),
      Saga.callUntyped(ChatTypes.localSetGlobalAppNotificationSettingsLocalRpcPromise, {
        settings: {
          ...chatGlobalArg,
        },
      }),
    ])
    if (!result || !result.body || JSON.parse(result.body).status.code !== 0) {
      throw new Error(`Invalid response ${result || '(no result)'}`)
    }

    yield Saga.put(SettingsGen.createNotificationsSaved())
  } finally {
    yield Saga.put(SettingsGen.createWaitingForResponse({waiting: false}))
  }
}

const reclaimInvite = (_, action) =>
  RPCTypes.apiserverPostRpcPromise({
    args: [{key: 'invitation_id', value: action.payload.inviteId}],
    endpoint: 'cancel_invitation',
  })
    .then(() => [SettingsGen.createInvitesReclaimed(), SettingsGen.createInvitesRefresh()])
    .catch(e => {
      logger.warn('Error reclaiming an invite:', e)
      return [
        SettingsGen.createInvitesReclaimedError({errorText: e.desc + e.name}),
        SettingsGen.createInvitesRefresh(),
      ]
    })

const refreshInvites = () =>
  RPCTypes.apiserverGetWithSessionRpcPromise({
    args: [],
    endpoint: 'invitations_sent',
  }).then(json => {
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
      const invite: Types.Invitation = {
        created: i.ctime,
        email: i.email,
        id: i.invitation_id,
        key: i.invitation_id,
        // type will get filled in later
        type: '',
        uid: i.uid,
        // First ten chars of invite code is sufficient
        url: 'keybase.io/inv/' + i.invitation_id.slice(0, 10),
        username: i.username,
      }
      // Here's an algorithm for interpreting invitation entries.
      // 1: username+uid => accepted invite, else
      // 2: email set => pending email invite, else
      // 3: pending invitation code invite
      if (i.username && i.uid) {
        invite.type = 'accepted'
        acceptedInvites.push(invite)
      } else {
        invite.type = 'pending'
        pendingInvites.push(invite)
      }
    })
    return SettingsGen.createInvitesRefreshed({
      invites: {
        acceptedInvites: I.List(acceptedInvites),
        error: null,
        pendingInvites: I.List(pendingInvites),
      },
    })
  })

function* sendInvite(_, action) {
  try {
    yield Saga.put(SettingsGen.createWaitingForResponse({waiting: true}))
    const {email, message} = action.payload
    const args = [{key: 'email', value: trim(email)}]
    if (message) {
      args.push({key: 'invitation_message', value: message})
    }

    const response = yield* Saga.callPromise(RPCTypes.apiserverPostRpcPromise, {
      args,
      endpoint: 'send_invitation',
    })
    if (response) {
      const parsedBody = JSON.parse(response.body)
      const invitationId = parsedBody.invitation_id.slice(0, 10)
      const link = 'keybase.io/inv/' + invitationId
      yield Saga.put(
        SettingsGen.createInvitesSent()
        // {
        // NOT actually used... TODO why is this like this
        // email,
        // invitationId,
        // }
      )
      // TODO: if the user changes their route while working, this may lead to an invalid route
      yield Saga.put(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {
                email,
                link,
              },
              selected: 'inviteSent',
            },
          ],
        })
      )
    }
  } catch (e) {
    logger.warn('Error sending an invite:', e)
    yield Saga.put(SettingsGen.createInvitesSentError({error: e}))
  } finally {
    yield Saga.put(SettingsGen.createWaitingForResponse({waiting: false}))
  }
  yield Saga.put(SettingsGen.createInvitesRefresh())
}

function* refreshNotifications() {
  // If the rpc is fast don't clear it out first
  const delayThenEmptyTask = yield Saga._fork(function*(): Generator<any, void, any> {
    yield Saga.callUntyped(delay, 500)
    yield Saga.put(
      SettingsGen.createNotificationsRefreshed({
        notifications: I.Map(),
      })
    )
  })

  let body = ''
  let chatGlobalSettings: ChatTypes.GlobalAppNotificationSettings

  try {
    const [
      json: ?{body: string},
      _chatGlobalSettings: ChatTypes.GlobalAppNotificationSettings,
    ] = yield Saga.all([
      Saga.callUntyped(
        RPCTypes.apiserverGetWithSessionRpcPromise,
        {
          args: [],
          endpoint: 'account/subscriptions',
        },
        Constants.refreshNotificationsWaitingKey
      ),
      Saga.callUntyped(
        ChatTypes.localGetGlobalAppNotificationSettingsLocalRpcPromise,
        undefined,
        Constants.refreshNotificationsWaitingKey
      ),
    ])
    if (json) {
      body = json.body
    }
    chatGlobalSettings = _chatGlobalSettings
  } catch (err) {
    // No need to throw black bars -- handled by Reloadable.
    logger.warn(`Error getting notification settings: ${err.desc}`)
    return
  }

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
  } = JSON.parse(body)
  // Add security group extra since it does not come from API endpoint
  results.notifications[Constants.securityGroup] = {
    settings: [
      {
        description: 'Display mobile plaintext notifications',
        name: 'plaintextmobile',
        subscribed: !!chatGlobalSettings.settings[
          `${ChatTypes.commonGlobalAppNotificationSetting.plaintextmobile}`
        ],
      },
      {
        description: 'Disable sending/receiving typing notifications',
        name: 'disabletyping',
        subscribed: !!chatGlobalSettings.settings[
          `${ChatTypes.commonGlobalAppNotificationSetting.disabletyping}`
        ],
      },
      ...(isAndroidNewerThanN
        ? []
        : [
            {
              description: 'Use mobile system default notification sound',
              name: 'defaultsoundmobile',
              subscribed: !!chatGlobalSettings.settings[
                `${ChatTypes.commonGlobalAppNotificationSetting.defaultsoundmobile}`
              ],
            },
          ]),
    ],
    unsub: false,
  }

  const settingsToPayload = s =>
    ({
      description: s.description,
      name: s.name,
      subscribed: s.subscribed,
    } || [])

  const groups = results.notifications
  const notifications = mapValues(groups, group => ({
    settings: group.settings.map(settingsToPayload),
    unsub: group.unsub,
  }))

  yield Saga.put(
    SettingsGen.createNotificationsRefreshed({
      notifications: I.Map(notifications),
    })
  )
}

const dbNuke = () => RPCTypes.ctlDbNukeRpcPromise()

const deleteAccountForever = (state, action) => {
  const username = state.config.username
  const allowDeleteAccount = state.settings.allowDeleteAccount

  if (!username) {
    throw new Error('Unable to delete account: no username set')
  }

  if (!allowDeleteAccount) {
    throw new Error('Account deletion failsafe was not disengaged. This is a bug!')
  }

  return RPCTypes.loginAccountDeleteRpcPromise().then(() =>
    ConfigGen.createSetDeletedSelf({deletedUsername: username})
  )
}

const addEmail = (_, action) =>
  RPCTypes.emailsAddEmailRpcPromise({
    email: action.payload.email,
    visibility: action.payload.searchable
      ? RPCTypes.commonIdentityVisibility.public
      : RPCTypes.commonIdentityVisibility.private,
  })

const deleteEmail = (_, action) => RPCTypes.emailsDeleteEmailRpcPromise({email: action.payload.email})

const loadEmails = () =>
  RPCTypes.emailsGetEmailsRpcPromise().then(
    emails =>
      emails &&
      SettingsGen.createLoadedEmails({
        emails: I.List(emails.map(row => Constants.makeEmailRow(row))),
      })
  )

const sendVerificationEmail = (_, action) =>
  RPCTypes.emailsSendVerificationEmailRpcPromise({
    email: action.payload.email,
  })

const setPrimaryEmail = (_, action) => RPCTypes.emailsSetPrimaryEmailRpcPromise({email: action.payload.email})

const addPhoneNumber = (_, action) =>
  RPCTypes.phoneNumbersAddPhoneNumberRpcPromise({
    phoneNumber: action.payload.phoneNumber,
    visibility: action.payload.searchable
      ? RPCTypes.commonIdentityVisibility.public
      : RPCTypes.commonIdentityVisibility.private,
  })

const deletePhoneNumber = (_, action) =>
  RPCTypes.phoneNumbersDeletePhoneNumberRpcPromise({phoneNumber: action.payload.phoneNumber})

const verifyPhoneNumber = (_, action) =>
  RPCTypes.phoneNumbersVerifyPhoneNumberRpcPromise({
    code: action.payload.code,
    phoneNumber: action.payload.phoneNumber,
  })

const loadPhoneNumbers = () =>
  RPCTypes.phoneNumbersGetPhoneNumbersRpcPromise().then(
    phoneNumbers =>
      phoneNumbers &&
      SettingsGen.createLoadedPhoneNumbers({
        phoneNumbers: I.List(phoneNumbers.map(row => Constants.makePhoneNumber(row))),
      })
  )

const loadSettings = () =>
  RPCTypes.userLoadMySettingsRpcPromise().then(
    settings =>
      settings.emails &&
      SettingsGen.createLoadedSettings({
        emails: I.List(settings.emails.map(row => Constants.makeEmailRow(row))),
      })
  )

const getRememberPassword = () =>
  RPCTypes.configGetRememberPassphraseRpcPromise().then(remember =>
    SettingsGen.createLoadedRememberPassword({remember})
  )

function* trace(_, action) {
  const durationSeconds = action.payload.durationSeconds
  yield Saga.callUntyped(RPCTypes.pprofLogTraceRpcPromise, {
    logDirForMobile: pprofDir,
    traceDurationSeconds: durationSeconds,
  })
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.traceInProgressKey}))
  yield Saga.delay(durationSeconds * 1000)
  yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.traceInProgressKey}))
}

function* processorProfile(_, action) {
  const durationSeconds = action.payload.durationSeconds
  yield Saga.callUntyped(RPCTypes.pprofLogProcessorProfileRpcPromise, {
    logDirForMobile: pprofDir,
    profileDurationSeconds: durationSeconds,
  })
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.processorProfileInProgressKey}))
  yield Saga.delay(durationSeconds * 1000)
  yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.processorProfileInProgressKey}))
}

const rememberPassword = (_, action) =>
  RPCTypes.configSetRememberPassphraseRpcPromise({remember: action.payload.remember})

const checkPassword = (_, action) =>
  RPCTypes.accountPassphraseCheckRpcPromise(
    {
      passphrase: action.payload.password.stringValue(),
    },
    Constants.checkPasswordWaitingKey
  ).then(res => SettingsGen.createLoadedCheckPassword({checkPasswordIsCorrect: res}))

const loadLockdownMode = state =>
  state.config.loggedIn &&
  RPCTypes.accountGetLockdownModeRpcPromise(undefined, Constants.loadLockdownModeWaitingKey)
    .then((result: RPCTypes.GetLockdownResponse) =>
      SettingsGen.createLoadedLockdownMode({status: result.status})
    )
    .catch(() => SettingsGen.createLoadedLockdownMode({status: null}))

const setLockdownMode = (state, action) =>
  state.config.loggedIn &&
  RPCTypes.accountSetLockdownModeRpcPromise(
    {enabled: action.payload.enabled},
    Constants.setLockdownModeWaitingKey
  )
    .then(() => SettingsGen.createLoadedLockdownMode({status: action.payload.enabled}))
    .catch(() => SettingsGen.createLoadLockdownMode())

const unfurlSettingsRefresh = (state, action) =>
  state.config.loggedIn &&
  ChatTypes.localGetUnfurlSettingsRpcPromise(undefined, Constants.chatUnfurlWaitingKey)
    .then((result: ChatTypes.UnfurlSettingsDisplay) =>
      SettingsGen.createUnfurlSettingsRefreshed({
        mode: result.mode,
        whitelist: I.List(result.whitelist || []),
      })
    )
    .catch(() =>
      SettingsGen.createUnfurlSettingsError({
        error: 'Unable to load link preview settings, please try again.',
      })
    )

const unfurlSettingsSaved = (state, action) =>
  state.config.loggedIn &&
  ChatTypes.localSaveUnfurlSettingsRpcPromise(
    {
      mode: action.payload.mode,
      whitelist: action.payload.whitelist.toArray(),
    },
    Constants.chatUnfurlWaitingKey
  )
    .then(() => SettingsGen.createUnfurlSettingsRefresh())
    .catch(() =>
      SettingsGen.createUnfurlSettingsError({
        error: 'Unable to save link preview settings, please try again.',
      })
    )

// Once loaded, do not issue this RPC again. This field can only go true ->
// false (never the opposite way), and there are notifications set up when
// this happens.
const loadHasRandomPW = state =>
  state.settings.password.randomPW === null
    ? RPCTypes.userLoadHasRandomPwRpcPromise({forceRepoll: false})
        .then(randomPW => SettingsGen.createLoadedHasRandomPw({randomPW}))
        .catch(e => logger.warn('Error loading hasRandomPW:', e.message))
    : null

// Mark that we are not randomPW anymore if we got a password change.
const passwordChanged = () => SettingsGen.createLoadedHasRandomPw({randomPW: false})

function* settingsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<SettingsGen.InvitesReclaimPayload>(SettingsGen.invitesReclaim, reclaimInvite)
  yield* Saga.chainAction<SettingsGen.InvitesRefreshPayload>(SettingsGen.invitesRefresh, refreshInvites)
  yield* Saga.chainGenerator<SettingsGen.InvitesSendPayload>(SettingsGen.invitesSend, sendInvite)
  yield* Saga.chainGenerator<SettingsGen.NotificationsRefreshPayload>(
    SettingsGen.notificationsRefresh,
    refreshNotifications
  )
  yield* Saga.chainGenerator<SettingsGen.NotificationsTogglePayload>(
    SettingsGen.notificationsToggle,
    toggleNotifications
  )
  yield* Saga.chainAction<SettingsGen.DbNukePayload>(SettingsGen.dbNuke, dbNuke)
  yield* Saga.chainAction<SettingsGen.DeleteAccountForeverPayload>(
    SettingsGen.deleteAccountForever,
    deleteAccountForever
  )
  yield* Saga.chainAction<SettingsGen.AddEmailPayload>(SettingsGen.addEmail, addEmail)
  yield* Saga.chainAction<SettingsGen.DeleteEmailPayload>(SettingsGen.deleteEmail, deleteEmail)
  yield* Saga.chainAction<SettingsGen.SetPrimaryEmailPayload>(SettingsGen.setPrimaryEmail, setPrimaryEmail)
  yield* Saga.chainAction<SettingsGen.SendVerificationEmailPayload>(
    SettingsGen.sendVerificationEmail,
    sendVerificationEmail
  )
  yield* Saga.chainAction<SettingsGen.AddPhoneNumberPayload>(SettingsGen.addPhoneNumber, addPhoneNumber)
  yield* Saga.chainAction<SettingsGen.DeletePhoneNumberPayload>(
    SettingsGen.deletePhoneNumber,
    deletePhoneNumber
  )
  yield* Saga.chainAction<SettingsGen.VerifyPhoneNumberPayload>(
    SettingsGen.verifyPhoneNumber,
    verifyPhoneNumber
  )
  yield* Saga.chainAction<SettingsGen.LoadEmailsPayload>(SettingsGen.loadEmails, loadEmails)
  yield* Saga.chainAction<SettingsGen.LoadSettingsPayload>(SettingsGen.loadSettings, loadSettings)
  yield* Saga.chainAction<SettingsGen.LoadSettingsPayload>(SettingsGen.loadSettings, loadPhoneNumbers)
  yield* Saga.chainAction<EngineGen.Keybase1NotifyEmailAddressEmailAddressVerifiedPayload>(
    EngineGen.keybase1NotifyEmailAddressEmailAddressVerified,
    loadEmails
  )
  yield* Saga.chainAction<
    | EngineGen.Keybase1NotifyPhoneNumberPhoneNumberAddedPayload
    | EngineGen.Keybase1NotifyPhoneNumberPhoneNumberVerifiedPayload
  >(
    [
      EngineGen.keybase1NotifyPhoneNumberPhoneNumberAdded,
      EngineGen.keybase1NotifyPhoneNumberPhoneNumberVerified,
    ],
    loadPhoneNumbers
  )

  yield* Saga.chainGenerator<SettingsGen.OnSubmitNewEmailPayload>(
    SettingsGen.onSubmitNewEmail,
    onSubmitNewEmail
  )
  yield* Saga.chainGenerator<SettingsGen.OnSubmitNewPasswordPayload>(
    SettingsGen.onSubmitNewPassword,
    onSubmitNewPassword
  )
  yield* Saga.chainAction<SettingsGen.OnUpdatePGPSettingsPayload>(
    SettingsGen.onUpdatePGPSettings,
    onUpdatePGPSettings
  )
  yield* Saga.chainGenerator<SettingsGen.TracePayload>(SettingsGen.trace, trace)
  yield* Saga.chainGenerator<SettingsGen.ProcessorProfilePayload>(
    SettingsGen.processorProfile,
    processorProfile
  )
  yield* Saga.chainAction<SettingsGen.LoadRememberPasswordPayload>(
    SettingsGen.loadRememberPassword,
    getRememberPassword
  )
  yield* Saga.chainAction<SettingsGen.OnChangeRememberPasswordPayload>(
    SettingsGen.onChangeRememberPassword,
    rememberPassword
  )
  yield* Saga.chainAction<SettingsGen.LoadLockdownModePayload>(SettingsGen.loadLockdownMode, loadLockdownMode)
  yield* Saga.chainAction<SettingsGen.OnChangeLockdownModePayload>(
    SettingsGen.onChangeLockdownMode,
    setLockdownMode
  )
  yield* Saga.chainAction<SettingsGen.UnfurlSettingsRefreshPayload>(
    SettingsGen.unfurlSettingsRefresh,
    unfurlSettingsRefresh
  )
  yield* Saga.chainAction<SettingsGen.UnfurlSettingsSavedPayload>(
    SettingsGen.unfurlSettingsSaved,
    unfurlSettingsSaved
  )
  yield* Saga.chainAction<SettingsGen.LoadHasRandomPwPayload>(SettingsGen.loadHasRandomPw, loadHasRandomPW)
  yield* Saga.chainAction<EngineGen.Keybase1NotifyUsersPasswordChangedPayload>(
    EngineGen.keybase1NotifyUsersPasswordChanged,
    passwordChanged
  )

  yield* Saga.chainAction<SettingsGen.CheckPasswordPayload>(SettingsGen.checkPassword, checkPassword)
}

export default settingsSaga
