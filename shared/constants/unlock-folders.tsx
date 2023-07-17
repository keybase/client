import * as Z from '../util/zustand'
import type * as ConfigConstants from './config'

type Store = {
  devices: ConfigConstants.Store['unlockFoldersDevices']
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success'
}

const initialStore: Store = {
  devices: [],
  phase: 'dead',
}

export type State = Store & {
  dispatch: {
    onBackFromPaperKey: () => void
    toPaperKeyInput: () => void
    replace: (devices: Store['devices']) => void
    resetState: 'default'
  }
}

// this store is only in play in the remote window, its launched by ConfigConstants.unlockFoldersDevices
export const useState = Z.createZustand<State>((set, _get) => {
  const dispatch: State['dispatch'] = {
    onBackFromPaperKey: () => {
      set(s => {
        s.phase = 'promptOtherDevice'
      })
    },
    replace: devices => {
      set(s => {
        s.devices = devices
      })
    },
    resetState: 'default',
    toPaperKeyInput: () => {
      set(s => {
        s.phase = 'paperKeyInput'
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
