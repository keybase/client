// @flow
import logger from '../../logger'
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

const setupEngineListeners = () => {
  getEngine().setIncomingActionCreators(
    'keybase.1.NotifyTracking.trackingChanged',
    ({isTracking, username}) => [ConfigGen.createUpdateFollowing({isTracking, username})]
  )

  getEngine().actionOnDisconnect('daemonError', () => {
    logger.flush()
    return ConfigGen.createDaemonError({daemonError: new Error('Disconnected')})
  })
  getEngine().actionOnConnect('handshake', () => ConfigGen.createStartHandshake())

  getEngine().setIncomingActionCreators(
    'keybase.1.NotifySession.loggedIn',
    ({username}, response, _, getState) => {
      response && response.result()
      // only send this if we think we're not logged in
      if (!getState().config.loggedIn) {
        return [ConfigGen.createLoggedIn()]
      }
    }
  )

  getEngine().setIncomingActionCreators('keybase.1.NotifySession.loggedOut', (_, __, ___, getState) => {
    // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
    if (getState().config.loggedIn) {
      return [ConfigGen.createLoggedOut()]
    }
  })
}

const loadDaemonBootstrapStatus = (
  state: TypedState,
  action: ConfigGen.DaemonHandshakePayload | ConfigGen.LoggedInPayload | ConfigGen.LoggedOutPayload
) => {
  const makeCall = Saga.call(function*() {
    const loadedAction = yield RPCTypes.configGetBootstrapStatusRpcPromise().then(
      (s: RPCTypes.BootstrapStatus) =>
        ConfigGen.createBootstrapStatusLoaded({
          deviceID: s.deviceID,
          deviceName: s.deviceName,
          followers: s.followers || [],
          following: s.following || [],
          loggedIn: s.loggedIn,
          registered: s.registered,
          uid: s.uid,
          username: s.username,
        })
    )
    yield Saga.put(loadedAction)
  })

  switch (action.type) {
    case ConfigGen.daemonHandshake:
      return Saga.sequentially([
        Saga.put(ConfigGen.createDaemonHandshakeWait({increment: true, name: 'config.getBootstrapStatus'})),
        makeCall,
        Saga.put(ConfigGen.createDaemonHandshakeWait({increment: false, name: 'config.getBootstrapStatus'})),
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

let createDaemonHandshakeOnce = false
const startHandshake = () => {
  const firstTimeConnecting = !createDaemonHandshakeOnce
  createDaemonHandshakeOnce = true
  return Saga.put(ConfigGen.createDaemonHandshake({firstTimeConnecting}))
}

const maybeDoneWithDaemonHandshake = (state: TypedState) => {
  if (state.config.daemonHandshakeWaiters.size > 0) {
    // still waiting for things to finish
  } else {
    if (state.config.daemonHandshakeFailedReason) {
      if (state.config.daemonHandshakeRetriesLeft) {
        return Saga.put(ConfigGen.createRestartHandshake())
      }
    } else {
      return Saga.put(ConfigGen.createDaemonHandshakeDone())
    }
  }
}

// TODO switch to new faster rpc when core is done (CORE-8507)
const loadDaemonAccounts = (_: any, action: DevicesGen.RevokedPayload | ConfigGen.DaemonHandshakePayload) => {
  const makeCall = Saga.call(function*() {
    try {
      const loadedAction = yield RPCTypes.configGetExtendedStatusRpcPromise().then(extendedConfig => {
        let usernames = extendedConfig.provisionedUsernames || []
        let defaultUsername = extendedConfig.defaultUsername || ''
        // TODO likely goes away with CORE-8507, currently get extended will remove the user from the list
        if (defaultUsername && !usernames.includes(defaultUsername)) {
          usernames.push(defaultUsername)
        }
        usernames = usernames.sort()

        // Select one if it doesn't exist
        if (usernames.length && !usernames.includes(defaultUsername)) {
          defaultUsername = usernames[0]
        }
        return ConfigGen.createSetAccounts({defaultUsername, usernames})
      })
      yield Saga.put(loadedAction)
      if (action.type === ConfigGen.daemonHandshake) {
        yield Saga.put(ConfigGen.createDaemonHandshakeWait({increment: false, name: 'config.getAccounts'}))
      }
    } catch (error) {
      if (action.type === ConfigGen.daemonHandshake) {
        yield Saga.put(
          ConfigGen.createDaemonHandshakeWait({
            failedReason: "Can't get accounts",
            increment: false,
            name: 'config.getAccounts',
          })
        )
      }
    }
  })

  switch (action.type) {
    case ConfigGen.daemonHandshake:
      return Saga.sequentially([
        Saga.put(ConfigGen.createDaemonHandshakeWait({increment: true, name: 'config.getAccounts'})),
        makeCall,
      ])
    case DevicesGen.revoked:
      return makeCall
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(action.type);
      */
      return undefined
  }
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
    if (action.type === ConfigGen.loggedIn && !action.payload.startedUpLoggedIn) {
      // only do this if we're not handling the initial loggedIn event, cause its handled by routeToInitialScreenOnce
      return Saga.put(RouteTree.switchRouteDef(appRouteTree))
    }
  } else {
    return Saga.put(RouteTree.switchRouteDef(loginRouteTree))
  }
}

const resetGlobalStore = () => Saga.put({payload: undefined, type: ConfigGen.resetStore})

const startLogoutHandshake = () => Saga.put(ConfigGen.createLogoutHandshake())

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
    const actions = [Saga.put(RouteTree.switchRouteDef(appRouteTree))]
    if (
      state.config.startupConversation &&
      state.config.startupConversation !== ChatConstants.noConversationIDKey
    ) {
      return Saga.sequentially([
        ...actions,
        Saga.put(
          ChatGen.createSelectConversation({
            conversationIDKey: state.config.startupConversation,
            reason: 'push',
          })
        ),
        Saga.put(ChatGen.createNavigateToThread()),
      ])
    }

    if (state.config.startupLink) {
      // A user page?
      try {
        const url = new URL(state.config.startupLink)
        const username = ProfileConstants.urlToUsername(url)
        logger.info('AppLink: url', url.href, 'username', username)
        if (username) {
          return Saga.sequentially([...actions, Saga.put(ProfileGen.createShowUserProfile({username}))])
        }
      } catch (e) {
        logger.info('AppLink: could not parse link', state.config.startupLink)
      }
    }

    return Saga.sequentially([
      ...actions,
      Saga.put(RouteTree.navigateTo([state.config.startupTab || Tabs.peopleTab])),
    ])
  } else {
    // Show a login screen
    return Saga.sequentially([
      Saga.put(RouteTree.switchRouteDef(loginRouteTree)),
      Saga.put(RouteTree.navigateTo([], [Tabs.loginTab])),
    ])
  }
}

// We don't get the initial logged in by the server
const emitInitialLoggedIn = (state: TypedState) =>
  state.config.loggedIn && Saga.put(ConfigGen.createLoggedIn({startedUpLoggedIn: true}))

function* configSaga(): Saga.SagaGenerator<any, any> {
  // TODO handle logout stuff also
  yield Saga.actionToAction(ConfigGen.installerRan, dispatchSetupEngineListeners)
  yield Saga.actionToAction([ConfigGen.restartHandshake, ConfigGen.startHandshake], startHandshake)
  yield Saga.actionToAction(ConfigGen.daemonHandshakeWait, maybeDoneWithDaemonHandshake)
  yield Saga.actionToAction(
    [ConfigGen.loggedIn, ConfigGen.loggedOut, ConfigGen.daemonHandshake],
    loadDaemonBootstrapStatus
  )
  yield Saga.actionToAction([DevicesGen.revoked, ConfigGen.daemonHandshake], loadDaemonAccounts)
  yield Saga.actionToAction([ConfigGen.loggedIn, ConfigGen.loggedOut], switchRouteDef)
  yield Saga.actionToAction(ConfigGen.daemonHandshakeDone, routeToInitialScreen)
  yield Saga.actionToAction(ConfigGen.daemonHandshakeDone, emitInitialLoggedIn)

  yield Saga.actionToAction(ConfigGen.logout, startLogoutHandshake)
  yield Saga.actionToAction(ConfigGen.logoutHandshakeWait, maybeDoneWithLogoutHandshake)
  yield Saga.actionToAction(ConfigGen.loggedOut, resetGlobalStore)

  yield Saga.actionToAction(ConfigGen.setDeletedSelf, showDeletedSelfRootPage)

  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)

  yield Saga.fork(PlatformSpecific.platformConfigSaga)
  yield Saga.fork(avatarSaga)
}

export default configSaga
