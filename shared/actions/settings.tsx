import * as ChatTypes from '../constants/types/rpc-chat-gen'
import * as ConfigGen from './config-gen'
import * as Constants from '../constants/settings'
import * as WaitingConstants from '../constants/waiting'
import * as ConfigConstants from '../constants/config'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Router2Constants from '../constants/router2'
import * as SettingsGen from './settings-gen'
import * as Tabs from '../constants/tabs'
import logger from '../logger'
import openURL from '../util/open-url'
import * as Container from '../util/container'
import type * as Types from '../constants/types/settings'
import {RPCError} from '../util/errors'
import {isAndroidNewerThanN, androidIsTestDevice, pprofDir, version} from '../constants/platform'

const onSubmitNewEmail = async (state: Container.TypedState) => {
  try {
    const newEmail = state.settings.email.newEmail
    await RPCTypes.accountEmailChangeRpcPromise({newEmail}, Constants.settingsWaitingKey)
    Constants.useState.getState().dispatch.loadSettings()
    return RouteTreeGen.createNavigateUp()
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return SettingsGen.createOnUpdateEmailError({error})
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

const refreshNotifications = async (_s: unknown, _a: unknown, listenerApi: Container.ListenerApi) => {
  // If the rpc is fast don't clear it out first
  const delayThenEmptyTask = listenerApi.fork(async () => {
    await listenerApi.delay(500)
    listenerApi.dispatch(SettingsGen.createNotificationsRefreshed({notifications: new Map()}))
  })

  let body = ''
  let chatGlobalSettings: ChatTypes.GlobalAppNotificationSettings

  try {
    const json = await RPCTypes.apiserverGetWithSessionRpcPromise(
      {args: [], endpoint: 'account/subscriptions'},
      Constants.refreshNotificationsWaitingKey
    )
    chatGlobalSettings = await ChatTypes.localGetGlobalAppNotificationSettingsLocalRpcPromise(
      undefined,
      Constants.refreshNotificationsWaitingKey
    )
    if (json) {
      body = json.body
    }
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    // No need to throw black bars -- handled by Reloadable.
    logger.warn(`Error getting notification settings: ${error.desc}`)
    return
  }

  delayThenEmptyTask.cancel()

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
  listenerApi.dispatch(
    SettingsGen.createNotificationsRefreshed({
      notifications: new Map(Object.entries(results.notifications)),
    })
  )
}

const dbNuke = async () => {
  await RPCTypes.ctlDbNukeRpcPromise(undefined, Constants.settingsWaitingKey)
}

const deleteAccountForever = async (_: unknown, action: SettingsGen.DeleteAccountForeverPayload) => {
  const username = ConfigConstants.useCurrentUserState.getState().username

  if (!username) {
    throw new Error('Unable to delete account: no username set')
  }

  await RPCTypes.loginAccountDeleteRpcPromise(
    {passphrase: action.payload.passphrase?.stringValue()},
    Constants.settingsWaitingKey
  )

  ConfigConstants.useConfigState.getState().dispatch.setJustDeletedSelf(username)

  return [
    RouteTreeGen.createSwitchLoggedIn({loggedIn: false}),
    RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]}),
  ]
}

const editEmail = async (state: Container.TypedState, action: SettingsGen.EditEmailPayload) => {
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

const trace = async (
  _: Container.TypedState,
  action: SettingsGen.TracePayload,
  listenerApi: Container.ListenerApi
) => {
  const durationSeconds = action.payload.durationSeconds
  await RPCTypes.pprofLogTraceRpcPromise({logDirForMobile: pprofDir, traceDurationSeconds: durationSeconds})
  const {decrement, increment} = WaitingConstants.useWaitingState.getState().dispatch
  increment(Constants.traceInProgressKey)
  await listenerApi.delay(durationSeconds * 1_000)
  decrement(Constants.traceInProgressKey)
}

const processorProfile = async (
  _: Container.TypedState,
  action: SettingsGen.ProcessorProfilePayload,
  listenerApi: Container.ListenerApi
) => {
  const durationSeconds = action.payload.durationSeconds
  await RPCTypes.pprofLogProcessorProfileRpcPromise({
    logDirForMobile: pprofDir,
    profileDurationSeconds: durationSeconds,
  })

  const {decrement, increment} = WaitingConstants.useWaitingState.getState().dispatch
  increment(Constants.processorProfileInProgressKey)
  await listenerApi.delay(durationSeconds * 1_000)
  decrement(Constants.processorProfileInProgressKey)
}

const sendFeedback = async (state: Container.TypedState, action: SettingsGen.SendFeedbackPayload) => {
  // We don't want test devices (pre-launch reports) to send us log sends.
  if (androidIsTestDevice) {
    return
  }
  const {feedback, sendLogs, sendMaxBytes} = action.payload
  try {
    if (sendLogs) {
      await logger.dump()
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
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn('err in sending logs', error)
    return SettingsGen.createFeedbackSent({error: error as Error})
  }
}

const contactSettingsRefresh = async () => {
  if (!ConfigConstants.useConfigState.getState().loggedIn) {
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

const contactSettingsSaved = async (_: unknown, action: SettingsGen.ContactSettingsSavedPayload) => {
  if (!ConfigConstants.useConfigState.getState().loggedIn) {
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

const unfurlSettingsRefresh = async () => {
  if (!ConfigConstants.useConfigState.getState().loggedIn) {
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

const unfurlSettingsSaved = async (_: unknown, action: SettingsGen.UnfurlSettingsSavedPayload) => {
  if (!ConfigConstants.useConfigState.getState().loggedIn) {
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

const stop = async (_: unknown, action: SettingsGen.StopPayload) => {
  await RPCTypes.ctlStopRpcPromise({exitCode: action.payload.exitCode})
  return false as const
}

const loadContactImportEnabled = async (
  _: unknown,
  action: SettingsGen.LoadContactImportEnabledPayload | ConfigGen.LoadOnStartPayload
) => {
  if (!ConfigConstants.useConfigState.getState().loggedIn) {
    return
  }
  if (action.type === ConfigGen.loadOnStart && action.payload.phase !== 'startupOrReloginButNotInARush') {
    return
  }
  const username = ConfigConstants.useCurrentUserState.getState().username
  if (!username) {
    logger.warn('no username')
    return
  }
  let enabled = false
  try {
    const value = await RPCTypes.configGuiGetValueRpcPromise(
      {path: Constants.importContactsConfigKey(username)},
      Constants.importContactsWaitingKey
    )
    enabled = !!value.b && !value.isNull
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (!error.message.includes('no such key')) {
      logger.error(`Error reading config: ${error.message}`)
    }
  }
  return SettingsGen.createLoadedContactImportEnabled({enabled})
}

const editContactImportEnabled = async (_: unknown, action: SettingsGen.EditContactImportEnabledPayload) => {
  const username = ConfigConstants.useCurrentUserState.getState().username
  if (!username) {
    logger.warn('no username')
    return false
  }
  await RPCTypes.configGuiSetValueRpcPromise(
    {
      path: Constants.importContactsConfigKey(username),
      value: {b: action.payload.enable, isNull: false},
    },
    Constants.importContactsWaitingKey
  )
  return SettingsGen.createLoadContactImportEnabled()
}

const makeAddEmailError = (err: RPCError): string => {
  switch (err.code) {
    case RPCTypes.StatusCode.scratelimit:
      return "Sorry, you've added too many email addresses lately. Please try again later."
    case RPCTypes.StatusCode.scemailtaken:
      return 'This email is already claimed by another user.'
    case RPCTypes.StatusCode.scemaillimitexceeded:
      return 'You have too many emails, delete one and try again.'
    case RPCTypes.StatusCode.scinputerror:
      return 'Invalid email.'
  }
  return err.message
}
const addEmail = async (state: Container.TypedState, action: SettingsGen.AddEmailPayload) => {
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
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`error: ${error.message}`)
    return SettingsGen.createAddedEmail({email, error: makeAddEmailError(error)})
  }
}

const emailAddressVerified = (
  _: unknown,
  action: EngineGen.Keybase1NotifyEmailAddressEmailAddressVerifiedPayload
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
    prev &&
    Router2Constants.getTab(prev) === Tabs.settingsTab &&
    next &&
    Router2Constants.getTab(next) !== Tabs.settingsTab
  ) {
    return SettingsGen.createClearAddedEmail()
  }
  return false
}

const initSettings = () => {
  Container.listenAction(SettingsGen.notificationsRefresh, refreshNotifications)
  Container.listenAction(SettingsGen.notificationsToggle, toggleNotifications)
  Container.listenAction(SettingsGen.dbNuke, dbNuke)
  Container.listenAction(SettingsGen.deleteAccountForever, deleteAccountForever)
  Container.listenAction(SettingsGen.trace, trace)
  Container.listenAction(SettingsGen.processorProfile, processorProfile)
  Container.listenAction(SettingsGen.sendFeedback, sendFeedback)
  Container.listenAction(SettingsGen.contactSettingsRefresh, contactSettingsRefresh)
  Container.listenAction(SettingsGen.contactSettingsSaved, contactSettingsSaved)
  Container.listenAction(SettingsGen.unfurlSettingsRefresh, unfurlSettingsRefresh)
  Container.listenAction(SettingsGen.unfurlSettingsSaved, unfurlSettingsSaved)
  Container.listenAction(EngineGen.keybase1NotifyUsersPasswordChanged, (_, action) => {
    const randomPW = action.payload.params.state === RPCTypes.PassphraseState.random
    Constants.usePasswordState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
  })

  Container.listenAction(SettingsGen.stop, stop)

  // Contacts
  Container.listenAction(
    [SettingsGen.loadContactImportEnabled, ConfigGen.loadOnStart],
    loadContactImportEnabled
  )
  Container.listenAction(SettingsGen.editContactImportEnabled, editContactImportEnabled)

  // Emails
  Container.listenAction(SettingsGen.editEmail, editEmail)
  Container.listenAction(SettingsGen.addEmail, addEmail)
  Container.listenAction(SettingsGen.onSubmitNewEmail, onSubmitNewEmail)
  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailAddressVerified, emailAddressVerified)

  Container.listenAction(RouteTreeGen.onNavChanged, maybeClearAddedEmail)
  Container.listenAction(SettingsGen.loginBrowserViaWebAuthToken, loginBrowserViaWebAuthToken)

  Container.listenAction(EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged, (_, action) => {
    const {list} = action.payload.params
    Constants.usePhoneState.getState().dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
  })
}

export default initSettings
