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
    open: (devices: ReadonlyArray<UnlockFolderDevice>) => void
    resetState: () => void
    setPaperKeyError: (paperKeyError: string) => void
  }
}

export const useUnlockFoldersState = Z.createZustand<State>('unlock-folders', (set, get) => {
  const dispatch: State['dispatch'] = {
    close: () => get().dispatch.resetState(),
    open: devices => {
      set(s => {
        s.devices = [...devices]
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
