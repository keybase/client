import * as ConfigGen from '../config-gen'
import * as Container from '../../util/container'
import * as DevicesGen from '../devices-gen'
import * as EngineGen from '../engine-gen-gen'
import * as GregorGen from '../gregor-gen'
import * as LoginConstants from '../../constants/login'
import * as Platform from '../../constants/platform'
import * as PushGen from '../push-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Router2 from '../../constants/router2'
import * as SettingsConstants from '../../constants/settings'
import * as SettingsGen from '../settings-gen'
import * as Tabs from '../../constants/tabs'
import logger from '../../logger'
import {initPlatformListener} from '../platform-specific'
import {noVersion} from '../../constants/whats-new'

const onLoggedIn = (state: Container.TypedState, action: EngineGen.Keybase1NotifySessionLoggedInPayload) => {
  logger.info('keybase.1.NotifySession.loggedIn')
  // only send this if we think we're not logged in
  if (!state.config.loggedIn) {
    return ConfigGen.createLoggedIn({causedBySignup: action.payload.params.signedUp, causedByStartup: false})
  }
  return undefined
}

const onLoggedOut = (state: Container.TypedState) => {
  logger.info('keybase.1.NotifySession.loggedOut')
  // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
  if (state.config.loggedIn) {
    return ConfigGen.createLoggedOut()
  }
  return undefined
}

const onConnected = () => ConfigGen.createStartHandshake()
const onDisconnected = () => {
  logger
    .dump()
    .then(() => {})
    .catch(() => {})
  return ConfigGen.createDaemonError({daemonError: new Error('Disconnected')})
}

const onTrackingInfo = (_: unknown, action: EngineGen.Keybase1NotifyTrackingTrackingInfoPayload) =>
  ConfigGen.createFollowerInfoUpdated({
    followees: action.payload.params.followees || [],
    followers: action.payload.params.followers || [],
    uid: action.payload.params.uid,
  })

const onHTTPSrvInfoUpdated = (_: unknown, action: EngineGen.Keybase1NotifyServiceHTTPSrvInfoUpdatePayload) =>
  ConfigGen.createUpdateHTTPSrvInfo({
    address: action.payload.params.info.address,
    token: action.payload.params.info.token,
  })

const getFollowerInfo = (state: Container.TypedState, action: ConfigGen.LoadOnStartPayload) => {
  const {uid} = state.config
  logger.info(`getFollowerInfo: init; uid=${uid}`)
  if (action.type === ConfigGen.loadOnStart && action.payload.phase !== 'startupOrReloginButNotInARush') {
    logger.info(
      `getFollowerInfo: bailing out early due to type=${action.type}; phase=${action.payload.phase}`
    )
    return
  }
  if (uid) {
    // request follower info in the background
    RPCTypes.configRequestFollowingAndUnverifiedFollowersRpcPromise()
      .then(() => {})
      .catch(() => {})
  }
}

// set to true so we reget status when we're reachable again
let wasUnreachable = false
const loadDaemonBootstrapStatus = async (
  _: Container.TypedState,
  action:
    | ConfigGen.LoggedInPayload
    | ConfigGen.DaemonHandshakePayload
    | GregorGen.UpdateReachablePayload
    | ConfigGen.LoggedOutPayload,
  listenerApi: Container.ListenerApi
) => {
  // Ignore the 'fake' loggedIn cause we'll get the daemonHandshake and we don't want to do this twice
  if (action.type === ConfigGen.loggedIn && action.payload.causedByStartup) {
    return
  }

  if (action.type === GregorGen.updateReachable && action.payload.reachable === RPCTypes.Reachable.no) {
    wasUnreachable = true
  }

  const makeCall = async () => {
    const s = await RPCTypes.configGetBootstrapStatusRpcPromise()
    const loadedAction = ConfigGen.createBootstrapStatusLoaded({
      deviceID: s.deviceID,
      deviceName: s.deviceName,
      fullname: s.fullname || '',
      loggedIn: s.loggedIn,
      registered: s.registered,
      uid: s.uid,
      userReacjis: s.userReacjis,
      username: s.username,
    })
    logger.info(`[Bootstrap] loggedIn: ${loadedAction.payload.loggedIn ? 1 : 0}`)
    listenerApi.dispatch(loadedAction)
    // set HTTP srv info
    if (s.httpSrvInfo) {
      logger.info(`[Bootstrap] http server: addr: ${s.httpSrvInfo.address} token: ${s.httpSrvInfo.token}`)
      listenerApi.dispatch(
        ConfigGen.createUpdateHTTPSrvInfo({address: s.httpSrvInfo.address, token: s.httpSrvInfo.token})
      )
    } else {
      logger.info(`[Bootstrap] http server: no info given`)
    }

    // if we're logged in act like getAccounts is done already
    if (action.type === ConfigGen.daemonHandshake && loadedAction.payload.loggedIn) {
      const newState = listenerApi.getState()
      if (newState.config.daemonHandshakeWaiters.get(getAccountsWaitKey)) {
        listenerApi.dispatch(
          ConfigGen.createDaemonHandshakeWait({
            increment: false,
            name: getAccountsWaitKey,
            version: action.payload.version,
          })
        )
      }
    }
  }

  switch (action.type) {
    case ConfigGen.daemonHandshake:
      listenerApi.dispatch(
        ConfigGen.createDaemonHandshakeWait({
          increment: true,
          name: 'config.getBootstrapStatus',
          version: action.payload.version,
        })
      )
      await makeCall()
      listenerApi.dispatch(
        ConfigGen.createDaemonHandshakeWait({
          increment: false,
          name: 'config.getBootstrapStatus',
          version: action.payload.version,
        })
      )
      break
    case GregorGen.updateReachable:
      if (action.payload.reachable === RPCTypes.Reachable.yes && wasUnreachable) {
        wasUnreachable = false // reset it
        await makeCall()
      }
      break
    case ConfigGen.loggedIn:
      await makeCall()
      break
    case ConfigGen.loggedOut:
      await makeCall()
      break
  }
}

let _firstTimeConnecting = true
const startHandshake = (state: Container.TypedState) => {
  const firstTimeConnecting = _firstTimeConnecting
  _firstTimeConnecting = false
  if (firstTimeConnecting) {
    logger.info('First bootstrap started')
  }
  return ConfigGen.createDaemonHandshake({
    firstTimeConnecting,
    version: state.config.daemonHandshakeVersion + 1,
  })
}

let _firstTimeBootstrapDone = true
const maybeDoneWithDaemonHandshake = (
  state: Container.TypedState,
  action: ConfigGen.DaemonHandshakeWaitPayload
) => {
  if (action.payload.version !== state.config.daemonHandshakeVersion) {
    // ignore out of date actions
    return
  }
  if (state.config.daemonHandshakeWaiters.size > 0) {
    // still waiting for things to finish
  } else {
    if (state.config.daemonHandshakeFailedReason) {
      if (state.config.daemonHandshakeRetriesLeft) {
        return ConfigGen.createRestartHandshake()
      }
    } else {
      if (_firstTimeBootstrapDone) {
        _firstTimeBootstrapDone = false
        logger.info('First bootstrap ended')
      }
      return ConfigGen.createDaemonHandshakeDone()
    }
  }
  return undefined
}

// Load accounts, this call can be slow so we attempt to continue w/o waiting if we determine we're logged in
// normally this wouldn't be worth it but this is startup
const getAccountsWaitKey = 'config.getAccounts'

const loadDaemonAccounts = async (
  state: Container.TypedState,
  action:
    | DevicesGen.RevokedPayload
    | ConfigGen.DaemonHandshakePayload
    | ConfigGen.LoggedOutPayload
    | ConfigGen.LoggedInPayload,
  listenerApi: Container.ListenerApi
) => {
  // ignore since we handle handshake
  if (action.type === ConfigGen.loggedIn && action.payload.causedByStartup) {
    return
  }

  let handshakeWait = false
  let handshakeVersion = 0

  if (action.type === ConfigGen.daemonHandshake) {
    handshakeVersion = action.payload.version
    // did we beat getBootstrapStatus?
    if (!state.config.loggedIn) {
      handshakeWait = true
    }
  }

  try {
    if (handshakeWait) {
      listenerApi.dispatch(
        ConfigGen.createDaemonHandshakeWait({
          increment: true,
          name: getAccountsWaitKey,
          version: handshakeVersion,
        })
      )
    }

    const configuredAccounts = (await RPCTypes.loginGetConfiguredAccountsRpcPromise()) ?? []
    listenerApi.dispatch(ConfigGen.createSetAccounts({configuredAccounts}))

    if (handshakeWait) {
      // someone dismissed this already?
      const newState = listenerApi.getState()
      if (newState.config.daemonHandshakeWaiters.get(getAccountsWaitKey)) {
        listenerApi.dispatch(
          ConfigGen.createDaemonHandshakeWait({
            increment: false,
            name: getAccountsWaitKey,
            version: handshakeVersion,
          })
        )
      }
    }
  } catch (error) {
    if (handshakeWait) {
      // someone dismissed this already?
      const newState = listenerApi.getState()
      if (newState.config.daemonHandshakeWaiters.get(getAccountsWaitKey)) {
        listenerApi.dispatch(
          ConfigGen.createDaemonHandshakeWait({
            failedReason: "Can't get accounts",
            increment: false,
            name: getAccountsWaitKey,
            version: handshakeVersion,
          })
        )
      }
    }
  }
}

const showDeletedSelfRootPage = () => [
  RouteTreeGen.createSwitchLoggedIn({loggedIn: false}),
  RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]}),
]

const resetGlobalStore = (): any => ({payload: {}, type: 'common:resetStore'})

// Figure out whether we can log out using CanLogout, if so,
// startLogoutHandshake, else do what's needed - right now only
// redirect to set password screen.
const startLogoutHandshakeIfAllowed = async (state: Container.TypedState) => {
  const canLogoutRes = await RPCTypes.userCanLogoutRpcPromise()
  if (canLogoutRes.canLogout) {
    return startLogoutHandshake(state)
  } else {
    if (Platform.isMobile) {
      return RouteTreeGen.createNavigateAppend({
        path: [Tabs.settingsTab, SettingsConstants.passwordTab],
      })
    } else {
      return [
        RouteTreeGen.createNavigateAppend({path: [Tabs.settingsTab]}),
        RouteTreeGen.createNavigateAppend({path: [SettingsConstants.passwordTab]}),
      ]
    }
  }
}

const startLogoutHandshake = (state: Container.TypedState) =>
  ConfigGen.createLogoutHandshake({version: state.config.logoutHandshakeVersion + 1})

// This assumes there's at least a single waiter to trigger this, so if that ever changes you'll have to add
// stuff to trigger this due to a timeout if there's no listeners or something
const maybeDoneWithLogoutHandshake = async (state: Container.TypedState) => {
  if (state.config.logoutHandshakeWaiters.size <= 0) {
    await RPCTypes.loginLogoutRpcPromise({force: false, keepSecrets: false})
  }
}

// Monster push prompt
// We've just started up, we don't have the permissions, we're logged in and we
// haven't just signed up. This handles the scenario where the push notifications
// permissions checker finishes after the routeToInitialScreen is done.
const onShowPermissionsPrompt = async (
  state: Container.TypedState,
  action: PushGen.ShowPermissionsPromptPayload,
  listenerApi: Container.ListenerApi
) => {
  if (
    !Platform.isMobile ||
    !action.payload.show ||
    !state.config.loggedIn ||
    state.push.justSignedUp ||
    state.push.hasPermissions
  ) {
    return
  }

  logger.info('[ShowMonsterPushPrompt] Entered through the late permissions checker scenario')
  listenerApi.dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
  await Container.timeoutPromise(100)
  listenerApi.dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab}))
  listenerApi.dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsPushPrompt']}))
}

const onAndroidShare = (state: Container.TypedState) => {
  // already loaded, so just go now
  if (state.config.startupDetailsLoaded) {
    return RouteTreeGen.createNavigateAppend({path: ['incomingShareNew']})
  }
  return false
}

let maybeLoadAppLinkOnce = false
const maybeLoadAppLink = (state: Container.TypedState) => {
  const phones = state.settings.phoneNumbers.phones
  if (!phones || phones.size > 0) {
    return
  }

  if (maybeLoadAppLinkOnce || !state.config.startupLink || !state.config.startupLink.endsWith('/phone-app')) {
    return
  }
  maybeLoadAppLinkOnce = true

  return [
    RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}),
    RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']}),
  ]
}

let _emitInitialLoggedInOnce = false
const emitInitialLoggedIn = (state: Container.TypedState) => {
  if (_emitInitialLoggedInOnce) {
    return false
  }
  _emitInitialLoggedInOnce = true
  return state.config.loggedIn && ConfigGen.createLoggedIn({causedBySignup: false, causedByStartup: true})
}

const allowLogoutWaiters = async (
  _: Container.TypedState,
  action: ConfigGen.LogoutHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  listenerApi.dispatch(
    ConfigGen.createLogoutHandshakeWait({
      increment: true,
      name: 'nullhandshake',
      version: action.payload.version,
    })
  )
  await listenerApi.delay(10)
  listenerApi.dispatch(
    ConfigGen.createLogoutHandshakeWait({
      increment: false,
      name: 'nullhandshake',
      version: action.payload.version,
    })
  )
}

const updateServerConfig = async (state: Container.TypedState, action: ConfigGen.LoadOnStartPayload) =>
  action.payload.phase === 'startupOrReloginButNotInARush' &&
  state.config.loggedIn &&
  RPCTypes.configUpdateLastLoggedInAndServerConfigRpcPromise({
    serverConfigPath: Platform.serverConfigFileName,
  }).catch(e => {
    logger.warn("Can't call UpdateLastLoggedInAndServerConfig", e)
  })

const newNavigation = (
  _: unknown,
  action:
    | RouteTreeGen.SetParamsPayload
    | RouteTreeGen.NavigateAppendPayload
    | RouteTreeGen.NavigateUpPayload
    | RouteTreeGen.SwitchLoggedInPayload
    | RouteTreeGen.ClearModalsPayload
    | RouteTreeGen.NavUpToScreenPayload
    | RouteTreeGen.SwitchTabPayload
    | RouteTreeGen.PopStackPayload
) => {
  Router2.dispatchOldAction(action)
}

const criticalOutOfDateCheck = async (listenerApi: Container.ListenerApi) => {
  await listenerApi.delay(60_000) // don't bother checking during startup
  // check every hour
  // eslint-disable-next-line
  while (true) {
    try {
      const s = await RPCTypes.configGetUpdateInfo2RpcPromise({})
      let status: ConfigGen.UpdateCriticalCheckStatusPayload['payload']['status'] = 'ok'
      let message: string | null = null
      switch (s.status) {
        case RPCTypes.UpdateInfoStatus2.ok:
          break
        case RPCTypes.UpdateInfoStatus2.suggested:
          status = 'suggested'
          message = s.suggested.message
          break
        case RPCTypes.UpdateInfoStatus2.critical:
          status = 'critical'
          message = s.critical.message
          break
        default:
      }
      listenerApi.dispatch(ConfigGen.createUpdateCriticalCheckStatus({message: message || '', status}))
    } catch (e) {
      logger.warn("Can't call critical check", e)
    }
    // We just need this once on mobile. Long timers don't work there.
    if (Platform.isMobile) {
      return
    }
    await listenerApi.delay(3_600_000) // 1 hr
  }
}

const loadDarkPrefs = async () => {
  try {
    const v = await RPCTypes.configGuiGetValueRpcPromise({path: 'ui.darkMode'})
    const preference = v.s || undefined

    switch (preference) {
      case 'system':
        return ConfigGen.createSetDarkModePreference({preference})
      case 'alwaysDark':
        return ConfigGen.createSetDarkModePreference({preference})
      case 'alwaysLight':
        return ConfigGen.createSetDarkModePreference({preference})
      default:
        return false
    }
  } catch (_) {
    return false
  }
}

const saveDarkPrefs = async (state: Container.TypedState) => {
  try {
    await RPCTypes.configGuiSetValueRpcPromise({
      path: 'ui.darkMode',
      value: {isNull: false, s: state.config.darkModePreference},
    })
  } catch (_) {}
}

const logoutAndTryToLogInAs = async (
  state: Container.TypedState,
  action: ConfigGen.LogoutAndTryToLogInAsPayload
) => {
  if (state.config.loggedIn) {
    await RPCTypes.loginLogoutRpcPromise({force: false, keepSecrets: true}, LoginConstants.waitingKey)
  }
  return ConfigGen.createSetDefaultUsername({username: action.payload.username})
}

const gregorPushState = (_: unknown, action: GregorGen.PushStatePayload) => {
  const actions: Array<Container.TypedActions> = []
  const items = action.payload.state
  const lastSeenItem = items.find(i => i.item && i.item.category === 'whatsNewLastSeenVersion')
  if (lastSeenItem) {
    const {body} = lastSeenItem.item
    const pushStateLastSeenVersion = Buffer.from(body).toString()
    const lastSeenVersion = pushStateLastSeenVersion || noVersion
    // Default to 0.0.0 (noVersion) if user has never marked a version as seen
    actions.push(
      ConfigGen.createSetWhatsNewLastSeenVersion({
        lastSeenVersion,
      })
    )
  } else {
    actions.push(
      ConfigGen.createSetWhatsNewLastSeenVersion({
        lastSeenVersion: noVersion,
      })
    )
  }
  return actions
}

const loadOnLoginStartup = async () => {
  try {
    const status = (await RPCTypes.ctlGetOnLoginStartupRpcPromise()) === RPCTypes.OnLoginStartupStatus.enabled
    return ConfigGen.createLoadedOnLoginStartup({status})
  } catch (err) {
    logger.warn('Error in loading proxy data', err)
    return null
  }
}

const toggleRuntimeStats = async () => {
  try {
    await RPCTypes.configToggleRuntimeStatsRpcPromise()
  } catch (err) {
    logger.warn('error toggling runtime stats', err)
  }
}
const emitStartupOnLoadNotInARush = async () => {
  await Container.timeoutPromise(1000)
  return new Promise<ConfigGen.LoadOnStartPayload>(resolve => {
    requestAnimationFrame(() => {
      resolve(ConfigGen.createLoadOnStart({phase: 'startupOrReloginButNotInARush'}))
    })
  })
}

const emitStartupOnLoadNotInARushLoggedIn = async (
  _: Container.TypedState,
  action: ConfigGen.LoggedInPayload
) => {
  if (action.payload.causedByStartup) {
    return false
  }
  await Container.timeoutPromise(1000)
  return new Promise<ConfigGen.LoadOnStartPayload>(resolve => {
    requestAnimationFrame(() => {
      resolve(ConfigGen.createLoadOnStart({phase: 'startupOrReloginButNotInARush'}))
    })
  })
}

let _emitStartupOnLoadDaemonConnectedOnce = false
const emitStartupOnLoadDaemonConnectedOnce = () => {
  if (!_emitStartupOnLoadDaemonConnectedOnce) {
    _emitStartupOnLoadDaemonConnectedOnce = true
    return ConfigGen.createLoadOnStart({phase: 'connectedToDaemonForFirstTime'})
  }
  return false
}

const emitStartupOnLoadLoggedIn = (_: Container.TypedState, action: ConfigGen.LoggedInPayload) => {
  return !action.payload.causedByStartup ? ConfigGen.createLoadOnStart({phase: 'reloggedIn'}) : false
}

const onPowerMonitorEvent = async (_s: unknown, action: ConfigGen.PowerMonitorEventPayload) => {
  const {event} = action.payload
  try {
    await RPCTypes.appStatePowerMonitorEventRpcPromise({event})
  } catch {}
}

const initConfig = () => {
  // Start the handshake process. This means we tell all sagas we're handshaking with the daemon. If another
  // saga needs to do something before we leave the loading screen they should call daemonHandshakeWait
  Container.listenAction([ConfigGen.restartHandshake, ConfigGen.startHandshake], startHandshake)
  // When there are no more waiters, we can show the actual app
  Container.listenAction(ConfigGen.daemonHandshakeWait, maybeDoneWithDaemonHandshake)
  // darkmode
  Container.listenAction(ConfigGen.daemonHandshake, loadDarkPrefs)
  // Re-get info about our account if you log in/we're done handshaking/became reachable
  Container.listenAction(
    [ConfigGen.loggedIn, ConfigGen.daemonHandshake, GregorGen.updateReachable],
    loadDaemonBootstrapStatus
  )
  // Load the known accounts if you revoke / handshake / logout
  Container.listenAction(
    [DevicesGen.revoked, ConfigGen.daemonHandshake, ConfigGen.loggedOut, ConfigGen.loggedIn],
    loadDaemonAccounts
  )

  Container.listenAction(ConfigGen.daemonHandshakeDone, emitStartupOnLoadNotInARush)
  Container.listenAction(ConfigGen.daemonHandshakeDone, emitStartupOnLoadDaemonConnectedOnce)
  Container.listenAction(ConfigGen.loggedIn, emitStartupOnLoadLoggedIn)
  Container.listenAction(ConfigGen.loggedIn, emitStartupOnLoadNotInARushLoggedIn)

  Container.listenAction(ConfigGen.logoutAndTryToLogInAs, logoutAndTryToLogInAs)

  Container.listenAction(
    [
      RouteTreeGen.setParams,
      RouteTreeGen.navigateAppend,
      RouteTreeGen.navigateUp,
      RouteTreeGen.switchLoggedIn,
      RouteTreeGen.clearModals,
      RouteTreeGen.navUpToScreen,
      RouteTreeGen.switchTab,
      RouteTreeGen.popStack,
    ],
    newNavigation
  )
  // If you start logged in we don't get the incoming call from the daemon so we generate our own here
  Container.listenAction(ConfigGen.daemonHandshakeDone, emitInitialLoggedIn)

  // Like handshake but in reverse, ask sagas to do stuff before we tell the server to log us out
  Container.listenAction(ConfigGen.logout, startLogoutHandshakeIfAllowed)
  // Give time for all waiters to register and allow the case where there are no waiters
  Container.listenAction(ConfigGen.logoutHandshake, allowLogoutWaiters)
  Container.listenAction(ConfigGen.logoutHandshakeWait, maybeDoneWithLogoutHandshake)
  // When we're all done lets clean up
  Container.listenAction(ConfigGen.loggedOut, resetGlobalStore)
  // Store per user server config info
  Container.listenAction(ConfigGen.loadOnStart, updateServerConfig)

  Container.listenAction(ConfigGen.setDeletedSelf, showDeletedSelfRootPage)

  Container.listenAction(EngineGen.keybase1NotifySessionLoggedIn, onLoggedIn)
  Container.listenAction(EngineGen.keybase1NotifySessionLoggedOut, onLoggedOut)
  Container.listenAction(EngineGen.connected, onConnected)
  Container.listenAction(EngineGen.disconnected, onDisconnected)
  Container.listenAction(EngineGen.keybase1NotifyTrackingTrackingInfo, onTrackingInfo)
  Container.listenAction(EngineGen.keybase1NotifyServiceHTTPSrvInfoUpdate, onHTTPSrvInfoUpdated)

  // Listen for updates to `whatsNewLastSeenVersion`
  Container.listenAction(GregorGen.pushState, gregorPushState)

  Container.listenAction(SettingsGen.loadedSettings, maybeLoadAppLink)

  Container.listenAction(ConfigGen.setDarkModePreference, saveDarkPrefs)
  Container.listenAction(ConfigGen.loadOnStart, getFollowerInfo)

  Container.listenAction(ConfigGen.toggleRuntimeStats, toggleRuntimeStats)

  Container.listenAction(PushGen.showPermissionsPrompt, onShowPermissionsPrompt)
  Container.listenAction(ConfigGen.androidShare, onAndroidShare)

  // Kick off platform specific stuff
  initPlatformListener()

  Container.spawn(criticalOutOfDateCheck, 'criticalOutOfDateCheck')
  Container.listenAction(ConfigGen.loadOnLoginStartup, loadOnLoginStartup)
  Container.listenAction(ConfigGen.powerMonitorEvent, onPowerMonitorEvent)
}

export default initConfig
