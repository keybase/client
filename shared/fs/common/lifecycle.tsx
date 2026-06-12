import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import {afterKbfsDaemonRpcStatusChangedMobile as afterKbfsDaemonRpcStatusChangedInPlatform} from '@/util/fs-platform'
import {clientID as fsClientID} from './client'

export const afterKbfsDaemonRpcStatusChanged = () => {
  ignorePromise(afterKbfsDaemonRpcStatusChangedInPlatform())
}

export const fsUserIn = (checkKbfsDaemonRpcStatus: () => void) => {
  ignorePromise(T.RPCGen.SimpleFSSimpleFSUserInRpcPromise({clientID: fsClientID}))
  checkKbfsDaemonRpcStatus()
}

export const fsUserOut = () => {
  ignorePromise(T.RPCGen.SimpleFSSimpleFSUserOutRpcPromise({clientID: fsClientID}))
}
