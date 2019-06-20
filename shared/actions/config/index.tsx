import logger from '../../logger'
import {log} from '../../native/log/logui'
import * as ConfigGen from '../config-gen'
import * as GregorGen from '../gregor-gen'
import * as Flow from '../../util/flow'
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
import avatarSaga from './avatar'
import {isMobile} from '../../constants/platform'
import {TypedState} from '../../constants/reducer'
import {updateServerConfigLastLoggedIn} from '../../app/server-config'

const onLoggedIn = (state, action: EngineGen.Keybase1NotifySessionLoggedInPayload) => {
  logger.info('keybase.1.NotifySession.loggedIn')
  // only send this if we think we're not logged in
  if (!state.config.loggedIn) {
    return ConfigGen.createLoggedIn({causedBySignup: action.payload.params.signedUp, causedByStartup: false})
  }
}

const onLoggedOut = (state, action: EngineGen.Keybase1NotifySessionLoggedOutPayload) => {
  logger.info('keybase.1.NotifySession.loggedOut')
  // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
  if (state.config.loggedIn) {
    return ConfigGen.createLoggedOut()
  }
}

const onLog = (_, action: EngineGen.Keybase1LogUiLogPayload) => {
  log(action.payload.params)
}

const onConnected = () => ConfigGen.createStartHandshake()
const onDisconnected = () => {
  logger.flush()
  return ConfigGen.createDaemonError({daemonError: new Error('Disconnected')})
}

// set to true so we reget status when we're reachable again
let wasUnreachable = false
function* loadDaemonBootstrapStatus(
  state,
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
    const s = yield* Saga.callPromise(RPCTypes.configGetBootstrapStatusRpcPromise)
    const loadedAction = ConfigGen.createBootstrapStatusLoaded({
      deviceID: s.deviceID,
      deviceName: s.deviceName,
      followers: s.followers || [],
      following: s.following || [],
      fullname: s.fullname || '',
      loggedIn: s.loggedIn,
      registered: s.registered,
      uid: s.uid,
      username: s.username,
    })
    logger.info(`[Bootstrap] loggedIn: ${loadedAction.payload.loggedIn ? 1 : 0}`)
    yield Saga.put(loadedAction)

    // if we're logged in act like getAccounts is done already
    if (action.type === ConfigGen.daemonHandshake && loadedAction.payload.loggedIn) {
      const newState = yield* Saga.selectState()
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
const startHandshake = state => {
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
const maybeDoneWithDaemonHandshake = (state, action: ConfigGen.DaemonHandshakeWaitPayload) => {
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
}

// Load accounts, this call can be slow so we attempt to continue w/o waiting if we determine we're logged in
// normally this wouldn't be worth it but this is startup
const getAccountsWaitKey = 'config.getAccounts'

function* loadDaemonAccounts(
  state,
  action: DevicesGen.RevokedPayload | ConfigGen.DaemonHandshakePayload | ConfigGen.LoggedOutPayload
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

    const result = yield* Saga.callPromise(RPCTypes.configGetAllProvisionedUsernamesRpcPromise)
    let usernames = result.provisionedUsernames || []
    let defaultUsername = result.defaultUsername
    usernames = usernames.sort()
    const loadedAction = ConfigGen.createSetAccounts({defaultUsername, usernames})
    yield Saga.put(loadedAction)
    if (handshakeWait) {
      // someone dismissed this already?
      const newState = yield* Saga.selectState()
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
      const newState = yield* Saga.selectState()
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
    }
  }
}

const showDeletedSelfRootPage = () => [
  RouteTreeGen.createSwitchRouteDef({loggedIn: false}),
  RouteTreeGen.createNavigateTo({path: [Tabs.loginTab]}),
]

const switchRouteDef = (state, action: ConfigGen.LoggedInPayload | ConfigGen.LoggedOutPayload) => {
  if (state.config.loggedIn) {
    if (action.type === ConfigGen.loggedIn && !action.payload.causedByStartup) {
      // only do this if we're not handling the initial loggedIn event, cause its handled by routeToInitialScreenOnce
      return [
        RouteTreeGen.createSwitchRouteDef({loggedIn: true}),
        ...(action.payload.causedBySignup
          ? [RouteTreeGen.createNavigateAppend({path: ['signupEnterPhoneNumber']})]
          : []),
      ]
    }
  } else {
    return RouteTreeGen.createSwitchRouteDef({loggedIn: false})
  }
}

const resetGlobalStore = (): any => ({payload: null, type: 'common:resetStore'})

// Figure out whether we can log out using CanLogout, if so,
// startLogoutHandshake, else do what's needed - right now only
// redirect to set password screen.
const startLogoutHandshakeIfAllowed = state =>
  RPCTypes.userCanLogoutRpcPromise().then(canLogoutRes => {
    if (canLogoutRes.canLogout) {
      return startLogoutHandshake(state)
    } else {
      const heading = canLogoutRes.reason
      if (isMobile) {
        return RouteTreeGen.createNavigateTo({
          path: [Tabs.settingsTab, {props: {heading}, selected: SettingsConstants.passwordTab}],
        })
      } else {
        return [
          RouteTreeGen.createNavigateTo({path: [Tabs.settingsTab]}),
          RouteTreeGen.createNavigateAppend({
            path: [{props: {heading}, selected: 'changePassword'}],
          }),
        ]
      }
    }
  })

const startLogoutHandshake = state =>
  ConfigGen.createLogoutHandshake({version: state.config.logoutHandshakeVersion + 1})

// This assumes there's at least a single waiter to trigger this, so if that ever changes you'll have to add
// stuff to trigger this due to a timeout if there's no listeners or something
function* maybeDoneWithLogoutHandshake(state) {
  if (state.config.logoutHandshakeWaiters.size <= 0) {
    yield* Saga.callPromise(RPCTypes.loginLogoutRpcPromise)
  }
}

let routeToInitialScreenOnce = false

const routeToInitialScreen2 = state => {
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
const routeToInitialScreen = state => {
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
        RouteTreeGen.createSwitchRouteDef({loggedIn: true, path: [Tabs.chatTab]}),
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
        RouteTreeGen.createSwitchRouteDef({loggedIn: true, path: FsConstants.fsRootRouteForNav1}),
        FsGen.createSetIncomingShareLocalPath({localPath: state.config.startupSharePath}),
        FsGen.createShowIncomingShare({initialDestinationParentPath: FsTypes.stringToPath('/keybase')}),
      ]
    }

    // A follow
    if (state.config.startupFollowUser) {
      return [
        RouteTreeGen.createSwitchRouteDef({loggedIn: true, path: [Tabs.peopleTab]}),
        ProfileGen.createShowUserProfile({username: state.config.startupFollowUser}),
      ]
    }

    // A deep link
    if (state.config.startupLink) {
      try {
        const url = new URL(state.config.startupLink)
        const username = Constants.urlToUsername(url)
        logger.info('AppLink: url', url.href, 'username', username)
        if (username) {
          return [
            RouteTreeGen.createSwitchRouteDef({loggedIn: true, path: [Tabs.peopleTab]}),
            ProfileGen.createShowUserProfile({username}),
          ]
        }
      } catch {
        logger.info('AppLink: could not parse link', state.config.startupLink)
      }
    }

    // Just a saved tab
    return RouteTreeGen.createSwitchRouteDef({
      loggedIn: true,
      path: [state.config.startupTab || Tabs.peopleTab],
    })
  } else {
    // Show a login screen
    return [
      RouteTreeGen.createSwitchRouteDef({loggedIn: false}),
      RouteTreeGen.createNavigateTo({parentPath: [Tabs.loginTab], path: []}),
    ]
  }
}

const handleAppLink = (_, action: ConfigGen.LinkPayload) => {
  const url = new URL(action.payload.link)
  if (action.payload.link.startsWith('web+stellar:')) {
    console.warn('Got SEP7 link:', action.payload.link)
  } else {
    const username = Constants.urlToUsername(url)
    if (username) {
      return [
        RouteTreeGen.createSwitchTo({path: [Tabs.peopleTab]}),
        ProfileGen.createShowUserProfile({username}),
      ]
    }
  }
}

const emitInitialLoggedIn = state =>
  state.config.loggedIn && ConfigGen.createLoggedIn({causedBySignup: false, causedByStartup: true})

function* allowLogoutWaiters(_, action: ConfigGen.LogoutHandshakePayload) {
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

const updateServerConfig = (state: TypedState) =>
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

const setNavigator = (state, action: ConfigGen.SetNavigatorPayload) => {
  const navigator = action.payload.navigator
  Router2._setNavigator(navigator)
}

const newNavigation = (
  _,
  action:
    | RouteTreeGen.NavigateAppendPayload
    | RouteTreeGen.NavigateToPayload
    | RouteTreeGen.NavigateUpPayload
    | RouteTreeGen.SwitchToPayload
    | RouteTreeGen.SwitchRouteDefPayload
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
      const s: Unpacked<ReturnType<typeof RPCTypes.configGetUpdateInfo2RpcPromise>> = yield* Saga.callPromise(
        RPCTypes.configGetUpdateInfo2RpcPromise,
        {}
      )
      let status: ConfigGen.UpdateCriticalCheckStatusPayload['payload']['status'] = 'ok'
      let message = ''
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

function* configSaga(): Saga.SagaGenerator<any, any> {
  // Start the handshake process. This means we tell all sagas we're handshaking with the daemon. If another
  // saga needs to do something before we leave the loading screen they should call daemonHandshakeWait
  yield* Saga.chainAction<ConfigGen.RestartHandshakePayload | ConfigGen.StartHandshakePayload>(
    [ConfigGen.restartHandshake, ConfigGen.startHandshake],
    startHandshake
  )
  // When there are no more waiters, we can show the actual app
  yield* Saga.chainAction<ConfigGen.DaemonHandshakeWaitPayload>(
    ConfigGen.daemonHandshakeWait,
    maybeDoneWithDaemonHandshake
  )
  // Re-get info about our account if you log in/we're done handshaking/became reachable
  yield* Saga.chainGenerator<
    ConfigGen.LoggedInPayload | ConfigGen.DaemonHandshakePayload | GregorGen.UpdateReachablePayload
  >([ConfigGen.loggedIn, ConfigGen.daemonHandshake, GregorGen.updateReachable], loadDaemonBootstrapStatus)
  // Load the known accounts if you revoke / handshake / logout
  yield* Saga.chainGenerator<
    DevicesGen.RevokedPayload | ConfigGen.DaemonHandshakePayload | ConfigGen.LoggedOutPayload
  >([DevicesGen.revoked, ConfigGen.daemonHandshake, ConfigGen.loggedOut], loadDaemonAccounts)
  // Switch between login or app routes
  yield* Saga.chainAction<ConfigGen.LoggedInPayload | ConfigGen.LoggedOutPayload>(
    [ConfigGen.loggedIn, ConfigGen.loggedOut],
    switchRouteDef
  )
  // MUST go above routeToInitialScreen2 so we set the nav correctly
  yield* Saga.chainAction<ConfigGen.SetNavigatorPayload>(ConfigGen.setNavigator, setNavigator)
  // Go to the correct starting screen
  yield* Saga.chainAction<ConfigGen.DaemonHandshakeDonePayload | ConfigGen.SetNavigatorPayload>(
    [ConfigGen.daemonHandshakeDone, ConfigGen.setNavigator],
    routeToInitialScreen2
  )

  yield* Saga.chainAction<
    | RouteTreeGen.NavigateAppendPayload
    | RouteTreeGen.NavigateToPayload
    | RouteTreeGen.NavigateUpPayload
    | RouteTreeGen.SwitchToPayload
    | RouteTreeGen.SwitchRouteDefPayload
    | RouteTreeGen.ClearModalsPayload
    | RouteTreeGen.NavUpToScreenPayload
    | RouteTreeGen.SwitchTabPayload
    | RouteTreeGen.ResetStackPayload
  >(
    [
      RouteTreeGen.navigateAppend,
      RouteTreeGen.navigateTo,
      RouteTreeGen.navigateUp,
      RouteTreeGen.switchTo,
      RouteTreeGen.switchRouteDef,
      RouteTreeGen.clearModals,
      RouteTreeGen.navUpToScreen,
      RouteTreeGen.switchTab,
      RouteTreeGen.resetStack,
    ],
    newNavigation
  )
  // If you start logged in we don't get the incoming call from the daemon so we generate our own here
  yield* Saga.chainAction<ConfigGen.DaemonHandshakeDonePayload>(
    ConfigGen.daemonHandshakeDone,
    emitInitialLoggedIn
  )

  // Like handshake but in reverse, ask sagas to do stuff before we tell the server to log us out
  yield* Saga.chainAction<ConfigGen.LogoutPayload>(ConfigGen.logout, startLogoutHandshakeIfAllowed)
  // Give time for all waiters to register and allow the case where there are no waiters
  yield* Saga.chainGenerator<ConfigGen.LogoutHandshakePayload>(ConfigGen.logoutHandshake, allowLogoutWaiters)
  yield* Saga.chainGenerator<ConfigGen.LogoutHandshakeWaitPayload>(
    ConfigGen.logoutHandshakeWait,
    maybeDoneWithLogoutHandshake
  )
  // When we're all done lets clean up
  yield* Saga.chainAction<ConfigGen.LoggedOutPayload>(ConfigGen.loggedOut, resetGlobalStore)
  // Store per user server config info
  yield* Saga.chainAction<ConfigGen.LoggedInPayload>(ConfigGen.loggedIn, updateServerConfig)

  yield* Saga.chainAction<ConfigGen.SetDeletedSelfPayload>(ConfigGen.setDeletedSelf, showDeletedSelfRootPage)

  yield* Saga.chainAction<EngineGen.Keybase1NotifySessionLoggedInPayload>(
    EngineGen.keybase1NotifySessionLoggedIn,
    onLoggedIn
  )
  yield* Saga.chainAction<EngineGen.Keybase1NotifySessionLoggedOutPayload>(
    EngineGen.keybase1NotifySessionLoggedOut,
    onLoggedOut
  )
  yield* Saga.chainAction<EngineGen.Keybase1LogUiLogPayload>(EngineGen.keybase1LogUiLog, onLog)
  yield* Saga.chainAction<EngineGen.ConnectedPayload>(EngineGen.connected, onConnected)
  yield* Saga.chainAction<EngineGen.DisconnectedPayload>(EngineGen.disconnected, onDisconnected)
  yield* Saga.chainAction<ConfigGen.LinkPayload>(ConfigGen.link, handleAppLink)

  // Kick off platform specific stuff
  yield Saga.spawn(PlatformSpecific.platformConfigSaga)
  yield Saga.spawn(avatarSaga)
  yield Saga.spawn(criticalOutOfDateCheck)
}

export default configSaga
