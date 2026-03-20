import * as EngineGen from '@/actions/engine-gen-gen'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useDevicesState} from '../devices'

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  resetAllStores()
})

test('load hydrates the device map from rpc history', async () => {
  jest.useFakeTimers()
  jest.spyOn(T.RPCGen as any, 'deviceDeviceHistoryListRpcPromise').mockResolvedValue([
    {
      currentDevice: true,
      device: {
        cTime: 1,
        deviceID: 'device-1',
        deviceNumberOfType: 2,
        lastUsedTime: 3,
        name: 'Desktop',
        type: 'desktop',
      },
      provisionedAt: 4,
    },
    {
      currentDevice: false,
      device: {
        cTime: 5,
        deviceID: 'device-2',
        deviceNumberOfType: 1,
        lastUsedTime: 6,
        name: 'Phone',
        type: 'mobile',
      },
      revokedAt: 7,
      revokedByDevice: {name: 'old phone'},
    },
  ])

  const store = useDevicesState
  store.getState().dispatch.load()
  jest.advanceTimersByTime(1000)
  await flush()

  expect(T.RPCGen.deviceDeviceHistoryListRpcPromise).toHaveBeenCalledWith(undefined, S.waitingKeyDevices)
  expect(store.getState().deviceMap.size).toBe(2)
  expect(store.getState().deviceMap.get(T.Devices.stringToDeviceID('device-1'))?.name).toBe('Desktop')
  expect(store.getState().deviceMap.get(T.Devices.stringToDeviceID('device-2'))?.revokedByName).toBe('old phone')
})

test('badge engine updates mark the affected devices as new', () => {
  const store = useDevicesState

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        badgeState: {
          newDevices: ['device-1'],
          revokedDevices: ['device-2'],
        },
      },
    },
    type: EngineGen.keybase1NotifyBadgesBadgeState,
  } as any)

  expect(store.getState().isNew).toEqual(new Set(['device-1', 'device-2']))
})
