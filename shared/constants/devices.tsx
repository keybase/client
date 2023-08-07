import * as Z from '../util/zustand'
import * as RPCTypes from './types/rpc-gen'
import * as Types from './types/devices'
import {memoize} from '../util/memoize'

const initialStore: Types.State = {
  deviceMap: new Map(),
  isNew: new Set(),
}

type State = Types.State & {
  dispatch: {
    load: () => void
    clearBadges: () => void
    resetState: 'default'
    setBadges: (set: Set<string>) => void
    setupSubscriptions: () => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    clearBadges: () => {
      Z.ignorePromise(RPCTypes.deviceDismissDeviceChangeNotificationsRpcPromise())
    },
    load: () => {
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
      Z.ignorePromise(f())
    },
    resetState: 'default',
    setBadges: b => {
      set(s => {
        s.isNew = b
      })
    },
    setupSubscriptions: () => {
      const f = async () => {
        const ConfigConstants = await import('./config')
        ConfigConstants.useConfigState.subscribe((s, old) => {
          if (s.badgeState === old.badgeState) return
          if (!s.badgeState) return
          const {setBadges} = get().dispatch
          const {newDevices, revokedDevices} = s.badgeState
          setBadges(new Set([...(newDevices ?? []), ...(revokedDevices ?? [])]))
        })
      }
      Z.ignorePromise(f())
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})

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

export const emptyDevice: Types.Device = {
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
  const ds = useState(s => s.deviceMap)
  return [...ds.values()].reduce((c, v) => {
    if (!v.revokedAt) {
      ++c
    }
    return c
  }, 0)
}

export const useRevokedDeviceCounts = () => {
  const ds = useState(s => s.deviceMap)
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
  const devices = useState(s => s.deviceMap)
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
  const dm = useState(s => s.deviceMap)
  return getNextDeviceIconNumberInner(dm)
}
