import type * as EngineGen from '@/constants/rpc'
import * as T from '@/constants/types'
import {getEngine} from '@/engine/require'
import logger from '@/logger'
import type {UnlockFolderDevice} from './store'

const rpcDevicesToUnlockFolderDevices = (devices: ReadonlyArray<T.RPCGen.Device>): Array<UnlockFolderDevice> =>
  devices.map(({name, type, deviceID}) => ({
    deviceID,
    name,
    type: T.Devices.stringToDeviceType(type),
  }))

export const handleUnlockFoldersEngineAction = (
  action:
    | EngineGen.ActionOf<'keybase.1.rekeyUI.delegateRekeyUI'>
    | EngineGen.ActionOf<'keybase.1.rekeyUI.refresh'>,
  open: (devices: ReadonlyArray<UnlockFolderDevice>) => void
) => {
  switch (action.type) {
    case 'keybase.1.rekeyUI.refresh': {
      const {problemSetDevices} = action.payload.params
      logger.info('Asked for rekey')
      open(rpcDevicesToUnlockFolderDevices(problemSetDevices.devices ?? []))
      break
    }
    case 'keybase.1.rekeyUI.delegateRekeyUI': {
      // We get this with sessionID == 0 if we call openDialog.
      const session = getEngine().createSession({
        dangling: true,
        incomingCallMap: {
          'keybase.1.rekeyUI.refresh': ({problemSetDevices}) => {
            open(rpcDevicesToUnlockFolderDevices(problemSetDevices.devices ?? []))
          },
          'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
        },
      })
      const {response} = action.payload
      response.result(session.id)
      break
    }
  }
}
