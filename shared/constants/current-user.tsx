import type * as RPCTypes from './types/rpc-gen'
import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'

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

export const useCurrentUserState = createZustand(
  immerZustand<ZState>(set => {
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
      },
    }

    return {
      ...initialZState,
      dispatch,
    }
  })
)
