/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import '@/test/viewport.desktop'
import {cleanup, render, renderHook, screen} from '@testing-library/react'
import {_onEngineIncoming} from '@/constants/init/shared'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {useRpcData} from '@/query'
import {resetAllStores} from '@/util/zustand'
import DeviceRevoke from './device-revoke'

const historyList = 'keybase.1.device.deviceHistoryList'

const detail = (name: string): T.RPCGen.DeviceDetail =>
  ({
    currentDevice: false,
    device: {
      cTime: 0,
      deviceID: `id-${name}`,
      deviceNumberOfType: 1,
      encryptKey: '',
      lastUsedTime: 0,
      mTime: 0,
      name,
      status: 0,
      type: 'desktop',
      verifyKey: '',
    },
    eldest: false,
    provisionedAt: null,
    provisioner: null,
    revokedAt: null,
    revokedBy: '',
    revokedByDevice: null,
  }) as T.RPCGen.DeviceDetail

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('a list load that failed before the screen opened does not close it as missing', async () => {
  const fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
  const failed = fake.hold(historyList)
  // another screen's load of the list fails, and that screen goes away
  const earlier = renderHook(() => useRpcData(T.RPCGen.deviceDeviceHistoryListRpcPromise, undefined))
  await flush()
  failed[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
  await flush()
  expect(earlier.result.current.error).toBeDefined()
  earlier.unmount()

  // opened by id alone, as a link does
  const deviceID = T.Devices.stringToDeviceID('id-testuser-phone')
  fake.answer(historyList, () => [detail('testuser-phone')])
  const nav = navigationWrapper({params: {deviceID}, route: 'deviceRevoke'})
  render(<DeviceRevoke deviceID={deviceID} />, {wrapper: nav.wrapper})
  await flush()
  expect(nav.types()).not.toContain('GO_BACK')
  expect(nav.types()).not.toContain('POP')

  // the device list changes while the failure backoff holds the mount's own load
  await fake.push('keybase.1.NotifyDeviceHistory.deviceHistoryChanged', {}, {oneway: true})
  await flush()
  expect(screen.queryAllByText('testuser-phone').length).toBeGreaterThan(0)
  expect(nav.types()).not.toContain('GO_BACK')
  expect(nav.types()).not.toContain('POP')
})
