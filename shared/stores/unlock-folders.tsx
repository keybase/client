import * as EngineGen from '@/actions/engine-gen-gen'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {getEngine} from '@/engine/require'
import {useConfigState, type State as ConfigStore} from '@/stores/config'

type Store = T.Immutable<{
  devices: ConfigStore['unlockFoldersDevices']
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success'
}>

const initialStore: Store = {
  devices: [],
  phase: 'dead',
}

export interface State extends Store {
  dispatch: {
    onBackFromPaperKey: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    toPaperKeyInput: () => void
    replace: (devices: Store['devices']) => void
    resetState: 'default'
  }
}

// this store is only in play in the remote window, its launched by ConfigConstants.unlockFoldersDevices
export const useUnlockFoldersState = Z.createZustand<State>((set, _get) => {
  const dispatch: State['dispatch'] = {
    onBackFromPaperKey: () => {
      set(s => {
        s.phase = 'promptOtherDevice'
      })
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case EngineGen.keybase1RekeyUIRefresh: {
          const {problemSetDevices} = action.payload.params
          logger.info('Asked for rekey')
          useConfigState.getState().dispatch.openUnlockFolders(problemSetDevices.devices ?? [])
          break
        }
        case EngineGen.keybase1RekeyUIDelegateRekeyUI: {
          // we get this with sessionID == 0 if we call openDialog
          // Dangling, never gets closed
          const session = getEngine().createSession({
            dangling: true,
            incomingCallMap: {
              'keybase.1.rekeyUI.refresh': ({problemSetDevices}) => {
                useConfigState.getState().dispatch.openUnlockFolders(problemSetDevices.devices ?? [])
              },
              'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
            },
          })
          const {response} = action.payload
          response.result(session.id)
          break
        }
        default:
      }
    },
    replace: devices => {
      set(s => {
        s.devices = T.castDraft(devices)
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
