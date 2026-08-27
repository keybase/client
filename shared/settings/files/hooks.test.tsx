/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {clientID as fsClientID} from '@/fs/common/client'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import useFiles, {allowedNotificationThresholds, defaultNotificationThreshold} from './hooks'

const makeSettings = (overrides: Partial<T.RPCGen.FSSettings> = {}) =>
  ({
    sfmiBannerDismissed: false,
    spaceAvailableNotificationThreshold: 0,
    syncOnCellular: false,
    ...overrides,
  }) as T.RPCGen.FSSettings

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('settings load on mount and clear the loading flag', async () => {
  const read = jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSettingsRpcPromise')
    .mockResolvedValue(
      makeSettings({spaceAvailableNotificationThreshold: 1024 ** 3, syncOnCellular: true}) as never
    )

  const {result} = renderHook(() => useFiles())

  expect(result.current.areSettingsLoading).toBe(true)
  await waitFor(() => expect(result.current.areSettingsLoading).toBe(false))
  expect(read).toHaveBeenCalledTimes(1)
  expect(result.current.spaceAvailableNotificationThreshold).toBe(1024 ** 3)
  expect(result.current.syncOnCellular).toBe(true)
})

test('a failed load still clears the loading flag', async () => {
  jest.spyOn(T.RPCGen, 'SimpleFSSimpleFSSettingsRpcPromise').mockRejectedValue(new Error('no service'))

  const {result} = renderHook(() => useFiles())

  await waitFor(() => expect(result.current.areSettingsLoading).toBe(false))
  expect(result.current.spaceAvailableNotificationThreshold).toBe(0)
})

test('enabling and disabling sync notifications write the expected thresholds', async () => {
  jest.spyOn(T.RPCGen, 'SimpleFSSimpleFSSettingsRpcPromise').mockResolvedValue(makeSettings() as never)
  const setThreshold = jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSetNotificationThresholdRpcPromise')
    .mockResolvedValue(undefined as never)

  const {result} = renderHook(() => useFiles())
  await waitFor(() => expect(result.current.areSettingsLoading).toBe(false))

  act(() => {
    result.current.onEnableSyncNotifications()
  })
  await waitFor(() =>
    expect(setThreshold).toHaveBeenCalledWith({threshold: defaultNotificationThreshold})
  )
  expect(defaultNotificationThreshold).toBe(allowedNotificationThresholds[0])

  act(() => {
    result.current.onDisableSyncNotifications()
  })
  await waitFor(() => expect(setThreshold).toHaveBeenLastCalledWith({threshold: 0}))
})

test('picking a threshold refreshes the settings from the service', async () => {
  const read = jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSettingsRpcPromise')
    .mockResolvedValue(makeSettings() as never)
  jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSetNotificationThresholdRpcPromise')
    .mockResolvedValue(undefined as never)

  const {result} = renderHook(() => useFiles())
  await waitFor(() => expect(result.current.areSettingsLoading).toBe(false))

  read.mockResolvedValue(makeSettings({spaceAvailableNotificationThreshold: 3 * 1024 ** 3}) as never)
  act(() => {
    result.current.setSpaceAvailableNotificationThreshold(3 * 1024 ** 3)
  })

  await waitFor(() => expect(result.current.spaceAvailableNotificationThreshold).toBe(3 * 1024 ** 3))
})

test('a failed threshold write leaves the old value in place', async () => {
  jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSettingsRpcPromise')
    .mockResolvedValue(makeSettings({spaceAvailableNotificationThreshold: 1024 ** 3}) as never)
  jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSetNotificationThresholdRpcPromise')
    .mockRejectedValue(new Error('nope'))

  const {result} = renderHook(() => useFiles())
  await waitFor(() => expect(result.current.areSettingsLoading).toBe(false))

  act(() => {
    result.current.setSpaceAvailableNotificationThreshold(0)
  })

  await waitFor(() => expect(result.current.areSettingsLoading).toBe(false))
  expect(result.current.spaceAvailableNotificationThreshold).toBe(1024 ** 3)
})

test('setSyncOnCellular writes through with a waiting key and reloads', async () => {
  const read = jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSettingsRpcPromise')
    .mockResolvedValue(makeSettings() as never)
  const setCellular = jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSetSyncOnCellularRpcPromise')
    .mockResolvedValue(undefined as never)

  const {result} = renderHook(() => useFiles())
  await waitFor(() => expect(result.current.areSettingsLoading).toBe(false))

  read.mockResolvedValue(makeSettings({syncOnCellular: true}) as never)
  act(() => {
    result.current.setSyncOnCellular(true)
  })

  await waitFor(() =>
    expect(setCellular).toHaveBeenCalledWith({syncOnCellular: true}, C.waitingKeyFSSetSyncOnCellular)
  )
  await waitFor(() => expect(result.current.syncOnCellular).toBe(true))
})

test('only our own settings subscription notifications trigger a reload', async () => {
  const read = jest
    .spyOn(T.RPCGen, 'SimpleFSSimpleFSSettingsRpcPromise')
    .mockResolvedValue(makeSettings() as never)

  const {result} = renderHook(() => useFiles())
  await waitFor(() => expect(result.current.areSettingsLoading).toBe(false))
  expect(read).toHaveBeenCalledTimes(1)

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {clientID: 'someone-else', topic: T.RPCGen.SubscriptionTopic.settings}},
      type: 'keybase.1.NotifyFS.FSSubscriptionNotify',
    } as never)
  })
  act(() => {
    notifyEngineActionListeners({
      payload: {params: {clientID: fsClientID, topic: T.RPCGen.SubscriptionTopic.favorites}},
      type: 'keybase.1.NotifyFS.FSSubscriptionNotify',
    } as never)
  })
  expect(read).toHaveBeenCalledTimes(1)

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {clientID: fsClientID, topic: T.RPCGen.SubscriptionTopic.settings}},
      type: 'keybase.1.NotifyFS.FSSubscriptionNotify',
    } as never)
  })
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
})
