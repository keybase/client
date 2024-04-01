import * as React from 'react'
import * as Z from '@/util/zustand'
import * as C from '@/constants'
import * as T from './types'

const initialStore: T.Devices.State = {
  deviceMap: new Map(),
  isNew: new Set(),
}

interface State extends T.Devices.State {
  dispatch: {
    load: () => void
    clearBadges: () => void
    resetState: 'default'
    setBadges: (set: Set<string>) => void
  }
}

export const _useState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    clearBadges: () => {
      C.ignorePromise(T.RPCGen.deviceDismissDeviceChangeNotificationsRpcPromise())
    },
    load: () => {
      const f = async () => {
        const results = await T.RPCGen.deviceDeviceHistoryListRpcPromise(undefined, waitingKey)
        set(s => {
          C.updateImmerMap(
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
      C.ignorePromise(f())
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

export const waitingKey = 'devices:devicesPage'

export const useActiveDeviceCounts = () => {
  const ds = _useState(s => s.deviceMap)
  return [...ds.values()].reduce((c, v) => (!v.revokedAt ? c + 1 : c), 0)
}

export const useRevokedDeviceCounts = () => {
  const ds = _useState(s => s.deviceMap)
  return [...ds.values()].reduce((c, v) => (v.revokedAt ? c + 1 : c), 0)
}

// Icons are numbered 1-10, so this focuses on mapping
// Device -> [1, 10]
// We split devices by type and order them by creation time. Then, we use (index mod 10)
// as the background #
export const numBackgrounds = 10

export const useDeviceIconNumber = (deviceID: T.Devices.DeviceID) => {
  const devices = _useState(s => s.deviceMap)
  return (((devices.get(deviceID)?.deviceNumberOfType ?? 0) % numBackgrounds) + 1) as T.Devices.IconNumber
}

export const useNextDeviceIconNumber = () => {
  const dm = _useState(s => s.deviceMap)
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
