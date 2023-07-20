import * as ConfigGen from './config-gen'
import * as Chat2Gen from './chat2-gen'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as Followers from '../constants/followers'
import * as Constants from '../constants/config'
import * as Platform from '../constants/platform'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Router2 from '../constants/router2'
import * as DarkMode from '../constants/darkmode'
import * as WhatsNew from '../constants/whats-new'
import * as Z from '../util/zustand'
import {_getNavigator} from '../constants/router2'
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
    dispatch.setLoggedIn(false, false)
  }
}

const getFollowerInfo = () => {
  const {uid} = Constants.useCurrentUserState.getState()
  logger.info(`getFollowerInfo: init; uid=${uid}`)
  if (uid) {
    // request follower info in the background
    RPCTypes.configRequestFollowingAndUnverifiedFollowersRpcPromise()
      .then(() => {})
      .catch(() => {})
  }
}

// set to true so we reget status when we're reachable again
const loadDaemonBootstrapStatus = async (fromGregor: boolean) => {
  const version = Constants.useDaemonState.getState().handshakeVersion
  const reduxDispatch = Z.getReduxDispatch()
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
    Constants.useConfigState.getState().dispatch.setLoggedIn(loggedIn, false)
    reduxDispatch(Chat2Gen.createUpdateUserReacjis({userReacjis}))

    // set HTTP srv info
    if (s.httpSrvInfo) {
      logger.info(`[Bootstrap] http server: addr: ${s.httpSrvInfo.address} token: ${s.httpSrvInfo.token}`)
      Constants.useConfigState.getState().dispatch.setHTTPSrvInfo(s.httpSrvInfo.address, s.httpSrvInfo.token)
    } else {
      logger.info(`[Bootstrap] http server: no info given`)
    }

    // if we're logged in act like getAccounts is done already
    if (!fromGregor && loggedIn) {
      const {handshakeWaiters} = Constants.useDaemonState.getState()
      if (handshakeWaiters.get(getAccountsWaitKey)) {
        wait(getAccountsWaitKey, version, false)
      }
    }
  }

  await makeCall()
}

// Load accounts, this call can be slow so we attempt to continue w/o waiting if we determine we're logged in
// normally this wouldn't be worth it but this is startup
const getAccountsWaitKey = 'config.getAccounts'

const loadDaemonAccounts = () => {
  const f = async () => {
    const version = Constants.useDaemonState.getState().handshakeVersion

    let handshakeWait = false
    let handshakeVersion = 0

    handshakeVersion = version
    // did we beat getBootstrapStatus?
    if (!Constants.useConfigState.getState().loggedIn) {
      handshakeWait = true
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
      UsersConstants.useState
        .getState()
        .dispatch.updates(
          Object.keys(usernameToFullname).map(name => ({info: {fullname: usernameToFullname[name]}, name}))
        )

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
  Container.ignorePromise(f())
}

const updateServerConfig = () => {
  const f = async () => {
    if (Constants.useConfigState.getState().loggedIn) {
      await RPCTypes.configUpdateLastLoggedInAndServerConfigRpcPromise({
        serverConfigPath: Platform.serverConfigFileName,
      })
    }
  }
  Z.ignorePromise(f())
}

const newNavigation = (
  _: unknown,
  action:
    | RouteTreeGen.SetParamsPayload
    | RouteTreeGen.NavigateAppendPayload
    | RouteTreeGen.NavigateUpPayload
    | RouteTreeGen.SwitchTabPayload
) => {
  Router2.dispatchOldAction(action)
}

const emitStartupOnLoadNotInARush = () => {
  const f = async () => {
    await Container.timeoutPromise(1000)
    requestAnimationFrame(() => {
      Constants.useConfigState.getState().dispatch.loadOnStart('startupOrReloginButNotInARush')
    })
  }
  Z.ignorePromise(f())
}

const initConfig = () => {
  // Re-get info about our account if you log in/we're done handshaking/became reachable
  Constants.useConfigState.subscribe((s, old) => {
    if (s.gregorReachable === old.gregorReachable) return

    if (s.gregorReachable === RPCTypes.Reachable.yes) {
      Z.ignorePromise(loadDaemonBootstrapStatus(true))
    }
  })

  Constants.useConfigState.subscribe((s, old) => {
    if (s.revokedTrigger === old.revokedTrigger) return
    loadDaemonAccounts()
  })

  Constants.useConfigState.subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    const reduxDispatch = Z.getReduxDispatch()

    // Ignore the 'fake' loggedIn cause we'll get the daemonHandshake and we don't want to do this twice
    if (!s.loggedInCausedbyStartup || !s.loggedIn) {
      Z.ignorePromise(loadDaemonBootstrapStatus(false))
      loadDaemonAccounts()
    }

    const {loadOnStart} = Constants.useConfigState.getState().dispatch

    if (s.loggedIn) {
      if (!s.loggedInCausedbyStartup) {
        loadOnStart('reloggedIn')
        const f = async () => {
          await Container.timeoutPromise(1000)
          requestAnimationFrame(() => {
            loadOnStart('startupOrReloginButNotInARush')
          })
        }
        Z.ignorePromise(f())
      }
    } else {
      reduxDispatch({payload: {}, type: 'common:resetStore'} as any)
    }
  })

  Container.listenAction(
    [RouteTreeGen.setParams, RouteTreeGen.navigateAppend, RouteTreeGen.navigateUp, RouteTreeGen.switchTab],
    newNavigation
  )

  // Give time for all waiters to register and allow the case where there are no waiters
  Constants.useLogoutState.subscribe((s, old) => {
    if (s.version === old.version) return
    const version = s.version
    const f = async () => {
      const waitKey = 'nullhandshake'
      Constants.useLogoutState.getState().dispatch.wait(waitKey, version, true)
      await Z.timeoutPromise(10)
      Constants.useLogoutState.getState().dispatch.wait(waitKey, version, false)
    }
    Z.ignorePromise(f())
  })

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

  Constants.useConfigState.subscribe((s, old) => {
    if (s.gregorPushState === old.gregorPushState) return
    const items = s.gregorPushState
    const allowAnimatedEmojis = !items.find(i => i.item.category === 'emojianimations')
    Constants.useConfigState.getState().dispatch.setAllowAnimatedEmojis(allowAnimatedEmojis)

    const lastSeenItem = items.find(i => i.item.category === 'whatsNewLastSeenVersion')
    WhatsNew.useState.getState().dispatch.updateLastSeen(lastSeenItem)
  })

  Constants.useConfigState.subscribe((s, old) => {
    if (s.loadOnStartPhase === old.loadOnStartPhase) return

    switch (s.loadOnStartPhase) {
      case 'startupOrReloginButNotInARush':
        getFollowerInfo()
        updateServerConfig()
        break
      default:
    }
  })

  // Kick off platform specific stuff
  initPlatformListener()

  Container.listenAction(ConfigGen.resetStore, () => {
    Z.resetAllStores()
  })

  Container.listenAction(EngineGen.keybase1NotifyTeamAvatarUpdated, (_, action) => {
    const {name} = action.payload.params
    useAvatarState.getState().dispatch.updated(name)
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

  const checkNav = (version: number) => {
    // have one
    if (_getNavigator()) return

    const name = 'nav'
    const {wait} = Constants.useDaemonState.getState().dispatch
    wait(name, version, true)
    logger.info('Waiting on nav')
    Constants.useConfigState.setState(s => {
      s.dispatch.dynamic.setNavigatorExistsNative = () => {
        if (_getNavigator()) {
          Constants.useConfigState.setState(s => {
            s.dispatch.dynamic.setNavigatorExistsNative = undefined
          })
          wait(name, version, false)
        } else {
          logger.info('Waiting on nav, got setNavigator but nothing in constants?')
        }
      }
    })
  }

  Constants.useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion === old.handshakeVersion) return
    const version = s.handshakeVersion
    checkNav(version)

    const f = async () => {
      const name = 'config.getBootstrapStatus'
      const {wait} = Constants.useDaemonState.getState().dispatch
      wait(name, version, true)
      await loadDaemonBootstrapStatus(false)
      wait(name, version, false)
    }
    Z.ignorePromise(f())
    loadDaemonAccounts()
    DarkMode.useDarkModeState.getState().dispatch.loadDarkPrefs()
  })

  let _emitStartupOnLoadDaemonConnectedOnce = false
  Constants.useDaemonState.subscribe((s, old) => {
    if (s.handshakeState === old.handshakeState || s.handshakeState !== 'done') return
    emitStartupOnLoadNotInARush()

    if (!_emitStartupOnLoadDaemonConnectedOnce) {
      _emitStartupOnLoadDaemonConnectedOnce = true
      Constants.useConfigState.getState().dispatch.loadOnStart('connectedToDaemonForFirstTime')
    }
  })

  Container.listenAction(EngineGen.keybase1GregorUIPushState, (_, action) => {
    const {state} = action.payload.params
    Constants.useConfigState.getState().dispatch.setGregorPushState(state)
  })

  Container.listenAction(EngineGen.keybase1NotifyRuntimeStatsRuntimeStatsUpdate, (_, action) => {
    Constants.useConfigState.getState().dispatch.updateRuntimeStats(action.payload.params.stats ?? undefined)
  })
}

export default initConfig
