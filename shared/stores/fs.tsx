import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import * as Constants from '@/constants/fs'
import {afterKbfsDaemonRpcStatusChangedMobile as afterKbfsDaemonRpcStatusChangedInPlatform} from './fs-platform'

export * from '@/constants/fs'

type Store = T.Immutable<{
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
}>
const initialStore: Store = {
  kbfsDaemonStatus: Constants.unknownKbfsDaemonStatus,
}

export type State = Store & {
  dispatch: {
    checkKbfsDaemonRpcStatus: () => void
    onlineStatusChanged: (onlineStatus: T.RPCGen.KbfsOnlineStatus) => void
    resetState: () => void
  }
}

export const useFSState = Z.createZustand<State>('fs', (set, get) => {
  // Can't rely on kbfsDaemonStatus.rpcStatus === 'waiting' as that's set by
  // reducer and happens before this.
  let waitForKbfsDaemonInProgress = false

  let asyncGeneration = 0

  const shouldRunBackgroundFSRPC = () => {
    const {loggedIn, userSwitching} = useConfigState.getState()
    return loggedIn && !userSwitching
  }

  const isCurrentAsyncGeneration = (generation: number) =>
    generation === asyncGeneration && shouldRunBackgroundFSRPC()

  const kbfsDaemonOnlineStatusChanged = (onlineStatus: T.RPCGen.KbfsOnlineStatus) => {
    set(s => {
      switch (onlineStatus) {
        case T.RPCGen.KbfsOnlineStatus.offline:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
          break
        case T.RPCGen.KbfsOnlineStatus.trying:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Trying
          break
        case T.RPCGen.KbfsOnlineStatus.online:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Online
          break
        default:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Unknown
      }
    })
  }

  const waitForKbfsDaemon = () => {
    if (waitForKbfsDaemonInProgress || !shouldRunBackgroundFSRPC()) {
      return
    }
    waitForKbfsDaemonInProgress = true
    const generation = asyncGeneration
    set(s => {
      s.kbfsDaemonStatus.rpcStatus = T.FS.KbfsDaemonRpcStatus.Waiting
    })
    const f = async () => {
      try {
        await T.RPCGen.configWaitForClientRpcPromise({
          clientType: T.RPCGen.ClientType.kbfs,
          timeout: 60, // 1min. This is arbitrary since we're gonna check again anyway if we're not connected.
        })
      } catch {
      } finally {
        if (generation === asyncGeneration) {
          waitForKbfsDaemonInProgress = false
        }
      }
      if (!isCurrentAsyncGeneration(generation)) {
        return
      }
      get().dispatch.checkKbfsDaemonRpcStatus()
    }
    ignorePromise(f())
  }

  const kbfsDaemonRpcStatusChanged = (rpcStatus: T.FS.KbfsDaemonRpcStatus) => {
    set(s => {
      if (rpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected) {
        s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
      }
      s.kbfsDaemonStatus.rpcStatus = rpcStatus
    })

    const f = async () => {
      await afterKbfsDaemonRpcStatusChangedInPlatform()
    }
    ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    checkKbfsDaemonRpcStatus: () => {
      const f = async () => {
        if (!shouldRunBackgroundFSRPC()) {
          return
        }
        const generation = asyncGeneration
        const connected = await T.RPCGen.configWaitForClientRpcPromise({
          clientType: T.RPCGen.ClientType.kbfs,
          timeout: 0, // Don't wait; just check if it's there.
        })
        if (!isCurrentAsyncGeneration(generation)) {
          return
        }
        const newStatus = connected ? T.FS.KbfsDaemonRpcStatus.Connected : T.FS.KbfsDaemonRpcStatus.Waiting
        const kbfsDaemonStatus = get().kbfsDaemonStatus

        if (kbfsDaemonStatus.rpcStatus !== newStatus) {
          kbfsDaemonRpcStatusChanged(newStatus)
        }
        if (newStatus === T.FS.KbfsDaemonRpcStatus.Waiting) {
          waitForKbfsDaemon()
        }
      }
      ignorePromise(f())
    },
    onlineStatusChanged: kbfsDaemonOnlineStatusChanged,
    resetState: () => {
      asyncGeneration++
      waitForKbfsDaemonInProgress = false
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
      }))
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
