// @flow
import logger from '../../logger'
import {log} from '../../native/log/logui'
import * as ConfigGen from '../config-gen'
import * as Flow from '../../util/flow'
import * as ChatGen from '../chat2-gen'
import * as DevicesGen from '../devices-gen'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/config'
import * as ChatConstants from '../../constants/chat2'
import * as Saga from '../../util/saga'
import * as PlatformSpecific from '../platform-specific'
import * as RouteTreeGen from '../route-tree-gen'
import * as Tabs from '../../constants/tabs'
import URL from 'url-parse'
import appRouteTree from '../../app/routes-app'
import loginRouteTree from '../../app/routes-login'
import avatarSaga from './avatar'
import {getEngine} from '../../engine'
import {type TypedState} from '../../constants/reducer'
import {updateServerConfigLastLoggedIn} from '../../app/server-config'

const setupEngineListeners = () => {
  getEngine().actionOnDisconnect('daemonError', () => {
    logger.flush()
    return ConfigGen.createDaemonError({daemonError: new Error('Disconnected')})
  })
  getEngine().actionOnConnect('handshake', () => ConfigGen.createStartHandshake())

  getEngine().setIncomingCallMap({
    'keybase.1.NotifySession.loggedIn': ({username}) =>
      Saga.callUntyped(function*() {
        logger.info('keybase.1.NotifySession.loggedIn')
        const state = yield* Saga.selectState()
        // only send this if we think we're not logged in
        if (!state.config.loggedIn) {
          yield Saga.put(ConfigGen.createLoggedIn({causedByStartup: false}))
        }
      }),
    'keybase.1.NotifySession.loggedOut': () =>
      Saga.callUntyped(function*() {
        logger.info('keybase.1.NotifySession.loggedOut')
        const state = yield* Saga.selectState()
        // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
        if (state.config.loggedIn) {
          yield Saga.put(ConfigGen.createLoggedOut())
        }
      }),
    'keybase.1.NotifyTracking.trackingChanged': ({isTracking, username}) =>
      Saga.put(ConfigGen.createUpdateFollowing({isTracking, username})),
    'keybase.1.logUi.log': param => {
      log(param)
    },
  })
}

function* loadDaemonBootstrapStatus(state, action) {
  // Ignore the 'fake' loggedIn cause we'll get the daemonHandshake and we don't want to do this twice
  if (action.type === ConfigGen.loggedIn && action.payload.causedByStartup) {
    return
  }

  function* makeCall() {
    const s = yield* Saga.callPromise(RPCTypes.configGetBootstrapStatusRpcPromise)
    const loadedAction = ConfigGen.createBootstrapStatusLoaded({
      deviceID: s.deviceID,
      deviceName: s.deviceName,
      followers: s.followers ?? [],
      following: s.following ?? [],
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
    case ConfigGen.loggedIn: // fallthrough
    case ConfigGen.loggedOut:
      yield* makeCall()
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
  }
}

let dispatchSetupEngineListenersOnce = false
const dispatchSetupEngineListeners = () => {
  if (dispatchSetupEngineListenersOnce) {
    return
  }
  dispatchSetupEngineListenersOnce = true
  return ConfigGen.createSetupEngineListeners()
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
const maybeDoneWithDaemonHandshake = (state, action) => {
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

function* loadDaemonAccounts(state, action) {
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
  RouteTreeGen.createSwitchRouteDef({routeDef: loginRouteTree}),
  RouteTreeGen.createNavigateTo({path: [Tabs.loginTab]}),
]

const switchRouteDef = (state, action) => {
  if (state.config.loggedIn) {
    if (action.type === ConfigGen.loggedIn && !action.payload.causedByStartup) {
      // only do this if we're not handling the initial loggedIn event, cause its handled by routeToInitialScreenOnce
      return RouteTreeGen.createSwitchRouteDef({routeDef: appRouteTree})
    }
  } else {
    return RouteTreeGen.createSwitchRouteDef({routeDef: loginRouteTree})
  }
}

const resetGlobalStore = () => ({payload: null, type: 'common:resetStore'})

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
      return [
        // $FlowIssue
        RouteTreeGen.createSwitchRouteDef({path: ChatConstants.threadRoute, routeDef: appRouteTree}),
        ChatGen.createSelectConversation({
          conversationIDKey: state.config.startupConversation,
          reason: state.config.startupWasFromPush ? 'push' : 'savedLastState',
        }),
      ]
    }

    // A follow
    if (state.config.startupFollowUser) {
      return [
        RouteTreeGen.createSwitchRouteDef({path: [Tabs.profileTab], routeDef: appRouteTree}),
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
            RouteTreeGen.createSwitchRouteDef({path: [Tabs.profileTab], routeDef: appRouteTree}),
            ProfileGen.createShowUserProfile({username}),
          ]
        }
      } catch {
        logger.info('AppLink: could not parse link', state.config.startupLink)
      }
    }

    // Just a saved tab
    return RouteTreeGen.createSwitchRouteDef({
      path: [state.config.startupTab || Tabs.peopleTab],
      routeDef: appRouteTree,
    })
  } else {
    // Show a login screen
    return [
      RouteTreeGen.createSwitchRouteDef({routeDef: loginRouteTree}),
      RouteTreeGen.createNavigateTo({parentPath: [Tabs.loginTab], path: []}),
    ]
  }
}

const handleAppLink = (_, action) => {
  const url = new URL(action.payload.link)
  const username = Constants.urlToUsername(url)
  if (username) {
    return [
      RouteTreeGen.createSwitchTo({path: [Tabs.profileTab]}),
      ProfileGen.createShowUserProfile({username}),
    ]
  }
}

const emitInitialLoggedIn = state =>
  state.config.loggedIn && ConfigGen.createLoggedIn({causedByStartup: true})

function* allowLogoutWaiters(_, action) {
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
          admin?: {value: boolean},
        },
      } = JSON.parse(str.body)
      const features = Object.keys(obj.features).reduce((map, key) => {
        map[key] = obj.features[key]?.value
        return map
      }, {})

      const serverConfig = {
        chatIndexProfilingEnabled: !!features.admin,
        printRPCStats: !!features.admin,
      }

      logger.info('updateServerConfig', serverConfig)
      updateServerConfigLastLoggedIn(state.config.username, serverConfig)
    })
    .catch(e => {
      logger.info('updateServerConfig fail', e)
    })

function* configSaga(): Saga.SagaGenerator<any, any> {
  // Tell all other sagas to register for incoming engine calls
  yield* Saga.chainAction<ConfigGen.InstallerRanPayload>(ConfigGen.installerRan, dispatchSetupEngineListeners)
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
  // Re-get info about our account if you log in/out/we're done handshaking
  yield* Saga.chainGenerator<
    ConfigGen.LoggedInPayload | ConfigGen.LoggedOutPayload | ConfigGen.DaemonHandshakePayload
  >([ConfigGen.loggedIn, ConfigGen.loggedOut, ConfigGen.daemonHandshake], loadDaemonBootstrapStatus)
  // Load the known accounts if you revoke / handshake / logout
  yield* Saga.chainGenerator<
    DevicesGen.RevokedPayload | ConfigGen.DaemonHandshakePayload | ConfigGen.LoggedOutPayload
  >([DevicesGen.revoked, ConfigGen.daemonHandshake, ConfigGen.loggedOut], loadDaemonAccounts)
  // Switch between login or app routes
  yield* Saga.chainAction<ConfigGen.LoggedInPayload | ConfigGen.LoggedOutPayload>(
    [ConfigGen.loggedIn, ConfigGen.loggedOut],
    switchRouteDef
  )
  // Go to the correct starting screen
  yield* Saga.chainAction<ConfigGen.DaemonHandshakeDonePayload>(
    ConfigGen.daemonHandshakeDone,
    routeToInitialScreen
  )
  // If you start logged in we don't get the incoming call from the daemon so we generate our own here
  yield* Saga.chainAction<ConfigGen.DaemonHandshakeDonePayload>(
    ConfigGen.daemonHandshakeDone,
    emitInitialLoggedIn
  )

  // Like handshake but in reverse, ask sagas to do stuff before we tell the server to log us out
  yield* Saga.chainAction<ConfigGen.LogoutPayload>(ConfigGen.logout, startLogoutHandshake)
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

  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )

  yield* Saga.chainAction<ConfigGen.LinkPayload>(ConfigGen.link, handleAppLink)

  // Kick off platform specific stuff
  yield Saga.spawn(PlatformSpecific.platformConfigSaga)
  yield Saga.spawn(avatarSaga)
}

export default configSaga
