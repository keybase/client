import * as ChatTypes from '../constants/types/rpc-chat-gen'
import * as ConfigGen from './config-gen'
import * as Constants from '../constants/settings'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Router2Constants from '../constants/router2'
import * as Saga from '../util/saga'
import * as SettingsGen from './settings-gen'
import * as Tabs from '../constants/tabs'
import * as WaitingGen from './waiting-gen'
import logger from '../logger'
import openURL from '../util/open-url'
import trim from 'lodash/trim'
import type * as Container from '../util/container'
import type * as Types from '../constants/types/settings'
import type {RPCError} from '../util/errors'
import {isAndroidNewerThanN, androidIsTestDevice, pprofDir, version} from '../constants/platform'
import {writeLogLinesToFile} from '../util/forward-logs'

const onUpdatePGPSettings = async () => {
  try {
    const {hasServerKeys} = await RPCTypes.accountHasServerKeysRpcPromise()
    return SettingsGen.createOnUpdatedPGPSettings({hasKeys: hasServerKeys})
  } catch (error_) {
    const error = error_ as RPCError
    return SettingsGen.createOnUpdatePasswordError({error})
  }
}

const onSubmitNewEmail = async (state: Container.TypedState) => {
  try {
    const newEmail = state.settings.email.newEmail
    await RPCTypes.accountEmailChangeRpcPromise({newEmail}, Constants.settingsWaitingKey)
    return [SettingsGen.createLoadSettings(), RouteTreeGen.createNavigateUp()]
  } catch (error_) {
    const error = error_ as RPCError
    return SettingsGen.createOnUpdateEmailError({error})
  }
}

const onSubmitNewPassword = async (
  state: Container.TypedState,
  action: SettingsGen.OnSubmitNewPasswordPayload
) => {
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
  } catch (error_) {
    const error = error_ as RPCError
    return SettingsGen.createOnUpdatePasswordError({error})
  }
}

const toggleNotifications = async (state: Container.TypedState) => {
  const current = state.settings.notifications
  if (!current || !current.groups.get('email')) {
    throw new Error('No notifications loaded yet')
  }

  const JSONPayload: Array<{key: string; value: string}> = []
  const chatGlobalArg: {[key: string]: boolean} = {}
  current.groups.forEach((group, groupName) => {
    if (groupName === Constants.securityGroup || groupName === Constants.soundGroup) {
      // Special case this since it will go to chat settings endpoint
      group.settings.forEach(
        setting =>
          (chatGlobalArg[`${ChatTypes.GlobalAppNotificationSetting[setting.name as any]}`] =
            setting.name === 'disabletyping' ? !setting.subscribed : !!setting.subscribed)
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
        value: group.unsub ? '1' : '0',
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

  if (!result || !result.body || JSON.parse(result.body)?.status?.code !== 0) {
    throw new Error(`Invalid response ${result?.body || '(no result)'}`)
  }

  return SettingsGen.createNotificationsSaved()
}

const reclaimInvite = async (action: SettingsGen.InvitesReclaimPayload) => {
  try {
    await RPCTypes.apiserverPostRpcPromise(
      {
        args: [{key: 'invitation_id', value: action.payload.inviteId}],
        endpoint: 'cancel_invitation',
      },
      Constants.settingsWaitingKey
    )
    return [SettingsGen.createInvitesRefresh()]
  } catch (e) {
    logger.warn('Error reclaiming an invite:', e)
    return [SettingsGen.createInvitesRefresh()]
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
  } = JSON.parse(json?.body ?? '')

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
      acceptedInvites: acceptedInvites,
      pendingInvites: pendingInvites,
    },
  })
}

const sendInvite = async (action: SettingsGen.InvitesSendPayload) => {
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
  } catch (error_) {
    const error = error_ as RPCError
    logger.warn('Error sending an invite:', error)
    return [SettingsGen.createInvitesSent({error: error}), SettingsGen.createInvitesRefresh()]
  }
}

function* refreshNotifications() {
  // If the rpc is fast don't clear it out first
  const delayThenEmptyTask = yield Saga._fork(function* (): Iterable<any> {
    yield Saga.delay(500)
    yield Saga.put(SettingsGen.createNotificationsRefreshed({notifications: new Map()}))
  })

  let body = ''
  let chatGlobalSettings: ChatTypes.GlobalAppNotificationSettings

  try {
    const [json, _chatGlobalSettings]: [{body: string} | null, ChatTypes.GlobalAppNotificationSettings] =
      yield Saga.all([
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
  } catch (error_) {
    const error = error_ as RPCError
    // No need to throw black bars -- handled by Reloadable.
    logger.warn(`Error getting notification settings: ${error.desc}`)
    return
  }

  yield Saga.cancel(delayThenEmptyTask)

  const results: Types.NotificationsGroupStateFromServer = JSON.parse(body)
  // Add security group extra since it does not come from API endpoint
  results.notifications[Constants.securityGroup] = {
    settings: [
      {
        description: 'Show message content in phone chat notifications',
        description_h: 'Show message content in phone chat notifications',
        name: 'plaintextmobile',
        subscribed:
          !!chatGlobalSettings.settings[`${ChatTypes.GlobalAppNotificationSetting.plaintextmobile}`],
      },
      {
        description: 'Show message content in computer chat notifications',
        description_h: 'Show message content in computer chat notifications',
        name: 'plaintextdesktop',
        subscribed:
          !!chatGlobalSettings.settings[`${ChatTypes.GlobalAppNotificationSetting.plaintextdesktop}`],
      },
      {
        description: "Show others when you're typing",
        description_h: "Show others when you're typing",
        name: 'disabletyping',
        subscribed: !chatGlobalSettings.settings[`${ChatTypes.GlobalAppNotificationSetting.disabletyping}`],
      },
    ],
    unsub: false,
  }
  results.notifications[Constants.soundGroup] = {
    settings: isAndroidNewerThanN
      ? []
      : [
          {
            description: 'Phone: use default sound for new messages',
            description_h: 'Phone: use default sound for new messages',
            name: 'defaultsoundmobile',
            subscribed:
              !!chatGlobalSettings.settings[`${ChatTypes.GlobalAppNotificationSetting.defaultsoundmobile}`],
          },
        ],
    unsub: false,
  }
  yield Saga.put(
    SettingsGen.createNotificationsRefreshed({
      notifications: new Map(Object.entries(results.notifications)),
    })
  )
}

const dbNuke = async () => {
  await RPCTypes.ctlDbNukeRpcPromise(undefined, Constants.settingsWaitingKey)
}

const deleteAccountForever = async (
  state: Container.TypedState,
  action: SettingsGen.DeleteAccountForeverPayload
) => {
  const username = state.config.username

  if (!username) {
    throw new Error('Unable to delete account: no username set')
  }

  await RPCTypes.loginAccountDeleteRpcPromise(
    {passphrase: action.payload.passphrase?.stringValue()},
    Constants.settingsWaitingKey
  )
  return ConfigGen.createSetDeletedSelf({deletedUsername: username})
}

const loadSettings = async (
  state: Container.TypedState,
  _: SettingsGen.LoadSettingsPayload | ConfigGen.BootstrapStatusLoadedPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.loggedIn) {
    return false
  }
  try {
    const settings = await RPCTypes.userLoadMySettingsRpcPromise(undefined, Constants.loadSettingsWaitingKey)
    const emailMap = new Map(
      (settings.emails ?? []).map(row => [row.email, {...Constants.makeEmailRow(), ...row}])
    )
    const phoneMap = (settings.phoneNumbers ?? []).reduce<Map<string, Types.PhoneRow>>((map, row) => {
      if (map.get(row.phoneNumber) && !map.get(row.phoneNumber)?.superseded) {
        return map
      }
      map.set(row.phoneNumber, Constants.toPhoneRow(row))
      return map
    }, new Map())
    return SettingsGen.createLoadedSettings({
      emails: emailMap,
      phones: phoneMap,
    })
  } catch (error_) {
    const error = error_ as RPCError
    logger.warn(`Error loading settings: ${error.message}`)
    return false
  }
}

const visFromBoolean = (searchable: boolean): ChatTypes.Keybase1.IdentityVisibility =>
  searchable ? ChatTypes.Keybase1.IdentityVisibility.public : ChatTypes.Keybase1.IdentityVisibility.private

const editEmail = async (
  state: Container.TypedState,
  action: SettingsGen.EditEmailPayload,
  logger: Saga.SagaLogger
) => {
  // TODO: consider allowing more than one action here
  // TODO: handle errors
  if (action.payload.delete) {
    await RPCTypes.emailsDeleteEmailRpcPromise({email: action.payload.email})
    if (state.settings.email.addedEmail === action.payload.email) {
      return SettingsGen.createClearAddedEmail()
    }
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
const editPhone = async (action: SettingsGen.EditPhonePayload, logger: Saga.SagaLogger) => {
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

const loadDefaultPhoneNumberCountry = async (state: Container.TypedState) => {
  // noop if we've already loaded it
  if (state.settings.phoneNumbers.defaultCountry) {
    return
  }
  const country = await RPCTypes.accountGuessCurrentLocationRpcPromise({
    defaultCountry: 'US',
  })
  return SettingsGen.createUpdateDefaultPhoneNumberCountry({
    country,
  })
}

const getRememberPassword = async () => {
  const remember = await RPCTypes.configGetRememberPassphraseRpcPromise()
  return SettingsGen.createLoadedRememberPassword({remember})
}

function* trace(_: Container.TypedState, action: SettingsGen.TracePayload) {
  const durationSeconds = action.payload.durationSeconds
  yield Saga.callUntyped(RPCTypes.pprofLogTraceRpcPromise, {
    logDirForMobile: pprofDir,
    traceDurationSeconds: durationSeconds,
  })
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.traceInProgressKey}))
  yield Saga.delay(durationSeconds * 1000)
  yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.traceInProgressKey}))
}

function* processorProfile(_: Container.TypedState, action: SettingsGen.ProcessorProfilePayload) {
  const durationSeconds = action.payload.durationSeconds
  yield Saga.callUntyped(RPCTypes.pprofLogProcessorProfileRpcPromise, {
    logDirForMobile: pprofDir,
    profileDurationSeconds: durationSeconds,
  })
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.processorProfileInProgressKey}))
  yield Saga.delay(durationSeconds * 1000)
  yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.processorProfileInProgressKey}))
}

const rememberPassword = async (action: SettingsGen.OnChangeRememberPasswordPayload) => {
  await RPCTypes.configSetRememberPassphraseRpcPromise({remember: action.payload.remember})
}

const checkPassword = async (action: SettingsGen.CheckPasswordPayload) => {
  const res = await RPCTypes.accountPassphraseCheckRpcPromise(
    {passphrase: action.payload.password.stringValue()},
    Constants.checkPasswordWaitingKey
  )
  return SettingsGen.createLoadedCheckPassword({checkPasswordIsCorrect: res})
}

const loadLockdownMode = async (state: Container.TypedState) => {
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
    return SettingsGen.createLoadedLockdownMode({})
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

const saveProxyData = async (proxyDataPayload: SettingsGen.SaveProxyDataPayload) => {
  try {
    await RPCTypes.configSetProxyDataRpcPromise(proxyDataPayload.payload)
  } catch (err) {
    logger.warn('Error in saving proxy data', err)
  }
}

const setLockdownMode = async (
  state: Container.TypedState,
  action: SettingsGen.OnChangeLockdownModePayload
) => {
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

const sendFeedback = async (state: Container.TypedState, action: SettingsGen.SendFeedbackPayload) => {
  // We don't want test devices (pre-launch reports) to send us log sends.
  if (androidIsTestDevice) {
    return
  }
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
  } catch (error_) {
    const error = error_ as RPCError
    logger.warn('err in sending logs', error)
    return SettingsGen.createFeedbackSent({error: error as Error})
  }
}

const contactSettingsRefresh = async (state: Container.TypedState) => {
  if (!state.config.loggedIn) {
    return false
  }
  try {
    const settings = await RPCTypes.accountUserGetContactSettingsRpcPromise(
      undefined,
      Constants.contactSettingsLoadWaitingKey
    )
    return SettingsGen.createContactSettingsRefreshed({
      settings,
    })
  } catch (_) {
    return SettingsGen.createContactSettingsError({
      error: 'Unable to load contact settings, please try again.',
    })
  }
}

const contactSettingsSaved = async (
  state: Container.TypedState,
  action: SettingsGen.ContactSettingsSavedPayload
) => {
  if (!state.config.loggedIn) {
    return false
  }

  // Convert the selected teams object into the RPC format.
  const {enabled, indirectFollowees, teamsEnabled, teamsList} = action.payload
  const teams = Object.entries(teamsList).map(([teamID, enabled]) => ({
    enabled,
    teamID,
  }))
  const allowFolloweeDegrees = indirectFollowees ? 2 : 1
  const settings = enabled
    ? {
        allowFolloweeDegrees,
        allowGoodTeams: teamsEnabled,
        enabled: true,
        teams,
      }
    : {
        allowFolloweeDegrees,
        allowGoodTeams: teamsEnabled,
        enabled: false,
        teams,
      }
  try {
    await RPCTypes.accountUserSetContactSettingsRpcPromise(
      {settings},
      Constants.contactSettingsSaveWaitingKey
    )
    return SettingsGen.createContactSettingsRefresh()
  } catch (_) {
    return SettingsGen.createContactSettingsError({
      error: 'Unable to save contact settings, please try again.',
    })
  }
}

const unfurlSettingsRefresh = async (state: Container.TypedState) => {
  if (!state.config.loggedIn) {
    return false
  }
  try {
    const result = await ChatTypes.localGetUnfurlSettingsRpcPromise(undefined, Constants.chatUnfurlWaitingKey)
    return SettingsGen.createUnfurlSettingsRefreshed({
      mode: result.mode,
      whitelist: result.whitelist ?? [],
    })
  } catch (_) {
    return SettingsGen.createUnfurlSettingsError({
      error: 'Unable to load link preview settings, please try again.',
    })
  }
}

const unfurlSettingsSaved = async (
  state: Container.TypedState,
  action: SettingsGen.UnfurlSettingsSavedPayload
) => {
  if (!state.config.loggedIn) {
    return false
  }

  try {
    await ChatTypes.localSaveUnfurlSettingsRpcPromise(
      {mode: action.payload.mode, whitelist: action.payload.whitelist},
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
const loadHasRandomPW = async (state: Container.TypedState) => {
  if ((state.settings.password.randomPW ?? null) !== null) {
    return false
  }
  try {
    const passphraseState = await RPCTypes.userLoadPassphraseStateRpcPromise()
    const randomPW = passphraseState === RPCTypes.PassphraseState.random
    return SettingsGen.createLoadedHasRandomPw({randomPW})
  } catch (error_) {
    const error = error_ as RPCError
    logger.warn('Error loading hasRandomPW:', error.message)
    return false
  }
}

// Mark that we are not randomPW anymore if we got a password change.
const passwordChanged = (action: EngineGen.Keybase1NotifyUsersPasswordChangedPayload) => {
  const randomPW = action.payload.params.state === RPCTypes.PassphraseState.random
  return SettingsGen.createLoadedHasRandomPw({randomPW})
}

const stop = async (action: SettingsGen.StopPayload) => {
  await RPCTypes.ctlStopRpcPromise({exitCode: action.payload.exitCode})
  return false as const
}

const addPhoneNumber = async (action: SettingsGen.AddPhoneNumberPayload, logger: Saga.SagaLogger) => {
  logger.info('adding phone number')
  const {phoneNumber, searchable} = action.payload
  const visibility = searchable ? RPCTypes.IdentityVisibility.public : RPCTypes.IdentityVisibility.private
  try {
    await RPCTypes.phoneNumbersAddPhoneNumberRpcPromise(
      {phoneNumber, visibility},
      Constants.addPhoneNumberWaitingKey
    )
    logger.info('success')
    return SettingsGen.createAddedPhoneNumber({phoneNumber, searchable})
  } catch (error_) {
    const error = error_ as RPCError
    logger.warn('error ', error.message)
    const message = Constants.makePhoneError(error)
    return SettingsGen.createAddedPhoneNumber({error: message, phoneNumber, searchable})
  }
}

const resendVerificationForPhoneNumber = async (
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
  } catch (error_) {
    const error = error_ as RPCError
    const message = Constants.makePhoneError(error)
    logger.warn('error ', message)
    return SettingsGen.createVerifiedPhoneNumber({error: message, phoneNumber})
  }
}

const verifyPhoneNumber = async (action: SettingsGen.VerifyPhoneNumberPayload, logger: Saga.SagaLogger) => {
  logger.info('verifying phone number')
  const {code, phoneNumber} = action.payload
  try {
    await RPCTypes.phoneNumbersVerifyPhoneNumberRpcPromise(
      {code, phoneNumber},
      Constants.verifyPhoneNumberWaitingKey
    )
    logger.info('success')
    return SettingsGen.createVerifiedPhoneNumber({phoneNumber})
  } catch (error_) {
    const error = error_ as RPCError
    const message = Constants.makePhoneError(error)
    logger.warn('error ', message)
    return SettingsGen.createVerifiedPhoneNumber({error: message, phoneNumber})
  }
}

const loadContactImportEnabled = async (
  state: Container.TypedState,
  action: SettingsGen.LoadContactImportEnabledPayload | ConfigGen.LoadOnStartPayload,
  logger: Saga.SagaLogger
) => {
  if (!state.config.loggedIn) {
    return
  }
  if (action.type === ConfigGen.loadOnStart && action.payload.phase !== 'startupOrReloginButNotInARush') {
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
  } catch (error_) {
    const error = error_ as RPCError
    if (!error.message.includes('no such key')) {
      logger.error(`Error reading config: ${error.message}`)
    }
  }
  return SettingsGen.createLoadedContactImportEnabled({enabled})
}

const editContactImportEnabled = async (
  state: Container.TypedState,
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

const addEmail = async (
  state: Container.TypedState,
  action: SettingsGen.AddEmailPayload,
  logger: Saga.SagaLogger
) => {
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
  } catch (error_) {
    const error = error_ as RPCError
    logger.warn(`error: ${error.message}`)
    return SettingsGen.createAddedEmail({email, error: Constants.makeAddEmailError(error)})
  }
}

const emailAddressVerified = (
  action: EngineGen.Keybase1NotifyEmailAddressEmailAddressVerifiedPayload,
  logger: Saga.SagaLogger
) => {
  logger.info('email verified')
  return SettingsGen.createEmailVerified({email: action.payload.params.emailAddress})
}

const loginBrowserViaWebAuthToken = async () => {
  const link = await RPCTypes.configGenerateWebAuthTokenRpcPromise()
  openURL(link)
}

const maybeClearAddedEmail = (state: Container.TypedState, action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  // Clear "check your inbox" in settings when you leave the settings tab
  if (
    state.settings.email.addedEmail &&
    Router2Constants.getRouteTab(prev) === Tabs.settingsTab &&
    Router2Constants.getRouteTab(next) !== Tabs.settingsTab
  ) {
    return SettingsGen.createClearAddedEmail()
  }
  return false
}

function* settingsSaga() {
  yield* Saga.chainAction(SettingsGen.invitesReclaim, reclaimInvite)
  yield* Saga.chainAction2(SettingsGen.invitesRefresh, refreshInvites)
  yield* Saga.chainAction(SettingsGen.invitesSend, sendInvite)
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
  yield* Saga.chainAction(SettingsGen.onChangeRememberPassword, rememberPassword)
  yield* Saga.chainAction2(SettingsGen.loadLockdownMode, loadLockdownMode)
  yield* Saga.chainAction2(SettingsGen.onChangeLockdownMode, setLockdownMode)
  yield* Saga.chainAction2(SettingsGen.sendFeedback, sendFeedback)
  yield* Saga.chainAction2(SettingsGen.contactSettingsRefresh, contactSettingsRefresh)
  yield* Saga.chainAction2(SettingsGen.contactSettingsSaved, contactSettingsSaved)
  yield* Saga.chainAction2(SettingsGen.unfurlSettingsRefresh, unfurlSettingsRefresh)
  yield* Saga.chainAction2(SettingsGen.unfurlSettingsSaved, unfurlSettingsSaved)
  yield* Saga.chainAction2(SettingsGen.loadHasRandomPw, loadHasRandomPW)
  yield* Saga.chainAction(EngineGen.keybase1NotifyUsersPasswordChanged, passwordChanged)

  yield* Saga.chainAction(SettingsGen.stop, stop)

  yield* Saga.chainAction(SettingsGen.checkPassword, checkPassword)

  yield* Saga.chainAction2(SettingsGen.loadProxyData, loadProxyData)
  yield* Saga.chainAction(SettingsGen.saveProxyData, saveProxyData)

  // Phone numbers
  yield* Saga.chainAction2(SettingsGen.loadDefaultPhoneNumberCountry, loadDefaultPhoneNumberCountry)
  yield* Saga.chainAction(SettingsGen.editPhone, editPhone)
  yield* Saga.chainAction(SettingsGen.addPhoneNumber, addPhoneNumber)
  yield* Saga.chainAction(SettingsGen.verifyPhoneNumber, verifyPhoneNumber)
  yield* Saga.chainAction(SettingsGen.resendVerificationForPhoneNumber, resendVerificationForPhoneNumber)

  // Contacts
  yield* Saga.chainAction2(
    [SettingsGen.loadContactImportEnabled, ConfigGen.loadOnStart],
    loadContactImportEnabled
  )
  yield* Saga.chainAction2(SettingsGen.editContactImportEnabled, editContactImportEnabled)

  // Emails
  yield* Saga.chainAction2(SettingsGen.editEmail, editEmail)
  yield* Saga.chainAction2(SettingsGen.addEmail, addEmail)
  yield* Saga.chainAction2(SettingsGen.onSubmitNewEmail, onSubmitNewEmail)
  yield* Saga.chainAction(EngineGen.keybase1NotifyEmailAddressEmailAddressVerified, emailAddressVerified)

  yield* Saga.chainAction2(RouteTreeGen.onNavChanged, maybeClearAddedEmail)
  yield* Saga.chainAction2(SettingsGen.loginBrowserViaWebAuthToken, loginBrowserViaWebAuthToken)
}

export default settingsSaga
