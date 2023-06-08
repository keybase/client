import * as Container from '../util/container'
import * as RPCTypes from './types/rpc-gen'
import * as Types from './types/devices'
import {memoize} from '../util/memoize'

const initialState: Types.State = {
  deviceMap: new Map(),
  isNew: new Set(),
}

type ZState = Types.State & {
  dispatchLoad: () => void
  dispatchClearBadges: () => void
  dispatchReset: () => void
  dispatchSetBadges: (set: Set<string>) => void
}

export const useDevicesState = Container.createZustand(
  Container.immerZustand<ZState>(set => {
    const dispatchLoad = () => {
      const f = async () => {
        const results = await RPCTypes.deviceDeviceHistoryListRpcPromise(undefined, waitingKey)
        set(s => {
          s.deviceMap = new Map(
            results?.map(r => {
              const d = rpcDeviceToDevice(r)
              return [d.deviceID, d]
            })
          )
        })
      }
      Container.ignorePromise(f())
    }

    const dispatchReset = () => {
      set(() => initialState)
    }

    const dispatchSetBadges = (b: Set<string>) => {
      set(s => {
        s.isNew = b
      })
    }

    const dispatchClearBadges = () => {
      Container.ignorePromise(RPCTypes.deviceDismissDeviceChangeNotificationsRpcPromise())
    }

    return {
      ...initialState,
      dispatchClearBadges,
      dispatchLoad,
      dispatchReset,
      dispatchSetBadges,
    }
  })
)

const rpcDeviceToDevice = (d: RPCTypes.DeviceDetail): Types.Device =>
  makeDevice({
    created: d.device.cTime,
    currentDevice: d.currentDevice,
    deviceID: Types.stringToDeviceID(d.device.deviceID),
    deviceNumberOfType: d.device.deviceNumberOfType,
    lastUsed: d.device.lastUsedTime,
    name: d.device.name,
    provisionedAt: d.provisionedAt || undefined,
    provisionerName: d.provisioner ? d.provisioner.name : undefined,
    revokedAt: d.revokedAt || undefined,
    revokedByName: d.revokedByDevice ? d.revokedByDevice.name : undefined,
    type: Types.stringToDeviceType(d.device.type),
  })

const emptyDevice: Types.Device = {
  created: 0,
  currentDevice: false,
  deviceID: Types.stringToDeviceID(''),
  deviceNumberOfType: 0,
  lastUsed: 0,
  name: '',
  type: Types.stringToDeviceType('desktop'),
}

const makeDevice = (d?: Partial<Types.Device>): Types.Device =>
  d ? Object.assign({...emptyDevice}, d) : emptyDevice

export const waitingKey = 'devices:devicesPage'

export const useActiveDeviceCounts = () => {
  const ds = useDevicesState(s => s.deviceMap)
  return [...ds.values()].reduce((c, v) => {
    if (!v.revokedAt) {
      ++c
    }
    return c
  }, 0)
}

export const useRevokedDeviceCounts = () => {
  const ds = useDevicesState(s => s.deviceMap)
  return [...ds.values()].reduce((c, v) => {
    if (v.revokedAt) {
      ++c
    }
    return c
  }, 0)
}

// Icons are numbered 1-10, so this focuses on mapping
// Device -> [1, 10]
// We split devices by type and order them by creation time. Then, we use (index mod 10)
// as the background #
export const numBackgrounds = 10

export const useDeviceIconNumber = (deviceID: Types.DeviceID) => {
  const devices = useDevicesState(s => s.deviceMap)
  return (((devices.get(deviceID)?.deviceNumberOfType ?? 0) % numBackgrounds) + 1) as Types.IconNumber
}

const getNextDeviceIconNumberInner = memoize((devices: Map<Types.DeviceID, Types.Device>) => {
  // Find the max device number and add one (+ one more since these are 1-indexed)
  const result = {backup: 1, desktop: 1, mobile: 1}
  devices.forEach(device => {
    if (device.deviceNumberOfType >= result[device.type]) {
      result[device.type] = device.deviceNumberOfType + 1
    }
  })
  return {desktop: (result.desktop % numBackgrounds) + 1, mobile: (result.mobile % numBackgrounds) + 1}
})
export const useNextDeviceIconNumber = () => {
  const dm = useDevicesState(s => s.deviceMap)
  return getNextDeviceIconNumberInner(dm)
}
