import type * as T from './types'
import * as Z from '@/util/zustand'

export type Store = T.Immutable<{
  deviceID: T.RPCGen.DeviceID
  deviceName: string
  uid: string
  username: string
}>

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

interface State extends Store {
  dispatch: {
    // ONLY used by remote windows
    replaceUsername: (u: string) => void
    setBootstrap: (b: Bootstrap) => void
    resetState: 'default'
  }
}

export const _useState = Z.createZustand<State>(set => {
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
