import * as React from 'react'
import * as Z from '@/util/zustand'
import * as S from '@/constants/strings'
import {ignorePromise, updateImmerMap} from '@/constants/utils'
import * as T from '@/constants/types'
import * as EngineGen from '@/actions/engine-gen-gen'
import debounce from 'lodash/debounce'

const initialStore: T.Devices.State = {
  deviceMap: new Map(),
  isNew: new Set(),
}

export interface State extends T.Devices.State {
  dispatch: {
    load: () => void
    clearBadges: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: 'default'
    setBadges: (set: Set<string>) => void
  }
}

export const useDevicesState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    clearBadges: () => {
      ignorePromise(T.RPCGen.deviceDismissDeviceChangeNotificationsRpcPromise())
    },
    load: debounce(
      () => {
        const f = async () => {
          const results = await T.RPCGen.deviceDeviceHistoryListRpcPromise(undefined, S.waitingKeyDevices)
          set(s => {
            updateImmerMap(
              s.deviceMap,
              new Map(
                results?.map(r => {
                  const d = rpcDeviceToDevice(r)
                  return [d.deviceID, d]
                })
              )
            )
          })
        }
        ignorePromise(f())
      },
      1000,
      {leading: true, trailing: false}
    ),
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

export const useActiveDeviceCounts = () => {
  const ds = useDevicesState(s => s.deviceMap)
  return [...ds.values()].reduce((c, v) => (!v.revokedAt ? c + 1 : c), 0)
}

export const useRevokedDeviceCounts = () => {
  const ds = useDevicesState(s => s.deviceMap)
  return [...ds.values()].reduce((c, v) => (v.revokedAt ? c + 1 : c), 0)
}

// Icons are numbered 1-10, so this focuses on mapping
// Device -> [1, 10]
// We split devices by type and order them by creation time. Then, we use (index mod 10)
// as the background #
export const numBackgrounds = 10

export const useDeviceIconNumber = (deviceID: T.Devices.DeviceID) => {
  const devices = useDevicesState(s => s.deviceMap)
  return (((devices.get(deviceID)?.deviceNumberOfType ?? 0) % numBackgrounds) + 1) as T.Devices.IconNumber
}

export const useNextDeviceIconNumber = () => {
  const dm = useDevicesState(s => s.deviceMap)
  const next = React.useMemo(() => {
    // Find the max device number and add one (+ one more since these are 1-indexed)
    const result = {backup: 1, desktop: 1, mobile: 1}
    dm.forEach(device => {
      if (device.deviceNumberOfType >= result[device.type]) {
        result[device.type] = device.deviceNumberOfType + 1
      }
    })
    return {desktop: (result.desktop % numBackgrounds) + 1, mobile: (result.mobile % numBackgrounds) + 1}
  }, [dm])
  return next
}
