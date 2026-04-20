import * as T from '@/constants/types'
import * as Z from '@/util/zustand'

export type UnlockFolderDevice = T.Immutable<{
  type: T.Devices.DeviceType
  name: string
  deviceID: T.Devices.DeviceID
}>

type Store = T.Immutable<{
  devices: Array<UnlockFolderDevice>
  paperKeyError: string
}>

const initialStore: Store = {
  devices: [],
  paperKeyError: '',
}

export type State = Store & {
  dispatch: {
    close: () => void
    open: (devices: ReadonlyArray<T.RPCGen.Device>) => void
    resetState: () => void
    setPaperKeyError: (paperKeyError: string) => void
  }
}

export const useUnlockFoldersState = Z.createZustand<State>('unlock-folders', set => {
  const dispatch: State['dispatch'] = {
    close: () => {
      set(s => {
        s.devices = []
        s.paperKeyError = ''
      })
    },
    open: devices => {
      set(s => {
        s.devices = devices.map(({name, type, deviceID}) => ({
          deviceID,
          name,
          type: T.Devices.stringToDeviceType(type),
        }))
        s.paperKeyError = ''
      })
    },
    resetState: Z.defaultReset,
    setPaperKeyError: paperKeyError => {
      set(s => {
        s.paperKeyError = paperKeyError
      })
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
