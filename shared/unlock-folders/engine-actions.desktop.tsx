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
  action: EngineGen.ActionOf<'keybase.1.rekeyUI.refresh'>,
  open: (devices: ReadonlyArray<UnlockFolderDevice>) => void
) => {
  const {problemSetDevices} = action.payload.params
  logger.info('Asked for rekey')
  open(rpcDevicesToUnlockFolderDevices(problemSetDevices.devices ?? []))
}
