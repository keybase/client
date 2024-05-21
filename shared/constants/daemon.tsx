import * as C from '.'
import logger from '@/logger'
import * as T from './types'
import * as Z from '@/util/zustand'

export const maxHandshakeTries = 3

// Load accounts, this call can be slow so we attempt to continue w/o waiting if we determine we're logged in
// normally this wouldn't be worth it but this is startup
const getAccountsWaitKey = 'config.getAccounts'

export type Store = T.Immutable<{
  error?: Error
  handshakeState: T.Config.DaemonHandshakeState
  handshakeFailedReason: string
  handshakeRetriesLeft: number
  handshakeWaiters: Map<string, number>
  // if we ever restart handshake up this so we can ignore any waiters for old things
  handshakeVersion: number
}>

const initialStore: Store = {
  handshakeFailedReason: '',
  handshakeRetriesLeft: maxHandshakeTries,
  handshakeState: 'starting',
  handshakeVersion: 0,
  handshakeWaiters: new Map(),
}

interface State extends Store {
  dispatch: {
    loadDaemonAccounts: () => void
    loadDaemonBootstrapStatus: () => Promise<void>
    refreshAccounts: () => Promise<void>
    resetState: () => void
    setError: (e?: Error) => void
    setFailed: (r: string) => void
    setState: (s: T.Config.DaemonHandshakeState) => void
    wait: (
      name: string,
      version: number,
      increment: boolean,
      failedReason?: string,
      failedFatal?: true
    ) => void
    startHandshake: () => void
    daemonHandshake: (version: number) => void
    daemonHandshakeDone: () => void
    onRestartHandshakeNative: () => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const restartHandshake = () => {
    get().dispatch.onRestartHandshakeNative()
    get().dispatch.setState('starting')
    get().dispatch.setFailed('')
    set(s => {
      s.handshakeRetriesLeft = maxHandshakeTries
    })
  }

  const _onRestartHandshakeNative = () => {
    // overriden on desktop
  }

  let _firstTimeBootstrapDone = true
  const maybeDoneWithDaemonHandshake = (version: number) => {
    if (version !== get().handshakeVersion) {
      // ignore out of date actions
      return
    }
    const {handshakeWaiters, handshakeFailedReason, handshakeRetriesLeft} = get()
    if (handshakeWaiters.size > 0) {
      // still waiting for things to finish
    } else {
      if (handshakeFailedReason) {
        if (handshakeRetriesLeft) {
          restartHandshake()
        }
      } else {
        if (_firstTimeBootstrapDone) {
          _firstTimeBootstrapDone = false
          logger.info('First bootstrap ended')
        }
        get().dispatch.daemonHandshakeDone()
      }
    }
    return
  }

  // When there are no more waiters, we can show the actual app

  let _emitStartupOnLoadDaemonConnectedOnce = false
  const dispatch: State['dispatch'] = {
    daemonHandshake: version => {
      get().dispatch.setState('waitingForWaiters')
      const changed = get().handshakeVersion !== version
      set(s => {
        s.handshakeVersion = version
        s.handshakeWaiters = new Map()
      })

      if (!changed) return

      const checkNav = (version: number) => {
        // have one
        if (C.Router2._getNavigator()) return
        const name = 'nav'
        const {wait} = get().dispatch
        wait(name, version, true)
        logger.info('Waiting on nav')
        C.useConfigState.setState(s => {
          s.dispatch.dynamic.setNavigatorExistsNative = C.wrapErrors(() => {
            if (C.Router2._getNavigator()) {
              C.useConfigState.setState(s => {
                s.dispatch.dynamic.setNavigatorExistsNative = undefined
              })
              wait(name, version, false)
            } else {
              logger.info('Waiting on nav, got setNavigator but nothing in constants?')
            }
          })
        })
      }
      checkNav(version)

      const f = async () => {
        const name = 'config.getBootstrapStatus'
        const {wait} = get().dispatch
        wait(name, version, true)
        await get().dispatch.loadDaemonBootstrapStatus()
        C.useDarkModeState.getState().dispatch.loadDarkPrefs()
        C.useChatState.getState().dispatch.loadStaticConfig()
        wait(name, version, false)
      }
      C.ignorePromise(f())
      get().dispatch.loadDaemonAccounts()
    },
    daemonHandshakeDone: () => {
      get().dispatch.setState('done')
    },
    loadDaemonAccounts: () => {
      const f = async () => {
        const version = get().handshakeVersion
        if (C.useConfigState.getState().configuredAccounts.length) {
          // bail on already loaded
          return
        }

        let handshakeWait = false
        let handshakeVersion = 0

        handshakeVersion = version
        // did we beat getBootstrapStatus?
        if (!C.useConfigState.getState().loggedIn) {
          handshakeWait = true
        }

        const {wait} = get().dispatch
        try {
          if (handshakeWait) {
            wait(getAccountsWaitKey, handshakeVersion, true)
          }

          await get().dispatch.refreshAccounts()

          if (handshakeWait) {
            // someone dismissed this already?
            const {handshakeWaiters} = get()
            if (handshakeWaiters.get(getAccountsWaitKey)) {
              wait(getAccountsWaitKey, handshakeVersion, false)
            }
          }
        } catch {
          if (handshakeWait) {
            // someone dismissed this already?
            const {handshakeWaiters} = get()
            if (handshakeWaiters.get(getAccountsWaitKey)) {
              wait(getAccountsWaitKey, handshakeVersion, false, "Can't get accounts")
            }
          }
        }
      }
      C.ignorePromise(f())
    },
    // set to true so we reget status when we're reachable again
    loadDaemonBootstrapStatus: async () => {
      const version = get().handshakeVersion
      const {wait} = get().dispatch

      const f = async () => {
        const {setBootstrap} = C.useCurrentUserState.getState().dispatch
        const {setDefaultUsername} = C.useConfigState.getState().dispatch
        const s = await T.RPCGen.configGetBootstrapStatusRpcPromise()
        const {userReacjis, deviceName, deviceID, uid, loggedIn, username} = s
        setBootstrap({deviceID, deviceName, uid, username})
        if (username) {
          setDefaultUsername(username)
        }
        if (loggedIn) {
          C.useConfigState.getState().dispatch.setUserSwitching(false)
        }

        logger.info(`[Bootstrap] loggedIn: ${loggedIn ? 1 : 0}`)
        C.useConfigState.getState().dispatch.setLoggedIn(loggedIn, false)
        C.useChatState.getState().dispatch.updateUserReacjis(userReacjis)

        // set HTTP srv info
        if (s.httpSrvInfo) {
          logger.info(`[Bootstrap] http server: addr: ${s.httpSrvInfo.address} token: ${s.httpSrvInfo.token}`)
          C.useConfigState.getState().dispatch.setHTTPSrvInfo(s.httpSrvInfo.address, s.httpSrvInfo.token)
        } else {
          logger.info(`[Bootstrap] http server: no info given`)
        }

        // if we're logged in act like getAccounts is done already
        if (loggedIn) {
          const {handshakeWaiters} = get()
          if (handshakeWaiters.get(getAccountsWaitKey)) {
            wait(getAccountsWaitKey, version, false)
          }
        }
      }
      return await f()
    },
    onRestartHandshakeNative: _onRestartHandshakeNative,
    refreshAccounts: async () => {
      const configuredAccounts = (await T.RPCGen.loginGetConfiguredAccountsRpcPromise()) ?? []
      // already have one?
      const {defaultUsername} = C.useConfigState.getState()
      const {setAccounts, setDefaultUsername} = C.useConfigState.getState().dispatch

      let existingDefaultFound = false as boolean
      let currentName = ''
      const nextConfiguredAccounts: Array<T.Config.ConfiguredAccount> = []
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
      C.useUsersState.getState().dispatch.updates(
        Object.keys(usernameToFullname).map(name => ({
          info: {fullname: usernameToFullname[name]},
          name,
        }))
      )
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: {
          ...s.dispatch,
          onRestartHandshakeNative: s.dispatch.onRestartHandshakeNative,
        },
        handshakeState: s.handshakeState,
        handshakeVersion: s.handshakeVersion,
      }))
    },
    setError: e => {
      if (e) {
        logger.error('Error (daemon):', e)
      }
      set(s => {
        s.error = e
      })
    },
    setFailed: r => {
      set(s => {
        s.handshakeFailedReason = r
      })
    },
    setState: ds => {
      if (ds === get().handshakeState) return
      set(s => {
        s.handshakeState = ds
      })

      if (ds !== 'done') return

      if (!_emitStartupOnLoadDaemonConnectedOnce) {
        _emitStartupOnLoadDaemonConnectedOnce = true
        C.useConfigState.getState().dispatch.loadOnStart('connectedToDaemonForFirstTime')
      }
    },
    startHandshake: () => {
      get().dispatch.setError()
      get().dispatch.setState('starting')
      get().dispatch.setFailed('')
      set(s => {
        s.handshakeRetriesLeft = Math.max(0, s.handshakeRetriesLeft - 1)
      })
      get().dispatch.daemonHandshake(get().handshakeVersion + 1)
    },
    wait: (name, version, increment, failedReason, failedFatal) => {
      const {handshakeState, handshakeFailedReason, handshakeVersion} = get()
      if (handshakeState !== 'waitingForWaiters') {
        throw new Error("Should only get a wait while we're waiting")
      }
      if (version !== handshakeVersion) {
        logger.info('Ignoring handshake wait due to version mismatch', version, handshakeVersion)
        return
      }
      set(s => {
        const oldCount = s.handshakeWaiters.get(name) || 0
        const newCount = oldCount + (increment ? 1 : -1)
        if (newCount === 0) {
          s.handshakeWaiters.delete(name)
        } else {
          s.handshakeWaiters.set(name, newCount)
        }
      })

      if (failedFatal) {
        get().dispatch.setFailed(failedReason || '')
        set(s => {
          s.handshakeRetriesLeft = 0
        })
      } else {
        // Keep the first error
        const f = failedReason || ''
        if (f && !handshakeFailedReason) {
          get().dispatch.setFailed(f)
        }
      }
      maybeDoneWithDaemonHandshake(version)
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
