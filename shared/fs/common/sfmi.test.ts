/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Constants from '@/constants/fs'
import {canEnableDriver, keepKextPermissionError} from './sfmi'

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
