/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Constants from '@/constants/fs'
import {
  canApplyStatus,
  canEnableDriver,
  disconnectedPollLimit,
  type DriverStatusRefresh,
  isSameAccount,
  isMountPending,
  keepKextPermissionError,
  mountPollIntervalMs,
  mountPollLimit,
  refreshUntilMounted,
  runDriverOperation,
  singleFlight,
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

const refreshSequence = (statuses: ReadonlyArray<DriverStatusRefresh>) => {
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

test('refreshing keeps going while KBFS restarts, and stops on a failure after it', async () => {
  const restarts = refreshSequence([disabled(), 'disconnected', 'disconnected', Constants.emptyDriverStatusEnabled])
  expect(await refreshUntilMounted(restarts, noWait)).toBe(Constants.emptyDriverStatusEnabled)
  expect(restarts).toHaveBeenCalledTimes(4)

  const failsAfter = refreshSequence(['disconnected', undefined, disabled()])
  expect(await refreshUntilMounted(failsAfter, noWait)).toBeUndefined()
  expect(failsAfter).toHaveBeenCalledTimes(2)

  const neverBack = refreshSequence(['disconnected'])
  expect(await refreshUntilMounted(neverBack, noWait)).toBe('disconnected')
  expect(neverBack).toHaveBeenCalledTimes(disconnectedPollLimit + 1)
})

test('time spent disconnected does not use up the wait for the mount', async () => {
  const restarting = Array<DriverStatusRefresh>(disconnectedPollLimit).fill('disconnected')
  const pending = Array<DriverStatusRefresh>(mountPollLimit).fill(disabled())
  const slow = refreshSequence([...restarting, ...pending, Constants.emptyDriverStatusEnabled])
  expect(await refreshUntilMounted(slow, noWait)).toBe(Constants.emptyDriverStatusEnabled)
  expect(slow).toHaveBeenCalledTimes(disconnectedPollLimit + mountPollLimit + 1)

  const neverMounts = refreshSequence([...restarting, disabled()])
  expect(isMountPending(await refreshUntilMounted(neverMounts, noWait))).toBe(true)
  expect(neverMounts).toHaveBeenCalledTimes(disconnectedPollLimit + mountPollLimit + 1)
})

test('a status applies only on the account and KBFS connection its refresh started on', () => {
  const session = {account: 1, connected: true, connection: 2}
  expect(canApplyStatus(session, {account: 1, connection: 2})).toBe(true)
  // started before a reconnect
  expect(canApplyStatus(session, {account: 1, connection: 1})).toBe(false)
  // started before an account switch
  expect(canApplyStatus(session, {account: 0, connection: 2})).toBe(false)
  // the service answers while KBFS is down too
  expect(canApplyStatus({...session, connected: false}, {account: 1, connection: 2})).toBe(false)
})

test('the rest of the work only needs the same account, so an enable across a KBFS restart still finishes', () => {
  const restarted = {account: 1, connected: true, connection: 4}
  expect(isSameAccount(restarted, 1)).toBe(true)
  expect(isSameAccount({...restarted, connected: false}, 1)).toBe(true)
  expect(isSameAccount({...restarted, account: 2}, 1)).toBe(false)
})

test('the mount is pending only while Disabled with macFUSE ready', () => {
  expect(isMountPending(disabled())).toBe(true)
  expect(isMountPending(Constants.emptyDriverStatusEnabled)).toBe(false)
  expect(isMountPending(undefined)).toBe(false)
  expect(isMountPending('disconnected')).toBe(false)
  expect(isMountPending({type: T.FS.DriverStatusType.Unknown})).toBe(false)
  expect(isMountPending(disabled({macfuse: T.FS.MacfuseState.Outdated}))).toBe(false)
})

const deferred = <R>() => {
  let resolve: (r: R) => void = () => {}
  let reject: (e: unknown) => void = () => {}
  const promise = new Promise<R>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return {promise, reject, resolve}
}

// a run whose answers the test hands out in order
const controlledRun = () => {
  const runs: Array<ReturnType<typeof deferred<number>>> = []
  const run = jest.fn(async () => {
    const d = deferred<number>()
    runs.push(d)
    return d.promise
  })
  return {run, runs}
}

const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

test('a call with nothing running starts one run and gets its result', async () => {
  const {run, runs} = controlledRun()
  const refresh = singleFlight(run)
  const first = refresh()
  expect(run).toHaveBeenCalledTimes(1)
  runs[0]?.resolve(1)
  expect(await first).toBe(1)
  const second = refresh()
  expect(run).toHaveBeenCalledTimes(2)
  runs[1]?.resolve(2)
  expect(await second).toBe(2)
})

test('calls during a run share exactly one more run, and everyone gets its result', async () => {
  const {run, runs} = controlledRun()
  const refresh = singleFlight(run)
  const first = refresh()
  const second = refresh()
  const third = refresh()
  expect(run).toHaveBeenCalledTimes(1)
  runs[0]?.resolve(1)
  await settle()
  expect(run).toHaveBeenCalledTimes(2)
  runs[1]?.resolve(2)
  expect(await Promise.all([first, second, third])).toEqual([2, 2, 2])
  expect(run).toHaveBeenCalledTimes(2)
})

test('a call during the rerun asks for another one', async () => {
  const {run, runs} = controlledRun()
  const refresh = singleFlight(run)
  const first = refresh()
  const second = refresh()
  runs[0]?.resolve(1)
  await settle()
  const late = refresh()
  runs[1]?.resolve(2)
  await settle()
  expect(run).toHaveBeenCalledTimes(3)
  runs[2]?.resolve(3)
  expect(await Promise.all([first, second, late])).toEqual([3, 3, 3])
})

test('a failed run rejects its callers, unless a call during it asked for a rerun', async () => {
  const {run, runs} = controlledRun()
  const refresh = singleFlight(run)
  const error = new Error('boom')
  const alone = refresh()
  runs[0]?.reject(error)
  await expect(alone).rejects.toBe(error)

  const first = refresh()
  const second = refresh()
  runs[1]?.reject(error)
  await settle()
  runs[2]?.resolve(2)
  expect(await first).toBe(2)
  expect(await second).toBe(2)

  const after = refresh()
  expect(run).toHaveBeenCalledTimes(4)
  runs[3]?.resolve(4)
  expect(await after).toBe(4)
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
