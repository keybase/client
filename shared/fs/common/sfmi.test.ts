/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Constants from '@/constants/fs'
import {
  applyDriverStatusRefresh,
  canEnableDriver,
  isMountPending,
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
  const last = await refreshUntilMounted(neverMounts, noWait)
  expect(neverMounts).toHaveBeenCalledTimes(mountPollLimit + 1)
  expect(isMountPending(last)).toBe(true)

  const fails = refreshSequence([undefined])
  const failed = await refreshUntilMounted(fails, noWait)
  expect(fails).toHaveBeenCalledTimes(1)
  expect(isMountPending(failed)).toBe(false)

  const removedStatus = disabled({macfuse: T.FS.MacfuseState.NotInstalled})
  const removed = refreshSequence([removedStatus])
  expect(await refreshUntilMounted(removed, noWait)).toBe(removedStatus)
  expect(removed).toHaveBeenCalledTimes(1)
  expect(isMountPending(removedStatus)).toBe(false)
})

test('the mount is pending only while Disabled with macFUSE ready', () => {
  expect(isMountPending(disabled())).toBe(true)
  expect(isMountPending(Constants.emptyDriverStatusEnabled)).toBe(false)
  expect(isMountPending(undefined)).toBe(false)
  expect(isMountPending({type: T.FS.DriverStatusType.Unknown})).toBe(false)
  expect(isMountPending(disabled({macfuse: T.FS.MacfuseState.Outdated}))).toBe(false)
})

test('a refresh response older than the newest applied one is dropped', () => {
  const unknown = {driverStatus: {type: T.FS.DriverStatusType.Unknown} as const, refreshId: 0}
  // refresh 1 and 2 overlap; 2 answers Enabled first, then 1's Disabled arrives
  const first = applyDriverStatusRefresh(unknown, 2, Constants.emptyDriverStatusEnabled)
  expect(first.isCurrent).toBe(true)
  const late = applyDriverStatusRefresh(first.applied, 1, disabled())
  expect(late).toEqual({applied: first.applied, becameEnabled: false, isCurrent: false})
  expect(late.applied.driverStatus).toBe(Constants.emptyDriverStatusEnabled)
  // a refresh started at the same id as the applied one is from before a reset
  expect(applyDriverStatusRefresh(first.applied, 2, disabled()).isCurrent).toBe(false)
})

test('Disabled to Enabled is reported once, and not from Unknown', () => {
  const fromUnknown = applyDriverStatusRefresh(
    {driverStatus: {type: T.FS.DriverStatusType.Unknown}, refreshId: 0},
    1,
    Constants.emptyDriverStatusEnabled
  )
  expect(fromUnknown.becameEnabled).toBe(false)

  const off = applyDriverStatusRefresh(fromUnknown.applied, 2, disabled())
  expect(off.becameEnabled).toBe(false)
  const on = applyDriverStatusRefresh(off.applied, 3, Constants.emptyDriverStatusEnabled)
  expect(on.becameEnabled).toBe(true)
  expect(on.applied).toEqual({driverStatus: Constants.emptyDriverStatusEnabled, refreshId: 3})
  expect(applyDriverStatusRefresh(on.applied, 4, Constants.emptyDriverStatusEnabled).becameEnabled).toBe(false)
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
