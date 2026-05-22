import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as React from 'react'
import * as RouterConstants from '@/constants/router'
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import {useRouterState} from '@/stores/router'
import {afterKbfsDaemonRpcStatusChanged, fsUserIn, fsUserOut} from './lifecycle'

type FsDaemonActions = {
  checkKbfsDaemonRpcStatus: () => void
  onlineStatusChanged: (onlineStatus: T.RPCGen.KbfsOnlineStatus) => void
}

const fsRouteNames: ReadonlyArray<string> = ['fsRoot', 'fsFilePreview']

const emptyFsDaemonActions: FsDaemonActions = {
  checkKbfsDaemonRpcStatus: () => {},
  onlineStatusChanged: () => {},
}

const FsDaemonStatusContext = React.createContext<T.FS.KbfsDaemonStatus | undefined>(undefined)
const FsDaemonActionsContext = React.createContext<FsDaemonActions | undefined>(undefined)

export const FsDaemonProvider = ({children}: {children: React.ReactNode}) => {
  const loggedIn = useConfigState(s => s.loggedIn)
  const userSwitching = useConfigState(s => s.userSwitching)
  const installerRanCount = useConfigState(s => s.installerRanCount)
  const navState = useRouterState(s => s.navState as RouterConstants.NavState | undefined)
  const [kbfsDaemonStatus, setKbfsDaemonStatus] = React.useState<T.FS.KbfsDaemonStatus>(
    Constants.unknownKbfsDaemonStatus
  )
  const kbfsDaemonStatusRef = React.useRef(kbfsDaemonStatus)
  const previousNavStateRef = React.useRef(navState)
  const waitForKbfsDaemonInProgressRef = React.useRef(false)
  const asyncGenerationRef = React.useRef(0)
  const shouldRunBackgroundFSRPC = loggedIn && !userSwitching

  React.useEffect(() => {
    kbfsDaemonStatusRef.current = kbfsDaemonStatus
  }, [kbfsDaemonStatus])

  const isCurrentAsyncGeneration = React.useEffectEvent(
    (generation: number) => generation === asyncGenerationRef.current && loggedIn && !userSwitching
  )

  const kbfsDaemonRpcStatusChanged = React.useEffectEvent((rpcStatus: T.FS.KbfsDaemonRpcStatus) => {
    setKbfsDaemonStatus(s => {
      const nextStatus = C.produce(s, draft => {
        if (rpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected) {
          draft.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
        }
        draft.rpcStatus = rpcStatus
      })
      kbfsDaemonStatusRef.current = nextStatus
      return nextStatus
    })
    afterKbfsDaemonRpcStatusChanged()
  })

  const checkKbfsDaemonRpcStatus = React.useEffectEvent(() => {
    if (waitForKbfsDaemonInProgressRef.current || !loggedIn || userSwitching) {
      return
    }
    const generation = asyncGenerationRef.current
    const f = async () => {
      while (isCurrentAsyncGeneration(generation)) {
        try {
          const connected = await T.RPCGen.configWaitForClientRpcPromise({
            clientType: T.RPCGen.ClientType.kbfs,
            timeout: 0, // Don't wait; just check if it's there.
          })
          if (!isCurrentAsyncGeneration(generation)) {
            return
          }
          const newStatus = connected ? T.FS.KbfsDaemonRpcStatus.Connected : T.FS.KbfsDaemonRpcStatus.Waiting
          if (kbfsDaemonStatusRef.current.rpcStatus !== newStatus) {
            kbfsDaemonRpcStatusChanged(newStatus)
          }
          if (newStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
            return
          }
          waitForKbfsDaemonInProgressRef.current = true
          try {
            await T.RPCGen.configWaitForClientRpcPromise({
              clientType: T.RPCGen.ClientType.kbfs,
              timeout: 60, // 1min. This is arbitrary since we're gonna check again anyway if we're not connected.
            })
          } catch {
          } finally {
            if (generation === asyncGenerationRef.current) {
              waitForKbfsDaemonInProgressRef.current = false
            }
          }
        } catch {
          return
        }
      }
    }
    C.ignorePromise(f())
  })

  const onlineStatusChanged = React.useEffectEvent((onlineStatus: T.RPCGen.KbfsOnlineStatus) => {
    setKbfsDaemonStatus(s => {
      const nextStatus = C.produce(s, draft => {
        switch (onlineStatus) {
          case T.RPCGen.KbfsOnlineStatus.offline:
            draft.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
            break
          case T.RPCGen.KbfsOnlineStatus.trying:
            draft.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Trying
            break
          case T.RPCGen.KbfsOnlineStatus.online:
            draft.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Online
            break
          default:
            draft.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Unknown
        }
      })
      kbfsDaemonStatusRef.current = nextStatus
      return nextStatus
    })
  })

  const [actions] = React.useState<FsDaemonActions>(() => ({
    checkKbfsDaemonRpcStatus: () => checkKbfsDaemonRpcStatus(),
    onlineStatusChanged: onlineStatus => onlineStatusChanged(onlineStatus),
  }))

  React.useEffect(() => {
    if (!shouldRunBackgroundFSRPC) {
      asyncGenerationRef.current++
      waitForKbfsDaemonInProgressRef.current = false
      kbfsDaemonStatusRef.current = Constants.unknownKbfsDaemonStatus
      setKbfsDaemonStatus(Constants.unknownKbfsDaemonStatus)
      return
    }
    checkKbfsDaemonRpcStatus()
  }, [installerRanCount, shouldRunBackgroundFSRPC])

  React.useEffect(() => {
    const previousNavState = previousNavStateRef.current
    previousNavStateRef.current = navState
    if (previousNavState === navState) {
      return
    }

    const wasScreen = fsRouteNames.includes(RouterConstants.getVisibleScreen(previousNavState)?.name ?? '')
    const isScreen = fsRouteNames.includes(RouterConstants.getVisibleScreen(navState)?.name ?? '')
    if (wasScreen === isScreen) {
      return
    }
    if (wasScreen) {
      fsUserOut()
    } else {
      fsUserIn(checkKbfsDaemonRpcStatus)
    }
  }, [navState])

  const visibleKbfsDaemonStatus = shouldRunBackgroundFSRPC
    ? kbfsDaemonStatus
    : Constants.unknownKbfsDaemonStatus

  return (
    <FsDaemonStatusContext.Provider value={visibleKbfsDaemonStatus}>
      <FsDaemonActionsContext.Provider value={actions}>{children}</FsDaemonActionsContext.Provider>
    </FsDaemonStatusContext.Provider>
  )
}

export const useKbfsDaemonStatus = () =>
  React.useContext(FsDaemonStatusContext) ?? Constants.unknownKbfsDaemonStatus

export const useFsDaemonActions = () => React.useContext(FsDaemonActionsContext) ?? emptyFsDaemonActions
