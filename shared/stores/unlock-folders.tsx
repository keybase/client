import type * as EngineGen from '@/constants/rpc'
import logger from '@/logger'
import {getEngine} from '@/engine/require'
import {useUnlockFoldersState} from '@/unlock-folders/store'

export const onUnlockFoldersEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case 'keybase.1.rekeyUI.refresh': {
      const {problemSetDevices} = action.payload.params
      logger.info('Asked for rekey')
      useUnlockFoldersState.getState().dispatch.open(problemSetDevices.devices ?? [])
      break
    }
    case 'keybase.1.rekeyUI.delegateRekeyUI': {
      // We get this with sessionID == 0 if we call openDialog.
      const session = getEngine().createSession({
        dangling: true,
        incomingCallMap: {
          'keybase.1.rekeyUI.refresh': ({problemSetDevices}) => {
            useUnlockFoldersState.getState().dispatch.open(problemSetDevices.devices ?? [])
          },
          'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
        },
      })
      const {response} = action.payload
      response.result(session.id)
      break
    }
    default:
      break
  }
}
