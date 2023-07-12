import * as ConfigGen from './config-gen'
import * as Chat2Gen from './chat2-gen'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as Followers from '../constants/followers'
import * as GregorGen from './gregor-gen'
import * as Constants from '../constants/config'
import * as Platform from '../constants/platform'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Router2 from '../constants/router2'
import * as DarkMode from '../constants/darkmode'
import * as WhatsNew from '../constants/whats-new'
import * as Z from '../util/zustand'
import {useAvatarState} from '../common-adapters/avatar-zus'
import logger from '../logger'
import {initPlatformListener} from './platform-specific'
import isEqual from 'lodash/isEqual'

const onLoggedIn = () => {
  logger.info('keybase.1.NotifySession.loggedIn')
  // only send this if we think we're not logged in
  const {loggedIn, dispatch} = Constants.useConfigState.getState()
  if (!loggedIn) {
    dispatch.setLoggedIn(true, false)
  }
}

const onLoggedOut = () => {
  logger.info('keybase.1.NotifySession.loggedOut')
  const {loggedIn, dispatch} = Constants.useConfigState.getState()
  // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
  if (loggedIn) {
    dispatch.setLoggedIn(false)
  }
}

const getFollowerInfo = (_: unknown, action: ConfigGen.LoadOnStartPayload) => {
  const {uid} = Constants.useCurrentUserState.getState()
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
    | ConfigGen.LoggedInChangedPayload
    | ConfigGen.DaemonHandshakePayload
    | GregorGen.UpdateReachablePayload,
  listenerApi: Container.ListenerApi
) => {
  // Ignore the 'fake' loggedIn cause we'll get the daemonHandshake and we don't want to do this twice
  if (
    action.type === ConfigGen.loggedInChanged &&
    action.payload.causedByStartup &&
    Constants.useConfigState.getState().loggedIn
  ) {
    return
  }

  if (action.type === GregorGen.updateReachable && action.payload.reachable === RPCTypes.Reachable.no) {
    wasUnreachable = true
  }

  const {wait} = Constants.useDaemonState.getState().dispatch
  const {setBootstrap} = Constants.useCurrentUserState.getState().dispatch
  const {setDefaultUsername} = Constants.useConfigState.getState().dispatch

  const makeCall = async () => {
    const s = await RPCTypes.configGetBootstrapStatusRpcPromise()
    const {userReacjis, deviceName, deviceID, uid, loggedIn, username} = s
    setBootstrap({deviceID, deviceName, uid, username})
    if (username) {
      setDefaultUsername(username)
    }
    if (loggedIn) {
      Constants.useConfigState.getState().dispatch.setUserSwitching(false)
    }

    logger.info(`[Bootstrap] loggedIn: ${loggedIn ? 1 : 0}`)
    Constants.useConfigState.getState().dispatch.setLoggedIn(loggedIn)
    listenerApi.dispatch(Chat2Gen.createUpdateUserReacjis({userReacjis}))

    // set HTTP srv info
    if (s.httpSrvInfo) {
      logger.info(`[Bootstrap] http server: addr: ${s.httpSrvInfo.address} token: ${s.httpSrvInfo.token}`)
      Constants.useConfigState.getState().dispatch.setHTTPSrvInfo(s.httpSrvInfo.address, s.httpSrvInfo.token)
    } else {
      logger.info(`[Bootstrap] http server: no info given`)
    }

    // if we're logged in act like getAccounts is done already
    if (action.type === ConfigGen.daemonHandshake && loggedIn) {
      const {handshakeWaiters} = Constants.useDaemonState.getState()
      const {version} = action.payload
      if (handshakeWaiters.get(getAccountsWaitKey)) {
        wait(getAccountsWaitKey, version, false)
      }
    }
  }

  switch (action.type) {
    case ConfigGen.daemonHandshake:
      {
        const {version} = action.payload
        const name = 'config.getBootstrapStatus'
        wait(name, version, true)
        await makeCall()
        wait(name, version, false)
      }
      break
    case GregorGen.updateReachable:
      if (action.payload.reachable === RPCTypes.Reachable.yes && wasUnreachable) {
        wasUnreachable = false // reset it
        await makeCall()
      }
      break
    case ConfigGen.loggedInChanged:
      await makeCall()
      break
  }
}

// Load accounts, this call can be slow so we attempt to continue w/o waiting if we determine we're logged in
// normally this wouldn't be worth it but this is startup
const getAccountsWaitKey = 'config.getAccounts'

const loadDaemonAccounts = async (
  _: unknown,
  action: ConfigGen.RevokedPayload | ConfigGen.DaemonHandshakePayload | ConfigGen.LoggedInChangedPayload
) => {
  // ignore since we handle handshake
  if (
    action.type === ConfigGen.loggedInChanged &&
    Constants.useConfigState.getState().loggedIn &&
    action.payload.causedByStartup
  ) {
    return
  }

  let handshakeWait = false
  let handshakeVersion = 0

  if (action.type === ConfigGen.daemonHandshake) {
    handshakeVersion = action.payload.version
    // did we beat getBootstrapStatus?
    if (!Constants.useConfigState.getState().loggedIn) {
      handshakeWait = true
    }
  }

  const {wait} = Constants.useDaemonState.getState().dispatch
  try {
    if (handshakeWait) {
      wait(getAccountsWaitKey, handshakeVersion, true)
    }

    const configuredAccounts = (await RPCTypes.loginGetConfiguredAccountsRpcPromise()) ?? []
    // already have one?
    const {defaultUsername} = Constants.useConfigState.getState()
    const {setAccounts, setDefaultUsername} = Constants.useConfigState.getState().dispatch

    let existingDefaultFound = false
    let currentName = ''
    const nextConfiguredAccounts: Constants.Store['configuredAccounts'] = []
    const usernameToFullname: {[username: string]: string} = {}

    configuredAccounts.forEach(account => {
      const {username, isCurrent, fullname, hasStoredSecret} = account
      if (username === defaultUsername) {
        existingDefaultFound = true
      }
      if (isCurrent) {
        currentName = account.username
      }
      nextConfiguredAccounts.push({hasStoredSecret, username})
      usernameToFullname[username] = fullname
    })
    if (!existingDefaultFound) {
      setDefaultUsername(currentName)
    }
    setAccounts(nextConfiguredAccounts)
    const UsersConstants = await import('../constants/users')
    Object.keys(usernameToFullname).forEach(username => {
      const fullname = usernameToFullname[username]
      UsersConstants.useState.getState().dispatch.update(username, {fullname})
    })

    if (handshakeWait) {
      // someone dismissed this already?
      const {handshakeWaiters} = Constants.useDaemonState.getState()
      if (handshakeWaiters.get(getAccountsWaitKey)) {
        wait(getAccountsWaitKey, handshakeVersion, false)
      }
    }
  } catch (error) {
    if (handshakeWait) {
      // someone dismissed this already?
      const {handshakeWaiters} = Constants.useDaemonState.getState()
      if (handshakeWaiters.get(getAccountsWaitKey)) {
        wait(getAccountsWaitKey, handshakeVersion, false, "Can't get accounts")
      }
    }
  }
}

const onAndroidShare = () => {
  // already loaded, so just go now
  if (Constants.useConfigState.getState().startup.loaded) {
    return RouteTreeGen.createNavigateAppend({path: ['incomingShareNew']})
  }
  return false
}

const allowLogoutWaiters = async (
  _: Container.TypedState,
  action: ConfigGen.LogoutHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  const waitKey = 'nullhandshake'
  const {version} = action.payload
  Constants.useLogoutState.getState().dispatch.wait(waitKey, version, true)
  await listenerApi.delay(10)
  Constants.useLogoutState.getState().dispatch.wait(waitKey, version, false)
}

const updateServerConfig = async (_: unknown, action: ConfigGen.LoadOnStartPayload) =>
  action.payload.phase === 'startupOrReloginButNotInARush' &&
  Constants.useConfigState.getState().loggedIn &&
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

const logoutAndTryToLogInAs = async (_: unknown, action: ConfigGen.LogoutAndTryToLogInAsPayload) => {
  if (Constants.useConfigState.getState().loggedIn) {
    await RPCTypes.loginLogoutRpcPromise({force: false, keepSecrets: true}, Constants.loginWaitingKey)
  }

  const {setDefaultUsername} = Constants.useConfigState.getState().dispatch
  setDefaultUsername(action.payload.username)
}

const emitStartupOnLoadNotInARush = async () => {
  await Container.timeoutPromise(1000)
  return new Promise<ConfigGen.LoadOnStartPayload>(resolve => {
    requestAnimationFrame(() => {
      resolve(ConfigGen.createLoadOnStart({phase: 'startupOrReloginButNotInARush'}))
    })
  })
}

const onPowerMonitorEvent = async (_s: unknown, action: ConfigGen.PowerMonitorEventPayload) => {
  const {event} = action.payload
  try {
    await RPCTypes.appStatePowerMonitorEventRpcPromise({event})
  } catch {}
}

const initConfig = () => {
  Container.listenAction(ConfigGen.daemonHandshake, () => {
    DarkMode.useDarkModeState.getState().dispatch.loadDarkPrefs()
  })
  // Re-get info about our account if you log in/we're done handshaking/became reachable
  Container.listenAction(
    [ConfigGen.loggedInChanged, ConfigGen.daemonHandshake, GregorGen.updateReachable],
    loadDaemonBootstrapStatus
  )
  // Load the known accounts if you revoke / handshake / logout
  Container.listenAction(
    [ConfigGen.revoked, ConfigGen.daemonHandshake, ConfigGen.loggedInChanged],
    loadDaemonAccounts
  )

  Container.listenAction(ConfigGen.daemonHandshakeDone, emitStartupOnLoadNotInARush)

  let _emitStartupOnLoadDaemonConnectedOnce = false
  Container.listenAction(ConfigGen.daemonHandshakeDone, () => {
    if (!_emitStartupOnLoadDaemonConnectedOnce) {
      _emitStartupOnLoadDaemonConnectedOnce = true
      return ConfigGen.createLoadOnStart({phase: 'connectedToDaemonForFirstTime'})
    }
    return false
  })
  Container.listenAction(ConfigGen.loggedInChanged, (_, action) => {
    return Constants.useConfigState.getState().loggedIn && !action.payload.causedByStartup
      ? ConfigGen.createLoadOnStart({phase: 'reloggedIn'})
      : false
  })
  Container.listenAction(ConfigGen.loggedInChanged, async (_, action) => {
    if (!Constants.useConfigState.getState().loggedIn) {
      return false
    }
    if (action.payload.causedByStartup) {
      return false
    }
    await Container.timeoutPromise(1000)
    return new Promise<ConfigGen.LoadOnStartPayload>(resolve => {
      requestAnimationFrame(() => {
        resolve(ConfigGen.createLoadOnStart({phase: 'startupOrReloginButNotInARush'}))
      })
    })
  })

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

  // Give time for all waiters to register and allow the case where there are no waiters
  Container.listenAction(ConfigGen.logoutHandshake, allowLogoutWaiters)
  // When we're all done lets clean up
  Container.listenAction(ConfigGen.loggedInChanged, () => {
    return !Constants.useConfigState.getState().loggedIn
      ? ({payload: {}, type: 'common:resetStore'} as any)
      : null
  })
  // Store per user server config info
  Container.listenAction(ConfigGen.loadOnStart, updateServerConfig)

  Container.listenAction(EngineGen.keybase1NotifySessionLoggedIn, onLoggedIn)
  Container.listenAction(EngineGen.keybase1NotifySessionLoggedOut, onLoggedOut)

  Container.listenAction(EngineGen.connected, () => {
    Constants.useDaemonState.getState().dispatch.startHandshake()
  })

  Container.listenAction(EngineGen.disconnected, () => {
    logger
      .dump()
      .then(() => {})
      .catch(() => {})
    Constants.useDaemonState.getState().dispatch.setError(new Error('Disconnected'))
  })

  Container.listenAction(EngineGen.keybase1NotifyServiceHTTPSrvInfoUpdate, (_, action) => {
    Constants.useConfigState
      .getState()
      .dispatch.setHTTPSrvInfo(action.payload.params.info.address, action.payload.params.info.token)
  })

  Container.listenAction(GregorGen.pushState, (_, action) => {
    const items = action.payload.state
    const allowAnimatedEmojis = !items.find(i => i.item.category === 'emojianimations')
    Constants.useConfigState.getState().dispatch.setAllowAnimatedEmojis(allowAnimatedEmojis)

    const lastSeenItem = items.find(i => i.item.category === 'whatsNewLastSeenVersion')
    WhatsNew.useState.getState().dispatch.updateLastSeen(lastSeenItem)
  })

  Container.listenAction(ConfigGen.loadOnStart, getFollowerInfo)

  Container.listenAction(ConfigGen.androidShare, onAndroidShare)

  // Kick off platform specific stuff
  initPlatformListener()

  Container.listenAction(ConfigGen.powerMonitorEvent, onPowerMonitorEvent)

  Container.listenAction(ConfigGen.resetStore, () => {
    Z.resetAllStores()
  })

  Container.listenAction(EngineGen.keybase1NotifyTeamAvatarUpdated, (_, action) => {
    const {name} = action.payload.params
    useAvatarState.getState().dispatch.updated(name)
  })

  Container.listenAction(ConfigGen.setSystemDarkMode, (_, action) => {
    // only to bridge electron bridge, todo remove this
    if (!Container.isMobile) {
      const {setSystemDarkMode} = DarkMode.useDarkModeState.getState().dispatch
      setSystemDarkMode(action.payload.dark)
    }
  })

  Container.listenAction(EngineGen.keybase1NotifyTrackingTrackingChanged, (_, action) => {
    const {isTracking, username} = action.payload.params
    Followers.useFollowerState.getState().dispatch.updateFollowing(username, isTracking)
  })

  Container.listenAction(EngineGen.keybase1NotifyTrackingTrackingInfo, (_, action) => {
    const {uid, followers: _newFollowers, followees: _newFollowing} = action.payload.params
    if (Constants.useCurrentUserState.getState().uid !== uid) {
      return
    }
    const newFollowers = new Set(_newFollowers)
    const newFollowing = new Set(_newFollowing)
    const {following: oldFollowing, followers: oldFollowers, dispatch} = Followers.useFollowerState.getState()
    const following = isEqual(newFollowing, oldFollowing) ? oldFollowing : newFollowing
    const followers = isEqual(newFollowers, oldFollowers) ? oldFollowers : newFollowers
    dispatch.replace(followers, following)
  })

  Container.listenAction(ConfigGen.updateWindowMaxState, (_, action) => {
    Constants.useConfigState.getState().dispatch.setWindowIsMax(action.payload.max)
  })

  Container.listenAction(ConfigGen.updateWindowState, (_, action) => {
    Constants.useConfigState.getState().dispatch.updateWindowState(action.payload.windowState)
  })

  Container.listenAction(ConfigGen.updateWindowShown, (_, action) => {
    Constants.useConfigState.getState().dispatch.windowShown(action.payload.component)
  })

  Container.listenAction(ConfigGen.remoteWindowWantsProps, (_, action) => {
    const {component, param} = action.payload
    Constants.useConfigState.getState().dispatch.remoteWindowNeedsProps(component, param)
  })

  Container.listenAction(EngineGen.keybase1NotifyRuntimeStatsRuntimeStatsUpdate, (_, action) => {
    Constants.useConfigState.getState().dispatch.updateRuntimeStats(action.payload.params.stats ?? undefined)
  })
}

export default initConfig
