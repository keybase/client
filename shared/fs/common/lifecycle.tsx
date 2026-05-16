import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import {afterKbfsDaemonRpcStatusChangedMobile as afterKbfsDaemonRpcStatusChangedInPlatform} from '@/stores/fs-platform'
import {clientID as fsClientID} from '@/fs/common/client'

export const afterKbfsDaemonRpcStatusChanged = () => {
  const f = async () => {
    await afterKbfsDaemonRpcStatusChangedInPlatform()
  }
  ignorePromise(f())
}

export const fsUserIn = (checkKbfsDaemonRpcStatus: () => void) => {
  const f = async () => {
    await T.RPCGen.SimpleFSSimpleFSUserInRpcPromise({clientID: fsClientID})
  }
  ignorePromise(f())
  checkKbfsDaemonRpcStatus()
}

export const fsUserOut = () => {
  const f = async () => {
    await T.RPCGen.SimpleFSSimpleFSUserOutRpcPromise({clientID: fsClientID})
  }
  ignorePromise(f())
}
