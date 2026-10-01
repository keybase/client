import type * as EngineGen from '@/constants/rpc'
import * as T from '@/constants/types'
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
      // No session: Go stamps later rekey calls with this id, and a call with no matching session is
      // auto-answered by the engine and dispatched to the refresh listener, like a non-delegated one.
      action.payload.response.result(0)
      break
    }
  }
}
