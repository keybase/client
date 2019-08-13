import logger from '../../logger'
import {log} from '../../native/log/logui'
import * as ConfigGen from '../config-gen'
import * as GregorGen from '../gregor-gen'
import * as Flow from '../../util/flow'
import * as SettingsGen from '../settings-gen'
import * as ChatGen from '../chat2-gen'
import * as EngineGen from '../engine-gen-gen'
import * as DevicesGen from '../devices-gen'
import * as ProfileGen from '../profile-gen'
import * as FsGen from '../fs-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/config'
import * as ChatConstants from '../../constants/chat2'
import * as SettingsConstants from '../../constants/settings'
import * as Saga from '../../util/saga'
import * as PlatformSpecific from '../platform-specific'
import * as RouteTreeGen from '../route-tree-gen'
import * as Tabs from '../../constants/tabs'
import * as Router2 from '../../constants/router2'
import * as FsTypes from '../../constants/types/fs'
import * as FsConstants from '../../constants/fs'
import URL from 'url-parse'
import {isMobile} from '../../constants/platform'
import {updateServerConfigLastLoggedIn} from '../../app/server-config'
import * as Container from '../../util/container'

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

const onLog = (_: Container.TypedState, action: EngineGen.Keybase1LogUiLogPayload) => {
  log(action.payload.params)
}

const onConnected = () => ConfigGen.createStartHandshake()
const onDisconnected = () => {
  logger.flush()
  return ConfigGen.createDaemonError({daemonError: new Error('Disconnected')})
}

const onTrackingInfo = (
  _: Container.TypedState,
  action: EngineGen.Keybase1NotifyTrackingTrackingInfoPayload
) =>
  ConfigGen.createFollowerInfoUpdated({
    followees: action.payload.params.followees || [],
    followers: action.payload.params.followers || [],
    uid: action.payload.params.uid,
  })

const onHTTPSrvInfoUpdated = (
  _: Container.TypedState,
  action: EngineGen.Keybase1NotifyServiceHTTPSrvInfoUpdatePayload
) =>
  ConfigGen.createUpdateHTTPSrvInfo({
    address: action.payload.params.info.address,
    token: action.payload.params.info.token,
  })

// set to true so we reget status when we're reachable again
let wasUnreachable = false
function* loadDaemonBootstrapStatus(
  _: Container.TypedState,
  action:
    | ConfigGen.LoggedInPayload
    | ConfigGen.DaemonHandshakePayload
    | GregorGen.UpdateReachablePayload
    | ConfigGen.LoggedOutPayload
) {
  // Ignore the 'fake' loggedIn cause we'll get the daemonHandshake and we don't want to do this twice
  if (action.type === ConfigGen.loggedIn && action.payload.causedByStartup) {
    return
  }

  if (action.type === GregorGen.updateReachable && action.payload.reachable === RPCTypes.Reachable.no) {
    wasUnreachable = true
  }

  function* makeCall() {
    const s: Saga.RPCPromiseType<
      typeof RPCTypes.configGetBootstrapStatusRpcPromise
    > = yield RPCTypes.configGetBootstrapStatusRpcPromise()
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
    yield Saga.put(loadedAction)
    // request follower info in the background
    yield RPCTypes.configRequestFollowerInfoRpcPromise({uid: s.uid})
    // set HTTP srv info
    if (s.httpSrvInfo) {
      yield Saga.put(
        ConfigGen.createUpdateHTTPSrvInfo({address: s.httpSrvInfo.address, token: s.httpSrvInfo.token})
      )
    }

    // if we're logged in act like getAccounts is done already
    if (action.type === ConfigGen.daemonHandshake && loadedAction.payload.loggedIn) {
      const newState: Container.TypedState = yield* Saga.selectState()
      if (newState.config.daemonHandshakeWaiters.get(getAccountsWaitKey)) {
        yield Saga.put(
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
      yield Saga.put(
        ConfigGen.createDaemonHandshakeWait({
          increment: true,
          name: 'config.getBootstrapStatus',
          version: action.payload.version,
        })
      )
      yield* makeCall()
      yield Saga.put(
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
        yield* makeCall()
      }
      break
    case ConfigGen.loggedIn:
      yield* makeCall()
      break
    case ConfigGen.loggedOut:
      yield* makeCall()
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

function* loadDaemonAccounts(
  state: Container.TypedState,
  action:
    | DevicesGen.RevokedPayload
    | ConfigGen.DaemonHandshakePayload
    | ConfigGen.LoggedOutPayload
    | ConfigGen.LoggedInPayload
) {
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
      yield Saga.put(
        ConfigGen.createDaemonHandshakeWait({
          increment: true,
          name: getAccountsWaitKey,
          version: handshakeVersion,
        })
      )
    }

    const configuredAccounts: Array<
      RPCTypes.ConfiguredAccount
    > = yield RPCTypes.loginGetConfiguredAccountsRpcPromise()
    const loadedAction = ConfigGen.createSetAccounts({configuredAccounts})
    yield Saga.put(loadedAction)

    if (handshakeWait) {
      // someone dismissed this already?
      const newState: Container.TypedState = yield* Saga.selectState()
      if (newState.config.daemonHandshakeWaiters.get(getAccountsWaitKey)) {
        yield Saga.put(
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
      const newState: Container.TypedState = yield* Saga.selectState()
      if (newState.config.daemonHandshakeWaiters.get(getAccountsWaitKey)) {
        yield Saga.put(
          ConfigGen.createDaemonHandshakeWait({
            failedReason: "Can't get accounts",
            increment: false,
            name: getAccountsWaitKey,
            version: handshakeVersion,
          })
        )
      }
      return undefined
    }
  }
}

const showDeletedSelfRootPage = () => [
  RouteTreeGen.createSwitchLoggedIn({loggedIn: false}),
  RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]}),
]

const switchRouteDef = (
  state: Container.TypedState,
  action: ConfigGen.LoggedInPayload | ConfigGen.LoggedOutPayload
) => {
  if (state.config.loggedIn) {
    if (action.type === ConfigGen.loggedIn && !action.payload.causedByStartup) {
      // only do this if we're not handling the initial loggedIn event, cause its handled by routeToInitialScreenOnce
      return [
        RouteTreeGen.createSwitchLoggedIn({loggedIn: true}),
        ...(action.payload.causedBySignup
          ? [RouteTreeGen.createNavigateAppend({path: ['signupEnterPhoneNumber']})]
          : []),
      ]
    }
  } else {
    return RouteTreeGen.createSwitchLoggedIn({loggedIn: false})
  }
  return undefined
}

const resetGlobalStore = (): any => ({payload: {}, type: 'common:resetStore'})

// Figure out whether we can log out using CanLogout, if so,
// startLogoutHandshake, else do what's needed - right now only
// redirect to set password screen.
const startLogoutHandshakeIfAllowed = (state: Container.TypedState) =>
  RPCTypes.userCanLogoutRpcPromise().then(canLogoutRes => {
    if (canLogoutRes.canLogout) {
      return startLogoutHandshake(state)
    } else {
      const heading = canLogoutRes.reason
      if (isMobile) {
        return RouteTreeGen.createNavigateAppend({
          path: [Tabs.settingsTab, {props: {heading}, selected: SettingsConstants.passwordTab}],
        })
      } else {
        return [
          RouteTreeGen.createNavigateAppend({path: [Tabs.settingsTab]}),
          RouteTreeGen.createNavigateAppend({
            path: [{props: {heading}, selected: 'changePassword'}],
          }),
        ]
      }
    }
  })

const startLogoutHandshake = (state: Container.TypedState) =>
  ConfigGen.createLogoutHandshake({version: state.config.logoutHandshakeVersion + 1})

// This assumes there's at least a single waiter to trigger this, so if that ever changes you'll have to add
// stuff to trigger this due to a timeout if there's no listeners or something
function* maybeDoneWithLogoutHandshake(state: Container.TypedState) {
  if (state.config.logoutHandshakeWaiters.size <= 0) {
    yield RPCTypes.loginLogoutRpcPromise()
  }
}

let routeToInitialScreenOnce = false

const routeToInitialScreen2 = (state: Container.TypedState) => {
  // bail if we don't have a navigator and loaded
  if (!Router2._getNavigator()) {
    return
  }
  if (!state.config.startupDetailsLoaded) {
    return
  }

  return routeToInitialScreen(state)
}

// We figure out where to go (push, link, saved state, etc) once ever in a session
const routeToInitialScreen = (state: Container.TypedState) => {
  if (routeToInitialScreenOnce) {
    return
  }
  routeToInitialScreenOnce = true

  if (state.config.loggedIn) {
    // A chat
    if (
      state.config.startupConversation &&
      state.config.startupConversation !== ChatConstants.noConversationIDKey
    ) {
      const actions = [
        RouteTreeGen.createNavigateAppend({
          path: [
            {props: {conversationIDKey: state.config.startupConversation}, selected: 'chatConversation'},
          ],
        }),
      ]
      return [
        RouteTreeGen.createSwitchLoggedIn({loggedIn: true}),
        RouteTreeGen.createResetStack({actions, index: 1, tab: Tabs.chatTab}),
        ChatGen.createSelectConversation({
          conversationIDKey: state.config.startupConversation,
          reason: state.config.startupWasFromPush ? 'push' : 'savedLastState',
        }),
      ]
    }

    // A share
    if (state.config.startupSharePath) {
      return [
        RouteTreeGen.createSwitchLoggedIn({loggedIn: true}),
        RouteTreeGen.createNavigateAppend({path: FsConstants.fsRootRouteForNav1}),
        FsGen.createSetIncomingShareLocalPath({localPath: state.config.startupSharePath}),
        FsGen.createShowIncomingShare({initialDestinationParentPath: FsTypes.stringToPath('/keybase')}),
      ]
    }

    // A follow
    if (state.config.startupFollowUser) {
      return [
        RouteTreeGen.createSwitchLoggedIn({loggedIn: true}),
        RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab}),
        RouteTreeGen.createNavigateAppend({path: FsConstants.fsRootRouteForNav1}),
        ProfileGen.createShowUserProfile({username: state.config.startupFollowUser}),
      ]
    }

    // A deep link
    if (state.config.startupLink) {
      try {
        const url = new URL(state.config.startupLink)
        const username = Constants.urlToUsername(url)
        logger.info('AppLink: url', url.href, 'username', username)
        if (username === 'phone-app') {
          return [SettingsGen.createLoadSettings(), RouteTreeGen.createSwitchLoggedIn({loggedIn: true})]
        } else if (username && username !== 'app') {
          return [
            RouteTreeGen.createSwitchLoggedIn({loggedIn: true}),
            RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab}),
            ProfileGen.createShowUserProfile({username}),
          ]
        }
      } catch {
        logger.info('AppLink: could not parse link', state.config.startupLink)
      }
    }

    // Just a saved tab
    return [
      RouteTreeGen.createSwitchLoggedIn({loggedIn: true}),
      RouteTreeGen.createSwitchTab({tab: (state.config.startupTab as any) || Tabs.peopleTab}),
    ]
  } else {
    // Show a login screen
    return [RouteTreeGen.createSwitchLoggedIn({loggedIn: false})]
  }
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

const emitInitialLoggedIn = (state: Container.TypedState) =>
  state.config.loggedIn && ConfigGen.createLoggedIn({causedBySignup: false, causedByStartup: true})

function* allowLogoutWaiters(_: Container.TypedState, action: ConfigGen.LogoutHandshakePayload) {
  yield Saga.put(
    ConfigGen.createLogoutHandshakeWait({
      increment: true,
      name: 'nullhandshake',
      version: action.payload.version,
    })
  )
  yield Saga.delay(10)
  yield Saga.put(
    ConfigGen.createLogoutHandshakeWait({
      increment: false,
      name: 'nullhandshake',
      version: action.payload.version,
    })
  )
}

const updateServerConfig = (state: Container.TypedState) =>
  RPCTypes.apiserverGetWithSessionRpcPromise({
    endpoint: 'user/features',
  })
    .then(str => {
      const obj: {
        features: {
          admin?: {
            value: boolean
          }
        }
      } = JSON.parse(str.body)
      const features = Object.keys(obj.features).reduce((map, key) => {
        map[key] = obj.features[key] && obj.features[key].value
        return map
      }, {}) as {[K in string]: boolean}

      const serverConfig = {
        chatIndexProfilingEnabled: !!features.admin,
        dbCleanEnabled: !!features.admin,
        printRPCStats: !!features.admin,
      }

      logger.info('updateServerConfig', serverConfig)
      updateServerConfigLastLoggedIn(state.config.username, serverConfig)
    })
    .catch(e => {
      logger.info('updateServerConfig fail', e)
    })

const setNavigator = (_: Container.TypedState, action: ConfigGen.SetNavigatorPayload) => {
  const navigator = action.payload.navigator
  Router2._setNavigator(navigator)
}

const newNavigation = (
  _: Container.TypedState,
  action:
    | RouteTreeGen.NavigateAppendPayload
    | RouteTreeGen.NavigateUpPayload
    | RouteTreeGen.SwitchLoggedInPayload
    | RouteTreeGen.ClearModalsPayload
    | RouteTreeGen.NavUpToScreenPayload
    | RouteTreeGen.SwitchTabPayload
    | RouteTreeGen.ResetStackPayload
) => {
  const n = Router2._getNavigator()
  n && n.dispatchOldAction(action)
}

function* criticalOutOfDateCheck() {
  // check every hour
  while (true) {
    try {
      const s: Saga.RPCPromiseType<
        typeof RPCTypes.configGetUpdateInfo2RpcPromise
      > = yield RPCTypes.configGetUpdateInfo2RpcPromise({})
      let status: ConfigGen.UpdateCriticalCheckStatusPayload['payload']['status'] = 'ok'
      let message: string | null = null
      switch (s.status) {
        case RPCTypes.UpdateInfoStatus2.ok:
          break
        case RPCTypes.UpdateInfoStatus2.suggested:
          status = 'suggested'
          message = s.suggested && s.suggested.message
          break
        case RPCTypes.UpdateInfoStatus2.critical:
          status = 'critical'
          message = s.critical && s.critical.message
          break
        default:
          Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(s)
      }
      yield Saga.put(ConfigGen.createUpdateCriticalCheckStatus({message: message || '', status}))
    } catch (e) {
      logger.error("Can't call critical check", e)
    }
    yield Saga.delay(3600 * 1000) // 1 hr
  }
}

const loadDarkPrefs = async () => {
  try {
    const v = await RPCTypes.configGuiGetValueRpcPromise({path: 'ui.darkMode'})
    const preference = v.s || undefined

    switch (preference) {
      case undefined:
        return ConfigGen.createSetDarkModePreference({preference})
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

function* configSaga(): Saga.SagaGenerator<any, any> {
  // Start the handshake process. This means we tell all sagas we're handshaking with the daemon. If another
  // saga needs to do something before we leave the loading screen they should call daemonHandshakeWait
  yield* Saga.chainAction2([ConfigGen.restartHandshake, ConfigGen.startHandshake], startHandshake)
  // When there are no more waiters, we can show the actual app
  yield* Saga.chainAction2(ConfigGen.daemonHandshakeWait, maybeDoneWithDaemonHandshake)
  // darkmode
  yield* Saga.chainAction2(ConfigGen.daemonHandshake, loadDarkPrefs)
  // Re-get info about our account if you log in/we're done handshaking/became reachable
  yield* Saga.chainGenerator<
    ConfigGen.LoggedInPayload | ConfigGen.DaemonHandshakePayload | GregorGen.UpdateReachablePayload
  >([ConfigGen.loggedIn, ConfigGen.daemonHandshake, GregorGen.updateReachable], loadDaemonBootstrapStatus)
  // Load the known accounts if you revoke / handshake / logout
  yield* Saga.chainGenerator<
    | DevicesGen.RevokedPayload
    | ConfigGen.DaemonHandshakePayload
    | ConfigGen.LoggedOutPayload
    | ConfigGen.LoggedInPayload
  >(
    [DevicesGen.revoked, ConfigGen.daemonHandshake, ConfigGen.loggedOut, ConfigGen.loggedIn],
    loadDaemonAccounts
  )
  // Switch between login or app routes
  yield* Saga.chainAction2([ConfigGen.loggedIn, ConfigGen.loggedOut], switchRouteDef)
  // MUST go above routeToInitialScreen2 so we set the nav correctly
  yield* Saga.chainAction2(ConfigGen.setNavigator, setNavigator)
  // Go to the correct starting screen
  yield* Saga.chainAction2([ConfigGen.daemonHandshakeDone, ConfigGen.setNavigator], routeToInitialScreen2)

  yield* Saga.chainAction2(
    [
      RouteTreeGen.navigateAppend,
      RouteTreeGen.navigateUp,
      RouteTreeGen.switchLoggedIn,
      RouteTreeGen.clearModals,
      RouteTreeGen.navUpToScreen,
      RouteTreeGen.switchTab,
      RouteTreeGen.resetStack,
    ],
    newNavigation
  )
  // If you start logged in we don't get the incoming call from the daemon so we generate our own here
  yield* Saga.chainAction2(ConfigGen.daemonHandshakeDone, emitInitialLoggedIn)

  // Like handshake but in reverse, ask sagas to do stuff before we tell the server to log us out
  yield* Saga.chainAction2(ConfigGen.logout, startLogoutHandshakeIfAllowed)
  // Give time for all waiters to register and allow the case where there are no waiters
  yield* Saga.chainGenerator<ConfigGen.LogoutHandshakePayload>(ConfigGen.logoutHandshake, allowLogoutWaiters)
  yield* Saga.chainGenerator<ConfigGen.LogoutHandshakeWaitPayload>(
    ConfigGen.logoutHandshakeWait,
    maybeDoneWithLogoutHandshake
  )
  // When we're all done lets clean up
  yield* Saga.chainAction2(ConfigGen.loggedOut, resetGlobalStore)
  // Store per user server config info
  yield* Saga.chainAction2(ConfigGen.loggedIn, updateServerConfig)

  yield* Saga.chainAction2(ConfigGen.setDeletedSelf, showDeletedSelfRootPage)

  yield* Saga.chainAction2(EngineGen.keybase1NotifySessionLoggedIn, onLoggedIn)
  yield* Saga.chainAction2(EngineGen.keybase1NotifySessionLoggedOut, onLoggedOut)
  yield* Saga.chainAction2(EngineGen.keybase1LogUiLog, onLog)
  yield* Saga.chainAction2(EngineGen.connected, onConnected)
  yield* Saga.chainAction2(EngineGen.disconnected, onDisconnected)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyTrackingTrackingInfo, onTrackingInfo)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyServiceHTTPSrvInfoUpdate, onHTTPSrvInfoUpdated)

  yield* Saga.chainAction2(SettingsGen.loadedSettings, maybeLoadAppLink)

  yield* Saga.chainAction2(ConfigGen.setDarkModePreference, saveDarkPrefs)
  // Kick off platform specific stuff
  yield Saga.spawn(PlatformSpecific.platformConfigSaga)
  yield Saga.spawn(criticalOutOfDateCheck)
}

export default configSaga
