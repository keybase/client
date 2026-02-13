import * as React from 'react'
import * as Z from '@/util/zustand'
import * as S from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import * as EngineGen from '@/actions/engine-gen-gen'

const initialStore: T.Devices.State = {
  isNew: new Set(),
}

export interface State extends T.Devices.State {
  dispatch: {
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: 'default'
    setBadges: (set: Set<string>) => void
  }
}

export const useDevicesState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyBadgesBadgeState: {
          const {badgeState} = action.payload.params
          const {newDevices, revokedDevices} = badgeState
          get().dispatch.setBadges(new Set([...(newDevices ?? []), ...(revokedDevices ?? [])]))
          break
        }
        default:
      }
    },
    resetState: 'default',
    setBadges: b => {
      set(s => {
        s.isNew = b
      })
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})

const rpcDeviceToDevice = (d: T.RPCGen.DeviceDetail): T.Devices.Device =>
  makeDevice({
    created: d.device.cTime,
    currentDevice: d.currentDevice,
    deviceID: T.Devices.stringToDeviceID(d.device.deviceID),
    deviceNumberOfType: d.device.deviceNumberOfType,
    lastUsed: d.device.lastUsedTime,
    name: d.device.name,
    provisionedAt: d.provisionedAt || undefined,
    provisionerName: d.provisioner ? d.provisioner.name : undefined,
    revokedAt: d.revokedAt || undefined,
    revokedByName: d.revokedByDevice ? d.revokedByDevice.name : undefined,
    type: T.Devices.stringToDeviceType(d.device.type),
  })

export const emptyDevice: T.Devices.Device = {
  created: 0,
  currentDevice: false,
  deviceID: T.Devices.stringToDeviceID(''),
  deviceNumberOfType: 0,
  lastUsed: 0,
  name: '',
  type: T.Devices.stringToDeviceType('desktop'),
}

const makeDevice = (d?: Partial<T.Devices.Device>): T.Devices.Device =>
  d ? {...emptyDevice, ...d} : emptyDevice

// Icons are numbered 1-10, so this focuses on mapping
// Device -> [1, 10]
// We split devices by type and order them by creation time. Then, we use (index mod 10)
// as the background #
export const numBackgrounds = 10

export const loadDevices = async (): Promise<Map<T.Devices.DeviceID, T.Devices.Device>> => {
  const results = await T.RPCGen.deviceDeviceHistoryListRpcPromise(undefined, S.waitingKeyDevices)
  return new Map(
    results?.map(r => {
      const d = rpcDeviceToDevice(r)
      return [d.deviceID, d] as const
    })
  )
}

export const clearBadges = () => {
  ignorePromise(T.RPCGen.deviceDismissDeviceChangeNotificationsRpcPromise())
}

export const useLoadDevices = () => {
  const [deviceMap, setDeviceMap] = React.useState<Map<T.Devices.DeviceID, T.Devices.Device>>(new Map())
  React.useEffect(() => {
    const f = async () => {
      const map = await loadDevices()
      setDeviceMap(map)
    }
    ignorePromise(f())
  }, [])
  return deviceMap
}
