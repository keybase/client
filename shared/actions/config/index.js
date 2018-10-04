// @flow
import logger from '../../logger'
import {log} from '../../native/log/logui'
import * as ConfigGen from '../config-gen'
import * as ChatGen from '../chat2-gen'
import * as DevicesGen from '../devices-gen'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as ProfileConstants from '../../constants/profile'
import * as ChatConstants from '../../constants/chat2'
import * as Saga from '../../util/saga'
import * as PlatformSpecific from '../platform-specific'
import * as RouteTree from '../route-tree'
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
    'keybase.1.logUi.log': param => {
      log(param)
    },
    'keybase.1.NotifyTracking.trackingChanged': ({isTracking, username}) =>
      Saga.put(ConfigGen.createUpdateFollowing({isTracking, username})),
    'keybase.1.NotifySession.loggedOut': () =>
      Saga.call(function*() {
        const state: TypedState = yield Saga.select()
        // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
        if (state.config.loggedIn) {
          yield Saga.put(ConfigGen.createLoggedOut())
        }
      }),
    'keybase.1.NotifySession.loggedIn': ({username}) =>
      Saga.call(function*() {
        const state: TypedState = yield Saga.select()
        // only send this if we think we're not logged in
        if (!state.config.loggedIn) {
          yield Saga.put(ConfigGen.createLoggedIn({causedByStartup: false}))
        }
      }),
  })
}

const loadDaemonBootstrapStatus = (
  state: TypedState,
  action: ConfigGen.DaemonHandshakePayload | ConfigGen.LoggedInPayload | ConfigGen.LoggedOutPayload
) => {
  // Ignore the 'fake' loggedIn cause we'll get the daemonHandshake and we don't want to do this twice
  if (action.type === ConfigGen.loggedIn && action.payload.causedByStartup) {
    return
  }

  const makeCall = Saga.call(function*() {
    const loadedAction = yield RPCTypes.configGetBootstrapStatusRpcPromise().then(
      (s: RPCTypes.BootstrapStatus) =>
        ConfigGen.createBootstrapStatusLoaded({
          deviceID: s.deviceID,
          deviceName: s.deviceName,
          followers: s.followers ?? [],
          following: s.following ?? [],
          loggedIn: s.loggedIn,
          registered: s.registered,
          uid: s.uid,
          username: s.username,
        })
    )
    yield Saga.put(loadedAction)

    // if we're logged in act like getAccounts is done already
    if (action.type === ConfigGen.daemonHandshake && loadedAction.payload.loggedIn) {
      const newState = yield Saga.select()
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
  })

  switch (action.type) {
    case ConfigGen.daemonHandshake:
      return Saga.sequentially([
        Saga.put(
          ConfigGen.createDaemonHandshakeWait({
            increment: true,
            name: 'config.getBootstrapStatus',
            version: action.payload.version,
          })
        ),
        makeCall,
        Saga.put(
          ConfigGen.createDaemonHandshakeWait({
            increment: false,
            name: 'config.getBootstrapStatus',
            version: action.payload.version,
          })
        ),
      ])
    case ConfigGen.loggedIn: // fallthrough
    case ConfigGen.loggedOut:
      return makeCall
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(action);
      */
      return undefined
  }
}

let dispatchSetupEngineListenersOnce = false
const dispatchSetupEngineListeners = () => {
  if (dispatchSetupEngineListenersOnce) {
    return
  }
  dispatchSetupEngineListenersOnce = true
  return Saga.put(ConfigGen.createSetupEngineListeners())
}

let _firstTimeConnecting = true
const startHandshake = (state: TypedState) => {
  const firstTimeConnecting = _firstTimeConnecting
  _firstTimeConnecting = false
  if (firstTimeConnecting) {
    logger.info('First bootstrap started')
  }
  return Saga.put(
    ConfigGen.createDaemonHandshake({firstTimeConnecting, version: state.config.daemonHandshakeVersion + 1})
  )
}

let _firstTimeBootstrapDone = true
const maybeDoneWithDaemonHandshake = (state: TypedState, action: ConfigGen.DaemonHandshakeWaitPayload) => {
  if (action.payload.version !== state.config.daemonHandshakeVersion) {
    // ignore out of date actions
    return
  }
  if (state.config.daemonHandshakeWaiters.size > 0) {
    // still waiting for things to finish
  } else {
    if (state.config.daemonHandshakeFailedReason) {
      if (state.config.daemonHandshakeRetriesLeft) {
        return Saga.put(ConfigGen.createRestartHandshake())
      }
    } else {
      if (_firstTimeBootstrapDone) {
        _firstTimeBootstrapDone = false
        logger.info('First bootstrap ended')
      }
      return Saga.put(ConfigGen.createDaemonHandshakeDone())
    }
  }
}

// Load accounts, this call can be slow so we attempt to continue w/o waiting if we determine we're logged in
// normally this wouldn't be worth it but this is startup
const getAccountsWaitKey = 'config.getAccounts'

const loadDaemonAccounts = (
  state: TypedState,
  action: DevicesGen.RevokedPayload | ConfigGen.DaemonHandshakePayload
) => {
  let handshakeWait = false
  let handshakeVersion = 0

  if (action.type === ConfigGen.daemonHandshake) {
    handshakeVersion = action.payload.version
    // did we beat getBootstrapStatus?
    if (!state.config.loggedIn) {
      handshakeWait = true
    }
  }

  return Saga.call(function*() {
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
      const loadedAction = yield RPCTypes.configGetAllProvisionedUsernamesRpcPromise().then(result => {
        let usernames = result.provisionedUsernames || []
        let defaultUsername = result.defaultUsername
        usernames = usernames.sort()
        return ConfigGen.createSetAccounts({defaultUsername, usernames})
      })
      yield Saga.put(loadedAction)
      if (handshakeWait) {
        // someone dismissed this already?
        const newState: TypedState = yield Saga.select()
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
        const newState: TypedState = yield Saga.select()
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
  })
}

const showDeletedSelfRootPage = () =>
  Saga.sequentially([
    Saga.put(RouteTree.switchRouteDef(loginRouteTree)),
    Saga.put(RouteTree.navigateTo([Tabs.loginTab])),
  ])

const switchRouteDef = (
  state: TypedState,
  action: ConfigGen.LoggedInPayload | ConfigGen.LoggedOutPayload
) => {
  if (state.config.loggedIn) {
    if (action.type === ConfigGen.loggedIn && !action.payload.causedByStartup) {
      // only do this if we're not handling the initial loggedIn event, cause its handled by routeToInitialScreenOnce
      return Saga.put(RouteTree.switchRouteDef(appRouteTree))
    }
  } else {
    return Saga.put(RouteTree.switchRouteDef(loginRouteTree))
  }
}

const resetGlobalStore = () => Saga.put({payload: undefined, type: ConfigGen.resetStore})

const startLogoutHandshake = (state: TypedState) =>
  Saga.put(ConfigGen.createLogoutHandshake({version: state.config.logoutHandshakeVersion + 1}))

// This assumes there's at least a single waiter to trigger this, so if that ever changes you'll have to add
// stuff to trigger this due to a timeout if there's no listeners or something
const maybeDoneWithLogoutHandshake = (state: TypedState) =>
  state.config.logoutHandshakeWaiters.size <= 0 && Saga.call(RPCTypes.loginLogoutRpcPromise)

let routeToInitialScreenOnce = false
// We figure out where to go (push, link, saved state, etc) once ever in a session
const routeToInitialScreen = (state: TypedState) => {
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
      return Saga.sequentially([
        // $FlowIssue
        Saga.put(RouteTree.switchRouteDef(appRouteTree, ChatConstants.threadRoute)),
        Saga.put(
          ChatGen.createSelectConversation({
            conversationIDKey: state.config.startupConversation,
            reason: state.config.startupWasFromPush ? 'push' : 'savedLastState',
          })
        ),
      ])
    }

    // A follow
    if (state.config.startupFollowUser) {
      return Saga.sequentially([
        Saga.put(RouteTree.switchRouteDef(appRouteTree, [Tabs.profileTab])),
        Saga.put(ProfileGen.createShowUserProfile({username: state.config.startupFollowUser})),
      ])
    }

    // A deep link
    if (state.config.startupLink) {
      try {
        const url = new URL(state.config.startupLink)
        const username = ProfileConstants.urlToUsername(url)
        logger.info('AppLink: url', url.href, 'username', username)
        if (username) {
          return Saga.sequentially([
            Saga.put(RouteTree.switchRouteDef(appRouteTree, [Tabs.profileTab])),
            Saga.put(ProfileGen.createShowUserProfile({username})),
          ])
        }
      } catch {
        logger.info('AppLink: could not parse link', state.config.startupLink)
      }
    }

    // Just a saved tab
    return Saga.put(RouteTree.switchRouteDef(appRouteTree, [state.config.startupTab || Tabs.peopleTab]))
  } else {
    // Show a login screen
    return Saga.sequentially([
      Saga.put(RouteTree.switchRouteDef(loginRouteTree)),
      Saga.put(RouteTree.navigateTo([], [Tabs.loginTab])),
    ])
  }
}

const handleAppLink = (_: any, action: ConfigGen.LinkPayload) => {
  const url = new URL(action.payload.link)
  const username = ProfileConstants.urlToUsername(url)
  if (username) {
    return Saga.sequentially([
      Saga.put(RouteTree.switchTo([Tabs.profileTab])),
      Saga.put(ProfileGen.createShowUserProfile({username})),
    ])
  }
}

const emitInitialLoggedIn = (state: TypedState) =>
  state.config.loggedIn && Saga.put(ConfigGen.createLoggedIn({causedByStartup: true}))

const allowLogoutWaiters = (_, action: ConfigGen.LogoutHandshakePayload) =>
  Saga.sequentially([
    Saga.put(
      ConfigGen.createLogoutHandshakeWait({
        increment: true,
        name: 'nullhandshake',
        version: action.payload.version,
      })
    ),
    Saga.call(Saga.delay, 10),
    Saga.put(
      ConfigGen.createLogoutHandshakeWait({
        increment: false,
        name: 'nullhandshake',
        version: action.payload.version,
      })
    ),
  ])

const updateServerConfig = (state: TypedState) =>
  Saga.call(function*() {
    try {
      const str = yield Saga.call(RPCTypes.apiserverGetWithSessionRpcPromise, {
        endpoint: 'user/features',
      })

      const obj = JSON.parse(str.body)
      const features = Object.keys(obj.features).reduce((map, key) => {
        map[key] = obj.features[key].value
        return map
      }, {})

      const serverConfig = {
        printRPCStats: !!features.admin,
        walletsEnabled: !!features.stellar,
      }

      logger.info('updateServerConfig', serverConfig)
      updateServerConfigLastLoggedIn(state.config.username, serverConfig)
    } catch (e) {
      logger.info('updateServerConfig fail', e)
    }
  })

function* configSaga(): Saga.SagaGenerator<any, any> {
  // Tell all other sagas to register for incoming engine calls
  yield Saga.actionToAction(ConfigGen.installerRan, dispatchSetupEngineListeners)
  // Start the handshake process. This means we tell all sagas we're handshaking with the daemon. If another
  // saga needs to do something before we leave the loading screen they should call daemonHandshakeWait
  yield Saga.actionToAction([ConfigGen.restartHandshake, ConfigGen.startHandshake], startHandshake)
  // When there are no more waiters, we can show the actual app
  yield Saga.actionToAction(ConfigGen.daemonHandshakeWait, maybeDoneWithDaemonHandshake)
  // Re-get info about our account if you log in/out/we're done handshaking
  yield Saga.actionToAction(
    [ConfigGen.loggedIn, ConfigGen.loggedOut, ConfigGen.daemonHandshake],
    loadDaemonBootstrapStatus
  )
  // Load the known accounts if you revoke / handshake / logout
  yield Saga.actionToAction(
    [DevicesGen.revoked, ConfigGen.daemonHandshake, ConfigGen.loggedOut],
    loadDaemonAccounts
  )
  // Switch between login or app routes
  yield Saga.actionToAction([ConfigGen.loggedIn, ConfigGen.loggedOut], switchRouteDef)
  // Go to the correct starting screen
  yield Saga.actionToAction(ConfigGen.daemonHandshakeDone, routeToInitialScreen)
  // If you start logged in we don't get the incoming call from the daemon so we generate our own here
  yield Saga.actionToAction(ConfigGen.daemonHandshakeDone, emitInitialLoggedIn)

  // Like handshake but in reverse, ask sagas to do stuff before we tell the server to log us out
  yield Saga.actionToAction(ConfigGen.logout, startLogoutHandshake)
  // Give time for all waiters to register and allow the case where there are no waiters
  yield Saga.actionToAction(ConfigGen.logoutHandshake, allowLogoutWaiters)
  yield Saga.actionToAction(ConfigGen.logoutHandshakeWait, maybeDoneWithLogoutHandshake)
  // When we're all done lets clean up
  yield Saga.actionToAction(ConfigGen.loggedOut, resetGlobalStore)
  // Store per user server config info
  yield Saga.actionToAction(ConfigGen.loggedIn, updateServerConfig)

  yield Saga.actionToAction(ConfigGen.setDeletedSelf, showDeletedSelfRootPage)

  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)

  yield Saga.actionToAction(ConfigGen.link, handleAppLink)

  // Kick off platform specific stuff
  yield Saga.fork(PlatformSpecific.platformConfigSaga)
  yield Saga.fork(avatarSaga)
}

export default configSaga
