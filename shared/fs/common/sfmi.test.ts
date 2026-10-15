/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Constants from '@/constants/fs'
import {
  canEnableDriver,
  keepKextPermissionError,
  mountPollIntervalMs,
  mountPollLimit,
  refreshUntilMounted,
  runDriverOperation,
  withDriverOperation,
} from './sfmi'

const disabled = (overrides: Partial<T.FS.DriverStatusDisabled> = {}): T.FS.DriverStatusDisabled => ({
  ...Constants.emptyDriverStatusDisabled,
  ...overrides,
})
const kextError = disabled({kextPermissionError: true})

test('a kext error from enabling survives a refresh while macFUSE is still ready', () => {
  expect(keepKextPermissionError(kextError, disabled())).toEqual(kextError)
})

test('the kext error goes once KBFS mounts or macFUSE stops being ready', () => {
  expect(keepKextPermissionError(kextError, Constants.emptyDriverStatusEnabled)).toBe(
    Constants.emptyDriverStatusEnabled
  )
  const removed = disabled({macfuse: T.FS.MacfuseState.NotInstalled})
  expect(keepKextPermissionError(kextError, removed)).toBe(removed)
  const outdated = disabled({macfuse: T.FS.MacfuseState.Outdated, macfuseVersion: '4.8.0'})
  expect(keepKextPermissionError(kextError, outdated)).toBe(outdated)
})

test('no kext error appears without one before', () => {
  const ready = disabled()
  expect(keepKextPermissionError(ready, ready)).toBe(ready)
  expect(keepKextPermissionError(Constants.emptyDriverStatusEnabled, ready)).toBe(ready)
})

test('enabling needs macFUSE ready', () => {
  expect(canEnableDriver(disabled())).toBe(true)
  expect(canEnableDriver(kextError)).toBe(true)
  expect(canEnableDriver(disabled({macfuse: T.FS.MacfuseState.NotInstalled}))).toBe(false)
  expect(canEnableDriver(disabled({macfuse: T.FS.MacfuseState.Outdated}))).toBe(false)
  expect(canEnableDriver(disabled({macfuse: T.FS.MacfuseState.Error, macfuseError: 'x'}))).toBe(false)
  expect(canEnableDriver(Constants.emptyDriverStatusEnabled)).toBe(true)
})

test('a refresh during an operation keeps its in-flight flag', () => {
  expect(withDriverOperation(disabled(), 'enabling')).toEqual(disabled({isEnabling: true}))
  expect(withDriverOperation(Constants.emptyDriverStatusEnabled, 'disabling')).toEqual({
    ...Constants.emptyDriverStatusEnabled,
    isDisabling: true,
  })
})

test('the flag clears with no operation and never lands on the other state', () => {
  expect(withDriverOperation(disabled({isEnabling: true}), undefined)).toEqual(disabled())
  expect(
    withDriverOperation({...Constants.emptyDriverStatusEnabled, isDisabling: true}, undefined)
  ).toEqual(Constants.emptyDriverStatusEnabled)
  const ready = disabled()
  expect(withDriverOperation(ready, 'disabling')).toBe(ready)
  expect(withDriverOperation(Constants.emptyDriverStatusEnabled, 'enabling')).toBe(
    Constants.emptyDriverStatusEnabled
  )
  const unknown: T.FS.DriverStatus = {type: T.FS.DriverStatusType.Unknown}
  expect(withDriverOperation(unknown, 'enabling')).toBe(unknown)
})

const refreshSequence = (statuses: ReadonlyArray<T.FS.DriverStatus | undefined>) => {
  let call = 0
  return jest.fn(async () => Promise.resolve(statuses[Math.min(call++, statuses.length - 1)]))
}
const noWait = jest.fn(async (_ms: number) => Promise.resolve())

afterEach(() => {
  noWait.mockClear()
})

test('enabling keeps refreshing until the mount shows', async () => {
  const refresh = refreshSequence([disabled(), disabled(), Constants.emptyDriverStatusEnabled])
  await refreshUntilMounted(refresh, noWait)
  expect(refresh).toHaveBeenCalledTimes(3)
  expect(noWait).toHaveBeenCalledTimes(2)
  expect(noWait).toHaveBeenCalledWith(mountPollIntervalMs)
})

test('refreshing stops at the limit, on a failed refresh, or once macFUSE is not ready', async () => {
  const neverMounts = refreshSequence([disabled()])
  await refreshUntilMounted(neverMounts, noWait)
  expect(neverMounts).toHaveBeenCalledTimes(mountPollLimit + 1)

  const fails = refreshSequence([undefined])
  await refreshUntilMounted(fails, noWait)
  expect(fails).toHaveBeenCalledTimes(1)

  const removed = refreshSequence([disabled({macfuse: T.FS.MacfuseState.NotInstalled})])
  await refreshUntilMounted(removed, noWait)
  expect(removed).toHaveBeenCalledTimes(1)
})

test('a failed operation reports its error and still ends', async () => {
  const onError = jest.fn()
  const end = jest.fn()
  const error = new Error('boom')
  await runDriverOperation(async () => Promise.reject(error), onError, end)
  expect(onError).toHaveBeenCalledWith(error)
  expect(end).toHaveBeenCalledTimes(1)

  onError.mockClear()
  end.mockClear()
  await runDriverOperation(async () => Promise.resolve(), onError, end)
  expect(onError).not.toHaveBeenCalled()
  expect(end).toHaveBeenCalledTimes(1)
})
