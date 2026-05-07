import type * as NetInfo from '@react-native-community/netinfo'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import * as Z from '@/util/zustand'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {defaultUseNativeFrame} from '@/constants/platform'
import {useConfigState} from '@/stores/config'

export type ConnectionType = NetInfo.NetInfoStateType | 'notavailable'

type WindowState = T.Immutable<{
  dockHidden: boolean
  height: number
  isFullScreen: boolean
  isMaximized: boolean
  width: number
  windowHidden: boolean
  x: number
  y: number
}>

type Store = T.Immutable<{
  active: boolean
  appFocused: boolean
  forceSmallNav: boolean
  fsCriticalUpdate: boolean
  mobileAppState: 'active' | 'background' | 'inactive' | 'unknown'
  networkStatus?: {online: boolean; type: ConnectionType; isInit?: boolean}
  notifySound: boolean
  openAtLogin: boolean
  useNativeFrame: boolean
  windowState: WindowState
}>

const initialStore: Store = {
  active: true,
  appFocused: true,
  forceSmallNav: false,
  fsCriticalUpdate: false,
  mobileAppState: 'unknown',
  networkStatus: undefined,
  notifySound: false,
  openAtLogin: true,
  useNativeFrame: defaultUseNativeFrame,
  windowState: {
    dockHidden: false,
    height: 800,
    isFullScreen: false,
    isMaximized: false,
    width: 600,
    windowHidden: false,
    x: 0,
    y: 0,
  },
}

export type State = Store & {
  dispatch: {
    changedFocus: (f: boolean) => void
    initNotifySound: () => void
    initForceSmallNav: () => void
    initOpenAtLogin: () => void
    initUseNativeFrame: () => void
    osNetworkStatusChanged: (online: boolean, type: ConnectionType, isInit?: boolean) => void
    resetState: (isDebug?: boolean) => void
    setActive: (a: boolean) => void
    setForceSmallNav: (f: boolean) => void
    setFsCriticalUpdate: (u: boolean) => void
    setMobileAppState: (nextAppState: 'active' | 'background' | 'inactive') => void
    setNotifySound: (n: boolean) => void
    setOpenAtLogin: (open: boolean) => void
    setUseNativeFrame: (use: boolean) => void
    setWindowMaximized: (isMaximized: boolean) => void
    updateWindowState: (ws: Omit<WindowState, 'isMaximized'>) => void
  }
}

export const openAtLoginKey = 'openAtLogin'

export const useShellState = Z.createZustand<State>('shell', (set, get) => {
  const nativeFrameKey = 'useNativeFrame'
  const notifySoundKey = 'notifySound'
  const forceSmallNavKey = 'ui.forceSmallNav'
  const windowStateKey = 'windowState'

  const dispatch: State['dispatch'] = {
    changedFocus: f => {
      if (get().appFocused === f) return
      set(s => {
        s.appFocused = f
      })
    },
    initForceSmallNav: () => {
      const f = async () => {
        try {
          const val = await T.RPCGen.configGuiGetValueRpcPromise({path: forceSmallNavKey})
          const forceSmallNav = val.b
          if (typeof forceSmallNav === 'boolean') {
            set(s => {
              s.forceSmallNav = forceSmallNav
            })
          }
        } catch {}
      }
      ignorePromise(f())
    },
    initNotifySound: () => {
      const f = async () => {
        try {
          const val = await T.RPCGen.configGuiGetValueRpcPromise({path: notifySoundKey})
          const notifySound = val.b
          if (typeof notifySound === 'boolean') {
            set(s => {
              s.notifySound = notifySound
            })
          }
        } catch {}
      }
      ignorePromise(f())
    },
    initOpenAtLogin: () => {
      const f = async () => {
        try {
          const val = await T.RPCGen.configGuiGetValueRpcPromise({path: openAtLoginKey})
          const openAtLogin = val.b
          if (typeof openAtLogin === 'boolean') {
            get().dispatch.setOpenAtLogin(openAtLogin)
          }
        } catch {}
      }
      ignorePromise(f())
    },
    initUseNativeFrame: () => {
      const f = async () => {
        try {
          const val = await T.RPCGen.configGuiGetValueRpcPromise({path: nativeFrameKey})
          const useNativeFrame = val.b === undefined || val.b === null ? defaultUseNativeFrame : val.b
          set(s => {
            s.useNativeFrame = useNativeFrame
          })
        } catch {}
      }
      ignorePromise(f())
    },
    osNetworkStatusChanged: (online, type, isInit) => {
      const old = get().networkStatus
      if (old?.online === online && old.type === type && old.isInit === isInit) return
      set(s => {
        if (!s.networkStatus) {
          s.networkStatus = {isInit, online, type}
        } else {
          s.networkStatus.isInit = isInit
          s.networkStatus.online = online
          s.networkStatus.type = type
        }
      })
      const updateGregor = async () => {
        const reachability = await T.RPCGen.reachabilityCheckReachabilityRpcPromise()
        useConfigState.getState().dispatch.setGregorReachable(reachability.reachable)
      }
      ignorePromise(updateGregor())

      const updateFS = async () => {
        if (isInit) return
        try {
          await T.RPCGen.SimpleFSSimpleFSCheckReachabilityRpcPromise()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn(`failed to check KBFS reachability: ${error.message}`)
        }
      }
      ignorePromise(updateFS())
    },
    // Shell-owned prefs, focus/window state, and local shell badges should survive account-level resets.
    resetState: () => {},
    setActive: a => {
      set(s => {
        s.active = a
      })
    },
    setForceSmallNav: force => {
      const f = async () => {
        await T.RPCGen.configGuiSetValueRpcPromise({
          path: forceSmallNavKey,
          value: {
            b: force,
            isNull: false,
          },
        })
        set(s => {
          s.forceSmallNav = force
        })
      }
      ignorePromise(f())
    },
    setFsCriticalUpdate: u => {
      if (get().fsCriticalUpdate === u) return
      set(s => {
        s.fsCriticalUpdate = u
      })
    },
    setMobileAppState: nextAppState => {
      if (get().mobileAppState === nextAppState) return
      set(s => {
        s.mobileAppState = nextAppState
      })
    },
    setNotifySound: n => {
      set(s => {
        s.notifySound = n
      })
      ignorePromise(
        T.RPCGen.configGuiSetValueRpcPromise({
          path: notifySoundKey,
          value: {
            b: n,
            isNull: false,
          },
        })
      )
    },
    setOpenAtLogin: open => {
      set(s => {
        s.openAtLogin = open
      })
    },
    setUseNativeFrame: use => {
      set(s => {
        s.useNativeFrame = use
      })
      ignorePromise(
        T.RPCGen.configGuiSetValueRpcPromise({
          path: nativeFrameKey,
          value: {
            b: use,
            isNull: false,
          },
        })
      )
    },
    setWindowMaximized: isMaximized => {
      if (get().windowState.isMaximized === isMaximized) return
      set(s => {
        s.windowState.isMaximized = isMaximized
      })
    },
    updateWindowState: ws => {
      const old = get().windowState
      const next = {...old, ...ws}
      if (isEqual(old, next)) return
      set(s => {
        s.windowState = next
      })

      ignorePromise(
        T.RPCGen.configGuiSetValueRpcPromise({
          path: windowStateKey,
          value: {
            isNull: false,
            s: JSON.stringify(next),
          },
        })
      )
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
