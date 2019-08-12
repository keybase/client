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
import {isAndroidNewerThanN, pprofDir, version} from '../constants/platform'
import {writeLogLinesToFile} from '../util/forward-logs'
import {TypedState} from '../util/container'

const onUpdatePGPSettings = async () => {
  try {
    const {hasServerKeys} = await RPCTypes.accountHasServerKeysRpcPromise()
    return SettingsGen.createOnUpdatedPGPSettings({hasKeys: hasServerKeys})
  } catch (error) {
    return SettingsGen.createOnUpdatePasswordError({error})
  }
}

const onSubmitNewEmail = async (state: TypedState) => {
  try {
    const newEmail = state.settings.email.newEmail
    await RPCTypes.accountEmailChangeRpcPromise({newEmail}, Constants.settingsWaitingKey)
    return [SettingsGen.createLoadSettings(), RouteTreeGen.createNavigateUp()]
  } catch (error) {
    return SettingsGen.createOnUpdateEmailError({error})
  }
}

const onSubmitNewPassword = async (state: TypedState, action: SettingsGen.OnSubmitNewPasswordPayload) => {
  try {
    const {newPassword, newPasswordConfirm} = state.settings.password
    if (newPassword.stringValue() !== newPasswordConfirm.stringValue()) {
      return SettingsGen.createOnUpdatePasswordError({error: new Error("Passwords don't match")})
    }
    await RPCTypes.accountPassphraseChangeRpcPromise(
      {
        force: true,
        oldPassphrase: '',
        passphrase: newPassword.stringValue(),
      },
      Constants.settingsWaitingKey
    )

    return [
      RouteTreeGen.createNavigateUp(),
      ...(action.payload.thenSignOut ? [ConfigGen.createLogout()] : []),
    ]
  } catch (error) {
    return SettingsGen.createOnUpdatePasswordError({error})
  }
}

const toggleNotifications = async (state: TypedState) => {
  const current = state.settings.notifications
  if (!current || !current.groups.get('email')) {
    throw new Error('No notifications loaded yet')
  }

  let JSONPayload: Array<{key: string; value: string}> = []
  let chatGlobalArg = {}
  current.groups.forEach((group, groupName) => {
    if (groupName === Constants.securityGroup) {
      // Special case this since it will go to chat settings endpoint
      group.settings.forEach(
        setting =>
          (chatGlobalArg[`${ChatTypes.GlobalAppNotificationSetting[setting.name]}`] = !!setting.subscribed)
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

  const result = await RPCTypes.apiserverPostJSONRpcPromise(
    {
      JSONPayload,
      args: [],
      endpoint: 'account/subscribe',
    },
    Constants.settingsWaitingKey
  )
  await ChatTypes.localSetGlobalAppNotificationSettingsLocalRpcPromise(
    {
      settings: {
        ...chatGlobalArg,
      },
    },
    Constants.settingsWaitingKey
  )

  if (!result || !result.body || JSON.parse(result.body).status.code !== 0) {
    throw new Error(`Invalid response ${result || '(no result)'}`)
  }

  return SettingsGen.createNotificationsSaved()
}

const reclaimInvite = async (_: TypedState, action: SettingsGen.InvitesReclaimPayload) => {
  try {
    await RPCTypes.apiserverPostRpcPromise(
      {
        args: [{key: 'invitation_id', value: action.payload.inviteId}],
        endpoint: 'cancel_invitation',
      },
      Constants.settingsWaitingKey
    )
    return [SettingsGen.createInvitesReclaimed(), SettingsGen.createInvitesRefresh()]
  } catch (e) {
    logger.warn('Error reclaiming an invite:', e)
    return [
      SettingsGen.createInvitesReclaimedError({errorText: e.desc + e.name}),
      SettingsGen.createInvitesRefresh(),
    ]
  }
}

const refreshInvites = async () => {
  const json = await RPCTypes.apiserverGetWithSessionRpcPromise(
    {
      args: [],
      endpoint: 'invitations_sent',
    },
    Constants.settingsWaitingKey
  )
  const results: {
    invitations: Array<{
      assertion: string | null
      ctime: number
      email: string
      invitation_id: string
      short_code: string
      type: string
      uid: string
      username: string
    }>
  } = JSON.parse((json && json.body) || '')

  const acceptedInvites: Array<Types.Invitation> = []
  const pendingInvites: Array<Types.Invitation> = []

  results.invitations.forEach(i => {
    const invite: Types.Invitation = {
      created: i.ctime,
      email: i.email,
      id: i.invitation_id,
      // @ts-ignore for now
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
}

const sendInvite = async (_: TypedState, action: SettingsGen.InvitesSendPayload) => {
  try {
    const {email, message} = action.payload
    const args = [{key: 'email', value: trim(email)}]
    if (message) {
      args.push({key: 'invitation_message', value: message})
    }

    const response = await RPCTypes.apiserverPostRpcPromise(
      {args, endpoint: 'send_invitation'},
      Constants.settingsWaitingKey
    )

    if (response) {
      const parsedBody = JSON.parse(response.body)
      const invitationId = parsedBody.invitation_id.slice(0, 10)
      const link = 'keybase.io/inv/' + invitationId
      return [
        SettingsGen.createInvitesSent(),
        // TODO: if the user changes their route while working, this may lead to an invalid route
        RouteTreeGen.createNavigateAppend({path: [{props: {email, link}, selected: 'inviteSent'}]}),
        SettingsGen.createInvitesRefresh(),
      ]
    } else {
      return false
    }
  } catch (e) {
    logger.warn('Error sending an invite:', e)
    return [SettingsGen.createInvitesSentError({error: e}), SettingsGen.createInvitesRefresh()]
  }
}

function* refreshNotifications() {
  // If the rpc is fast don't clear it out first
  const delayThenEmptyTask = yield Saga._fork(function*(): Iterable<any> {
    yield Saga.callUntyped(delay, 500)
    yield Saga.put(SettingsGen.createNotificationsRefreshed({notifications: I.Map()}))
  })

  let body = ''
  let chatGlobalSettings: ChatTypes.GlobalAppNotificationSettings

  try {
    const [json, _chatGlobalSettings]: [
      {body: string} | null,
      ChatTypes.GlobalAppNotificationSettings
    ] = yield Saga.all([
      Saga.callUntyped(
        RPCTypes.apiserverGetWithSessionRpcPromise,
        {args: [], endpoint: 'account/subscriptions'},
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
        settings: Array<{name: string; description: string; subscribed: boolean}>
        unsub: boolean
      }
      security: {
        settings: Array<{name: string; description: string; subscribed: boolean}>
        unsub: boolean
      }
    }
  } = JSON.parse(body)
  // Add security group extra since it does not come from API endpoint
  results.notifications[Constants.securityGroup] = {
    settings: [
      {
        description: 'Display mobile plaintext notifications',
        name: 'plaintextmobile',
        subscribed: !!chatGlobalSettings.settings[
          `${ChatTypes.GlobalAppNotificationSetting.plaintextmobile}`
        ],
      },
      {
        description: 'Display desktop plaintext notifications',
        name: 'plaintextdesktop',
        subscribed: !!chatGlobalSettings.settings[
          `${ChatTypes.GlobalAppNotificationSetting.plaintextdesktop}`
        ],
      },
      {
        description: 'Disable sending/receiving typing notifications',
        name: 'disabletyping',
        subscribed: !!chatGlobalSettings.settings[`${ChatTypes.GlobalAppNotificationSetting.disabletyping}`],
      },
      ...(isAndroidNewerThanN
        ? []
        : [
            {
              description: 'Use mobile system default notification sound',
              name: 'defaultsoundmobile',
              subscribed: !!chatGlobalSettings.settings[
                `${ChatTypes.GlobalAppNotificationSetting.defaultsoundmobile}`
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
  const notifications: {[key: string]: Types.NotificationsGroupState} = mapValues(groups, group => ({
    settings: group.settings.map(settingsToPayload),
    unsubscribedFromAll: group.unsub,
  })) as any // TODO fix

  yield Saga.put(
    SettingsGen.createNotificationsRefreshed({
      notifications: I.Map(notifications),
    })
  )
}

const dbNuke = async () => {
  await RPCTypes.ctlDbNukeRpcPromise(undefined, Constants.settingsWaitingKey)
}

const deleteAccountForever = async (state: TypedState) => {
  const username = state.config.username
  const allowDeleteAccount = state.settings.allowDeleteAccount

  if (!username) {
    throw new Error('Unable to delete account: no username set')
  }

  if (!allowDeleteAccount) {
    throw new Error('Account deletion failsafe was not disengaged. This is a bug!')
  }

  await RPCTypes.loginAccountDeleteRpcPromise(undefined, Constants.settingsWaitingKey)
  return ConfigGen.createSetDeletedSelf({deletedUsername: username})
}

const loadSettings = async (
  state: TypedState,
  _: SettingsGen.LoadSettingsPayload | ConfigGen.BootstrapStatusLoadedPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.loggedIn) {
    return false
  }
  try {
    const settings = await RPCTypes.userLoadMySettingsRpcPromise(undefined, Constants.loadSettingsWaitingKey)
    const emailMap: I.Map<string, Types.EmailRow> = I.Map(
      (settings.emails || []).map(row => [row.email, Constants.makeEmailRow(row)])
    )
    const phoneMap: I.Map<string, Types.PhoneRow> = I.Map(
      (settings.phoneNumbers || []).reduce(
        (map, row) => {
          if (map[row.phoneNumber] && !map[row.phoneNumber].superseded) {
            return map
          }
          map[row.phoneNumber] = Constants.toPhoneRow(row)
          return map
        },
        {} as {[key: string]: Types.PhoneRow}
      )
    )
    return SettingsGen.createLoadedSettings({
      emails: emailMap,
      phones: phoneMap,
    })
  } catch (e) {
    logger.warn(`Error loading settings: ${e.message}`)
    return false
  }
}

const visFromBoolean = (searchable: boolean): ChatTypes.Keybase1.IdentityVisibility =>
  searchable ? ChatTypes.Keybase1.IdentityVisibility.public : ChatTypes.Keybase1.IdentityVisibility.private

const editEmail = async (_: TypedState, action: SettingsGen.EditEmailPayload, logger: Saga.SagaLogger) => {
  // TODO: consider allowing more than one action here
  // TODO: handle errors
  if (action.payload.delete) {
    await RPCTypes.emailsDeleteEmailRpcPromise({email: action.payload.email})
    return false
  }
  if (action.payload.makePrimary) {
    await RPCTypes.emailsSetPrimaryEmailRpcPromise({email: action.payload.email})
    return false
  }
  if (action.payload.verify) {
    await RPCTypes.emailsSendVerificationEmailRpcPromise({email: action.payload.email})
    return SettingsGen.createSentVerificationEmail({email: action.payload.email})
  }
  if (action.payload.makeSearchable !== undefined && action.payload.makeSearchable !== null) {
    await RPCTypes.emailsSetVisibilityEmailRpcPromise({
      email: action.payload.email,
      visibility: action.payload.makeSearchable
        ? ChatTypes.Keybase1.IdentityVisibility.public
        : ChatTypes.Keybase1.IdentityVisibility.private,
    })
    return false
  }
  logger.warn('Empty editEmail action')
  return false
}
const editPhone = async (_: TypedState, action: SettingsGen.EditPhonePayload, logger: Saga.SagaLogger) => {
  // TODO: handle errors
  let acted = false
  if (action.payload.delete) {
    await RPCTypes.phoneNumbersDeletePhoneNumberRpcPromise({phoneNumber: action.payload.phone})
    acted = true
  }
  if (action.payload.setSearchable !== undefined) {
    await RPCTypes.phoneNumbersSetVisibilityPhoneNumberRpcPromise({
      phoneNumber: action.payload.phone,
      visibility: visFromBoolean(!!action.payload.setSearchable),
    })
    acted = true
  }
  if (!acted) {
    logger.warn('Empty editPhone action')
  }
}

const getRememberPassword = async () => {
  const remember = await RPCTypes.configGetRememberPassphraseRpcPromise()
  return SettingsGen.createLoadedRememberPassword({remember})
}

function* trace(_: TypedState, action: SettingsGen.TracePayload) {
  const durationSeconds = action.payload.durationSeconds
  yield Saga.callUntyped(RPCTypes.pprofLogTraceRpcPromise, {
    logDirForMobile: pprofDir,
    traceDurationSeconds: durationSeconds,
  })
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.traceInProgressKey}))
  yield Saga.delay(durationSeconds * 1000)
  yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.traceInProgressKey}))
}

function* processorProfile(_: TypedState, action: SettingsGen.ProcessorProfilePayload) {
  const durationSeconds = action.payload.durationSeconds
  yield Saga.callUntyped(RPCTypes.pprofLogProcessorProfileRpcPromise, {
    logDirForMobile: pprofDir,
    profileDurationSeconds: durationSeconds,
  })
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.processorProfileInProgressKey}))
  yield Saga.delay(durationSeconds * 1000)
  yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.processorProfileInProgressKey}))
}

const rememberPassword = async (_: TypedState, action: SettingsGen.OnChangeRememberPasswordPayload) => {
  await RPCTypes.configSetRememberPassphraseRpcPromise({remember: action.payload.remember})
}

const checkPassword = async (_: TypedState, action: SettingsGen.CheckPasswordPayload) => {
  const res = await RPCTypes.accountPassphraseCheckRpcPromise(
    {passphrase: action.payload.password.stringValue()},
    Constants.checkPasswordWaitingKey
  )
  return SettingsGen.createLoadedCheckPassword({checkPasswordIsCorrect: res})
}

const loadLockdownMode = async (state: TypedState) => {
  if (!state.config.loggedIn) {
    return false
  }
  try {
    const result = await RPCTypes.accountGetLockdownModeRpcPromise(
      undefined,
      Constants.loadLockdownModeWaitingKey
    )
    return SettingsGen.createLoadedLockdownMode({status: result.status})
  } catch (_) {
    return SettingsGen.createLoadedLockdownMode({status: null})
  }
}

const loadProxyData = async () => {
  try {
    const result = await RPCTypes.configGetProxyDataRpcPromise()
    return SettingsGen.createLoadedProxyData({proxyData: result})
  } catch (err) {
    logger.warn('Error in loading proxy data', err)
    return false
  }
}

const saveProxyData = async (_: TypedState, proxyDataPayload: SettingsGen.SaveProxyDataPayload) => {
  try {
    await RPCTypes.configSetProxyDataRpcPromise(proxyDataPayload.payload)
  } catch (err) {
    logger.warn('Error in saving proxy data', err)
  }
}

const toggleRuntimeStats = async () => {
  try {
    await RPCTypes.configToggleRuntimeStatsRpcPromise()
  } catch (err) {
    logger.warn('error toggling runtime stats', err)
  }
}

const setLockdownMode = async (state: TypedState, action: SettingsGen.OnChangeLockdownModePayload) => {
  if (!state.config.loggedIn) {
    return false
  }

  try {
    await RPCTypes.accountSetLockdownModeRpcPromise(
      {enabled: action.payload.enabled},
      Constants.setLockdownModeWaitingKey
    )
    return SettingsGen.createLoadedLockdownMode({status: action.payload.enabled})
  } catch (_) {
    return SettingsGen.createLoadLockdownMode()
  }
}

const sendFeedback = async (state: TypedState, action: SettingsGen.SendFeedbackPayload) => {
  const {feedback, sendLogs, sendMaxBytes} = action.payload
  try {
    if (sendLogs) {
      const lines = await logger.dump()
      await writeLogLinesToFile(lines)
    }
    const status = {version}
    logger.info(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
    const extra = sendLogs ? {...status, ...Constants.getExtraChatLogsForLogSend(state)} : status
    const logSendId = await RPCTypes.configLogSendRpcPromise(
      {
        feedback: feedback || '',
        sendLogs,
        sendMaxBytes,
        statusJSON: JSON.stringify(extra),
      },
      Constants.sendFeedbackWaitingKey
    )
    logger.info('logSendId is', logSendId)
    return false
  } catch (error) {
    logger.warn('err in sending logs', error)
    return SettingsGen.createFeedbackSent({error})
  }
}

const unfurlSettingsRefresh = async (state: TypedState) => {
  if (!state.config.loggedIn) {
    return false
  }
  try {
    const result = await ChatTypes.localGetUnfurlSettingsRpcPromise(undefined, Constants.chatUnfurlWaitingKey)
    return SettingsGen.createUnfurlSettingsRefreshed({
      mode: result.mode,
      whitelist: I.List(result.whitelist || []),
    })
  } catch (_) {
    return SettingsGen.createUnfurlSettingsError({
      error: 'Unable to load link preview settings, please try again.',
    })
  }
}

const unfurlSettingsSaved = async (state: TypedState, action: SettingsGen.UnfurlSettingsSavedPayload) => {
  if (!state.config.loggedIn) {
    return false
  }

  try {
    await ChatTypes.localSaveUnfurlSettingsRpcPromise(
      {mode: action.payload.mode, whitelist: action.payload.whitelist.toArray()},
      Constants.chatUnfurlWaitingKey
    )
    return SettingsGen.createUnfurlSettingsRefresh()
  } catch (_) {
    return SettingsGen.createUnfurlSettingsError({
      error: 'Unable to save link preview settings, please try again.',
    })
  }
}

// Once loaded, do not issue this RPC again. This field can only go true ->
// false (never the opposite way), and there are notifications set up when
// this happens.
const loadHasRandomPW = async (state: TypedState) => {
  if (state.settings.password.randomPW !== null) {
    return false
  }
  try {
    const randomPW = await RPCTypes.userLoadHasRandomPwRpcPromise({forceRepoll: false, noShortTimeout: false})
    return SettingsGen.createLoadedHasRandomPw({randomPW})
  } catch (e) {
    logger.warn('Error loading hasRandomPW:', e.message)
    return false
  }
}

// Mark that we are not randomPW anymore if we got a password change.
const passwordChanged = () => SettingsGen.createLoadedHasRandomPw({randomPW: false})

const stop = async (_: TypedState, action: SettingsGen.StopPayload) => {
  await RPCTypes.ctlStopRpcPromise({exitCode: action.payload.exitCode})
  return false as const
}

const addPhoneNumber = async (
  _: TypedState,
  action: SettingsGen.AddPhoneNumberPayload,
  logger: Saga.SagaLogger
) => {
  logger.info('adding phone number')
  const {phoneNumber, allowSearch} = action.payload
  const visibility = allowSearch ? RPCTypes.IdentityVisibility.public : RPCTypes.IdentityVisibility.private
  try {
    await RPCTypes.phoneNumbersAddPhoneNumberRpcPromise(
      {phoneNumber, visibility},
      Constants.addPhoneNumberWaitingKey
    )
    logger.info('success')
    return SettingsGen.createAddedPhoneNumber({allowSearch, phoneNumber})
  } catch (err) {
    logger.warn('error ', err.message)
    const message =
      err.code === RPCTypes.StatusCode.scratelimit
        ? 'Sorry, added a few too many phone numbers recently. Please try again later.'
        : err.message
    return SettingsGen.createAddedPhoneNumber({allowSearch, error: message, phoneNumber})
  }
}

const resendVerificationForPhoneNumber = async (
  _: TypedState,
  action: SettingsGen.ResendVerificationForPhoneNumberPayload,
  logger: Saga.SagaLogger
) => {
  const {phoneNumber} = action.payload
  logger.info(`resending verification code for ${phoneNumber}`)
  try {
    await RPCTypes.phoneNumbersResendVerificationForPhoneNumberRpcPromise(
      {phoneNumber},
      Constants.resendVerificationForPhoneWaitingKey
    )
    return false
  } catch (err) {
    const message =
      err.code === RPCTypes.StatusCode.scratelimit
        ? 'Sorry, asked for a few too many verification codes recently. Please try again later.'
        : err.message
    logger.warn('error ', message)
    return SettingsGen.createVerifiedPhoneNumber({error: message, phoneNumber})
  }
}

const verifyPhoneNumber = async (
  _: TypedState,
  action: SettingsGen.VerifyPhoneNumberPayload,
  logger: Saga.SagaLogger
) => {
  logger.info('verifying phone number')
  const {code, phoneNumber} = action.payload
  try {
    await RPCTypes.phoneNumbersVerifyPhoneNumberRpcPromise(
      {code, phoneNumber},
      Constants.verifyPhoneNumberWaitingKey
    )
    logger.info('success')
    return SettingsGen.createVerifiedPhoneNumber({phoneNumber})
  } catch (err) {
    const message =
      err.code === RPCTypes.StatusCode.scphonenumberwrongverificationcode
        ? 'Incorrect code, please try again.'
        : err.code === RPCTypes.StatusCode.scratelimit
        ? 'Sorry, tried too many guesses in a short period of time. Please try again later.'
        : err.message
    logger.warn('error ', message)
    return SettingsGen.createVerifiedPhoneNumber({error: message, phoneNumber})
  }
}

const loadContactImportEnabled = async (
  state: TypedState,
  action: SettingsGen.LoadContactImportEnabledPayload | ConfigGen.BootstrapStatusLoadedPayload,
  logger: Saga.SagaLogger
) => {
  if (action.type === ConfigGen.bootstrapStatusLoaded && !action.payload.loggedIn) {
    return
  }
  if (!state.config.username) {
    logger.warn('no username')
    return
  }
  let enabled = false
  try {
    const value = await RPCTypes.configGuiGetValueRpcPromise(
      {path: Constants.importContactsConfigKey(state.config.username)},
      Constants.importContactsWaitingKey
    )
    enabled = !!value.b && !value.isNull
  } catch (err) {
    if (!err.message.includes('no such key')) {
      logger.error(`Error reading config: ${err.message}`)
    }
  }
  return SettingsGen.createLoadedContactImportEnabled({enabled})
}

const editContactImportEnabled = async (
  state: TypedState,
  action: SettingsGen.EditContactImportEnabledPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.username) {
    logger.warn('no username')
    return false
  }
  await RPCTypes.configGuiSetValueRpcPromise(
    {
      path: Constants.importContactsConfigKey(state.config.username),
      value: {b: action.payload.enable, isNull: false},
    },
    Constants.importContactsWaitingKey
  )
  return SettingsGen.createLoadContactImportEnabled()
}

const addEmail = async (state: TypedState, action: SettingsGen.AddEmailPayload, logger: Saga.SagaLogger) => {
  if (state.settings.email.error) {
    logger.info('email error; bailing')
    return
  }
  const {email, searchable} = action.payload
  try {
    await RPCTypes.emailsAddEmailRpcPromise(
      {
        email,
        visibility: searchable ? RPCTypes.IdentityVisibility.public : RPCTypes.IdentityVisibility.private,
      },
      Constants.addEmailWaitingKey
    )
    logger.info('success')
    return SettingsGen.createAddedEmail({email})
  } catch (err) {
    logger.warn(`error: ${err.message}`)

    const message =
      err.code === RPCTypes.StatusCode.scratelimit
        ? "Sorry, you've added too many email addresses lately. Please try again later."
        : err.message
    err.message = message
    return SettingsGen.createAddedEmail({email, error: err})
  }
}

function* settingsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(SettingsGen.invitesReclaim, reclaimInvite)
  yield* Saga.chainAction2(SettingsGen.invitesRefresh, refreshInvites)
  yield* Saga.chainAction2(SettingsGen.invitesSend, sendInvite)
  yield* Saga.chainGenerator<SettingsGen.NotificationsRefreshPayload>(
    SettingsGen.notificationsRefresh,
    refreshNotifications
  )
  yield* Saga.chainAction2(SettingsGen.notificationsToggle, toggleNotifications)
  yield* Saga.chainAction2(SettingsGen.dbNuke, dbNuke)
  yield* Saga.chainAction2(SettingsGen.deleteAccountForever, deleteAccountForever)
  yield* Saga.chainAction2(SettingsGen.loadSettings, loadSettings)
  yield* Saga.chainAction2(SettingsGen.onSubmitNewPassword, onSubmitNewPassword)
  yield* Saga.chainAction2(SettingsGen.onUpdatePGPSettings, onUpdatePGPSettings)
  yield* Saga.chainGenerator<SettingsGen.TracePayload>(SettingsGen.trace, trace)
  yield* Saga.chainGenerator<SettingsGen.ProcessorProfilePayload>(
    SettingsGen.processorProfile,
    processorProfile
  )
  yield* Saga.chainAction2(SettingsGen.loadRememberPassword, getRememberPassword)
  yield* Saga.chainAction2(SettingsGen.onChangeRememberPassword, rememberPassword)
  yield* Saga.chainAction2(SettingsGen.loadLockdownMode, loadLockdownMode)
  yield* Saga.chainAction2(SettingsGen.onChangeLockdownMode, setLockdownMode)
  yield* Saga.chainAction2(SettingsGen.sendFeedback, sendFeedback)
  yield* Saga.chainAction2(SettingsGen.unfurlSettingsRefresh, unfurlSettingsRefresh)
  yield* Saga.chainAction2(SettingsGen.unfurlSettingsSaved, unfurlSettingsSaved)
  yield* Saga.chainAction2(SettingsGen.loadHasRandomPw, loadHasRandomPW)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyUsersPasswordChanged, passwordChanged)

  yield* Saga.chainAction2(SettingsGen.stop, stop)

  yield* Saga.chainAction2(SettingsGen.checkPassword, checkPassword)

  yield* Saga.chainAction2(SettingsGen.loadProxyData, loadProxyData)
  yield* Saga.chainAction2(SettingsGen.saveProxyData, saveProxyData)

  // Runtime Stats
  yield* Saga.chainAction2(SettingsGen.toggleRuntimeStats, toggleRuntimeStats)

  // Phone numbers
  yield* Saga.chainAction2(SettingsGen.editPhone, editPhone, 'editPhone')
  yield* Saga.chainAction2(SettingsGen.addPhoneNumber, addPhoneNumber, 'addPhoneNumber')
  yield* Saga.chainAction2(SettingsGen.verifyPhoneNumber, verifyPhoneNumber, 'verifyPhoneNumber')
  yield* Saga.chainAction2(
    SettingsGen.resendVerificationForPhoneNumber,
    resendVerificationForPhoneNumber,
    'resendVerificationForPhoneNumber'
  )

  // Contacts
  yield* Saga.chainAction2(
    [SettingsGen.loadContactImportEnabled, ConfigGen.bootstrapStatusLoaded],
    loadContactImportEnabled,
    'loadContactImportEnabled'
  )
  yield* Saga.chainAction2(
    SettingsGen.editContactImportEnabled,
    editContactImportEnabled,
    'editContactImportEnabled'
  )

  // Emails
  yield* Saga.chainAction2(SettingsGen.editEmail, editEmail, 'editEmail')
  yield* Saga.chainAction2(SettingsGen.addEmail, addEmail, 'addEmail')
  yield* Saga.chainAction2(SettingsGen.onSubmitNewEmail, onSubmitNewEmail)
}

export default settingsSaga
