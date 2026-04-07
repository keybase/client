/// <reference types="jest" />
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {
  badDeviceChars,
  badDeviceRE,
  cleanDeviceName,
  goodDeviceRE,
  normalizeDeviceRE,
  useProvisionState,
} from '../provision'

beforeEach(() => {
  resetAllStores()
})

afterEach(() => {
  resetAllStores()
})

test('device name helpers sanitize punctuation and match the expected validation regexes', () => {
  expect(cleanDeviceName("Chris’s Phone")).toBe("Chris's Phone")
  expect("Chris's Phone".match(badDeviceChars)).toBeNull()
  expect(goodDeviceRE.test("Chris's Phone")).toBe(true)
  expect(badDeviceRE.test('bad-name-')).toBe(true)
  expect('Phone 2'.replace(normalizeDeviceRE, '')).toBe('Phone2')
})

test('startProvision increments the trigger and stores the username', () => {
  expect(useProvisionState.getState().startProvisionTrigger).toBe(0)

  useProvisionState.getState().dispatch.startProvision('alice')

  const state = useProvisionState.getState()
  expect(state.startProvisionTrigger).toBe(1)
  expect(state.username).toBe('alice')
})

test('restartProvisioning bails early when there is no username after canceling the current flow', () => {
  const cancel = jest.fn()
  useProvisionState.setState(s => ({
    ...s,
    dispatch: {
      ...s.dispatch,
      dynamic: {
        ...s.dispatch.dynamic,
        cancel,
      },
    },
  }))

  useProvisionState.getState().dispatch.restartProvisioning()

  expect(cancel).toHaveBeenCalledTimes(1)
  expect(useProvisionState.getState().startProvisionTrigger).toBe(0)
})

test('resetState preserves inline errors while clearing form state', () => {
  const cancel = jest.fn()
  const inlineError = new RPCError('inline error', 2)

  useProvisionState.setState(s => ({
    ...s,
    autoSubmit: [{type: 'username'}],
    deviceName: 'My Phone',
    dispatch: {
      ...s.dispatch,
      dynamic: {
        ...s.dispatch.dynamic,
        cancel,
      },
    },
    inlineError,
    passphrase: 'hunter2',
    username: 'alice',
  }))

  useProvisionState.getState().dispatch.resetState()

  const state = useProvisionState.getState()
  expect(cancel).toHaveBeenCalledWith(true)
  expect(state.autoSubmit).toEqual([])
  expect(state.deviceName).toBe('')
  expect(state.passphrase).toBe('')
  expect(state.username).toBe('')
  expect(state.inlineError).toBe(inlineError)
})
