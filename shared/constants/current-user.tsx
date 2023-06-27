import type * as RPCTypes from './types/rpc-gen'
import * as ConfigGen from '../actions/config-gen'
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
    resetState: () => void
  }
}

export const useCurrentUserState = Z.createZustand<State>(set => {
  const reduxDispatch = Z.getReduxDispatch()
  const dispatch = {
    replaceUsername: (u: string) => {
      set(s => {
        s.username = u
      })
    },
    resetState: () => {
      set(s => ({...s, ...initialStore}))
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
    ...initialStore,
    dispatch,
  }
})
