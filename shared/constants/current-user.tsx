import type * as RPCTypes from './types/rpc-gen'
import * as Z from '../util/zustand'

export type Store = {
  deviceID: RPCTypes.DeviceID
  deviceName: string
  uid: string
  username: string
}

const initialStore: Store = {
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

type State = Store & {
  dispatch: {
    // ONLY used by remote windows
    replaceUsername: (u: string) => void
    setBootstrap: (b: Bootstrap) => void
    resetState: 'default'
  }
}

export const useCurrentUserState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    replaceUsername: u => {
      set(s => {
        s.username = u
      })
    },
    resetState: 'default',
    setBootstrap: b => {
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
    ...initialStore,
    dispatch,
  }
})
