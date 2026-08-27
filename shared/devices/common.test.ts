/// <reference types="jest" />
import type * as T from '@/constants/types'
import {rpcDeviceDetailToDevice} from './common'

const makeRPCDevice = (overrides: Partial<T.RPCGen.Device> = {}): T.RPCGen.Device => ({
  cTime: 0,
  deviceID: 'did',
  deviceNumberOfType: 0,
  encryptKey: '',
  lastUsedTime: 0,
  mTime: 0,
  name: 'device',
  status: 0,
  type: 'desktop',
  verifyKey: '',
  ...overrides,
})

const makeDetail = (overrides: Partial<T.RPCGen.DeviceDetail> = {}): T.RPCGen.DeviceDetail => ({
  currentDevice: false,
  device: makeRPCDevice(),
  eldest: false,
  provisionedAt: null,
  provisioner: null,
  revokedAt: null,
  revokedBy: '',
  revokedByDevice: null,
  ...overrides,
})

test('rpcDeviceDetailToDevice copies the device fields the UI needs', () => {
  expect(
    rpcDeviceDetailToDevice(
      makeDetail({
        currentDevice: true,
        device: makeRPCDevice({
          cTime: 1000,
          deviceID: 'device-1',
          deviceNumberOfType: 4,
          lastUsedTime: 2000,
          name: 'testuser-mac',
          type: 'desktop',
        }),
        provisionedAt: 3000,
        provisioner: makeRPCDevice({name: 'testuser-phone', type: 'mobile'}),
      })
    )
  ).toEqual({
    created: 1000,
    currentDevice: true,
    deviceID: 'device-1',
    deviceNumberOfType: 4,
    lastUsed: 2000,
    name: 'testuser-mac',
    provisionedAt: 3000,
    provisionerName: 'testuser-phone',
    revokedAt: undefined,
    revokedByName: undefined,
    type: 'desktop',
  })
})

test('rpcDeviceDetailToDevice normalizes falsy timestamps and missing devices to undefined', () => {
  const device = rpcDeviceDetailToDevice(makeDetail({provisionedAt: 0, revokedAt: 0}))
  expect(device.provisionedAt).toBeUndefined()
  expect(device.provisionerName).toBeUndefined()
  expect(device.revokedAt).toBeUndefined()
  expect(device.revokedByName).toBeUndefined()
})

test('rpcDeviceDetailToDevice surfaces the revoking device name', () => {
  const device = rpcDeviceDetailToDevice(
    makeDetail({
      revokedAt: 5000,
      revokedByDevice: makeRPCDevice({name: 'testuser-mac'}),
    })
  )
  expect(device.revokedAt).toBe(5000)
  expect(device.revokedByName).toBe('testuser-mac')
})

test('rpcDeviceDetailToDevice keeps known device types and defaults unknown ones to desktop', () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  expect(rpcDeviceDetailToDevice(makeDetail({device: makeRPCDevice({type: 'mobile'})})).type).toBe('mobile')
  expect(rpcDeviceDetailToDevice(makeDetail({device: makeRPCDevice({type: 'backup'})})).type).toBe('backup')
  expect(rpcDeviceDetailToDevice(makeDetail({device: makeRPCDevice({type: 'toaster'})})).type).toBe('desktop')
  expect(logSpy).toHaveBeenCalledTimes(1)
  logSpy.mockRestore()
})
