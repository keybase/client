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
import {isAndroidNewerThanN, pprofDir} from '../constants/platform'

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

const loginBrowserViaWebAuthToken = async () => {
  const link = await RPCTypes.configGenerateWebAuthTokenRpcPromise()
  openURL(link)
}

const initSettings = () => {
  Container.listenAction(SettingsGen.notificationsRefresh, refreshNotifications)
  Container.listenAction(SettingsGen.notificationsToggle, toggleNotifications)
  Container.listenAction(SettingsGen.dbNuke, dbNuke)
  Container.listenAction(SettingsGen.deleteAccountForever, deleteAccountForever)
  Container.listenAction(SettingsGen.trace, trace)
  Container.listenAction(SettingsGen.processorProfile, processorProfile)
  Container.listenAction(SettingsGen.contactSettingsRefresh, contactSettingsRefresh)
  Container.listenAction(SettingsGen.unfurlSettingsRefresh, unfurlSettingsRefresh)
  Container.listenAction(SettingsGen.unfurlSettingsSaved, unfurlSettingsSaved)
  Container.listenAction(EngineGen.keybase1NotifyUsersPasswordChanged, (_, action) => {
    const randomPW = action.payload.params.state === RPCTypes.PassphraseState.random
    Constants.usePasswordState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
  })

  Container.listenAction(SettingsGen.stop, stop)

  // Contacts
  Container.listenAction(ConfigGen.loadOnStart, () => {
    Constants.useContactsState.getState().dispatch.loadContactImportEnabled()
  })

  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
    // Clear "check your inbox" in settings when you leave the settings tab
    if (
      Constants.useEmailState.getState().addedEmail &&
      prev &&
      Router2Constants.getTab(prev) === Tabs.settingsTab &&
      next &&
      Router2Constants.getTab(next) !== Tabs.settingsTab
    ) {
      Constants.useEmailState.getState().dispatch.resetAddedEmail()
    }
  })
  Container.listenAction(SettingsGen.loginBrowserViaWebAuthToken, loginBrowserViaWebAuthToken)

  Container.listenAction(EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged, (_, action) => {
    const {list} = action.payload.params
    Constants.usePhoneState.getState().dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
  })

  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailsChanged, (_, action) => {
    const list = action.payload.params.list ?? []
    Constants.useEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(list)
  })

  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailAddressVerified, (_, action) => {
    logger.info('email verified')
    Constants.useEmailState.getState().dispatch.notifyEmailVerified(action.payload.params.emailAddress)
  })
}

export default initSettings
