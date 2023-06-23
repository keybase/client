import type * as RPCTypes from './types/rpc-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Z from '../util/zustand'

export type ZStore = {
  deviceID: RPCTypes.DeviceID
  deviceName: string
  uid: string
  username: string
}

const initialZState: ZStore = {
  deviceID: '',
  deviceName: '',
  uid: '',
  username: '',
}

type Bootstrap = {
  deviceID: string
  deviceName: string
  uid: string
  username: string
}

type ZState = ZStore & {
  dispatch: {
    // ONLY used by remote windows
    replaceUsername: (u: string) => void
    setBootstrap: (b: Bootstrap) => void
  }
}

export const useCurrentUserState = Z.createZustand(
  Z.immerZustand<ZState>(set => {
    const reduxDispatch = Z.getReduxDispatch()
    const dispatch = {
      replaceUsername: (u: string) => {
        set(s => {
          s.username = u
        })
      },
      setBootstrap: (b: Bootstrap) => {
        set(s => {
          const {deviceID, deviceName, uid, username} = b
          s.deviceID = deviceID
          s.deviceName = deviceName
          s.uid = uid
          s.username = username
        })
        reduxDispatch(ConfigGen.createBootstrapStatusLoaded())
      },
    }

    return {
      ...initialZState,
      dispatch,
    }
  })
)
