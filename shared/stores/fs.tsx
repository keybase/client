import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {ensureError} from '@/util/errors'
import isObject from 'lodash/isObject'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Constants from '@/constants/fs'
import {makeUUID} from '@/util/uuid'
import {afterKbfsDaemonRpcStatusChangedMobile as afterKbfsDaemonRpcStatusChangedInPlatform} from './fs-platform'

export * from '@/constants/fs'

export {makeUUID} from '@/util/uuid'

export const clientID = makeUUID()

export const makeEditID = (): T.FS.EditID => T.FS.stringToEditID(makeUUID())

export const resetBannerTypeFromTlf = (tlf: T.FS.Tlf): T.FS.ResetBannerType => {
  const {resetParticipants} = tlf
  if (resetParticipants.length === 0) {
    return T.FS.ResetBannerNoOthersType.None
  }

  const you = useCurrentUserState.getState().username
  if (resetParticipants.findIndex(username => username === you) >= 0) {
    return T.FS.ResetBannerNoOthersType.Self
  }
  return resetParticipants.length
}

const noAccessErrorCodes: Array<T.RPCGen.StatusCode> = [
  T.RPCGen.StatusCode.scsimplefsnoaccess,
  T.RPCGen.StatusCode.scteamnotfound,
  T.RPCGen.StatusCode.scteamreaderror,
]

type ErrorHandlers = {
  checkKbfsDaemonRpcStatus: () => void
  redbar: (error: string) => void
  setPathSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
  setTlfSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
}

const noopSoftError: ErrorHandlers['setPathSoftError'] = () => {}
const redbarToGlobalError: ErrorHandlers['redbar'] = error => {
  useConfigState.getState().dispatch.setGlobalError(new Error(error))
}

export const errorToActionOrThrowWithHandlers = (
  {checkKbfsDaemonRpcStatus, redbar, setPathSoftError, setTlfSoftError}: ErrorHandlers,
  error: unknown,
  path?: T.FS.Path
) => {
  if (!isObject(error)) return
  const code = (error as {code?: T.RPCGen.StatusCode}).code
  if (code === T.RPCGen.StatusCode.sckbfsclienttimeout) {
    checkKbfsDaemonRpcStatus()
    return
  }
  if (code === T.RPCGen.StatusCode.scidentifiesfailed) {
    // This is specifically to address the situation where when user tries to
    // remove a shared TLF from their favorites but another user of the TLF has
    // deleted their account the subscribePath call cauused from the popup will
    // get SCIdentifiesFailed error. We can't do anything here so just move on.
    // (Ideally we'd be able to tell it's becaue the user was deleted, but we
    // don't have that from Go right now.)
    //
    // TODO: TRIAGE-2379 this should probably be ignored on Go side. We
    // already use fsGui identifyBehavior and there's no reason we should get
    // an identify error here.
    return undefined
  }
  if (path && code === T.RPCGen.StatusCode.scsimplefsnotexist) {
    setPathSoftError(path, T.FS.SoftError.Nonexistent)
    return
  }
  if (path && code && noAccessErrorCodes.includes(code)) {
    const tlfPath = Constants.getTlfPath(path)
    if (tlfPath) {
      setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
      return
    }
  }
  if (code === T.RPCGen.StatusCode.scdeleted) {
    // The user is deleted. Let user know and move on.
    redbar('A user in this shared folder has deleted their account.')
    return
  }
  throw ensureError(error)
}

export const errorToActionOrThrow = (error: unknown, path?: T.FS.Path) => {
  const {checkKbfsDaemonRpcStatus} = useFSState.getState().dispatch
  return errorToActionOrThrowWithHandlers(
    {
      checkKbfsDaemonRpcStatus,
      redbar: redbarToGlobalError,
      setPathSoftError: noopSoftError,
      setTlfSoftError: noopSoftError,
    },
    error,
    path
  )
}

type Store = T.Immutable<{
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
}>
const initialStore: Store = {
  kbfsDaemonStatus: Constants.unknownKbfsDaemonStatus,
}

export type State = Store & {
  dispatch: {
    afterKbfsDaemonRpcStatusChanged: () => void
    checkKbfsDaemonRpcStatus: () => void
    onlineStatusChanged: (onlineStatus: T.RPCGen.KbfsOnlineStatus) => void
    resetState: () => void
    userIn: () => void
    userOut: () => void
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

    // how this works isn't great. This function gets called way early before we set this
    get().dispatch.afterKbfsDaemonRpcStatusChanged()
  }

  const dispatch: State['dispatch'] = {
    afterKbfsDaemonRpcStatusChanged: () => {
      const f = async () => {
        await afterKbfsDaemonRpcStatusChangedInPlatform()
      }
      ignorePromise(f())
    },
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
    userIn: () => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSUserInRpcPromise({clientID})
      }
      ignorePromise(f())
      get().dispatch.checkKbfsDaemonRpcStatus()
    },
    userOut: () => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSUserOutRpcPromise({clientID})
      }
      ignorePromise(f())
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
