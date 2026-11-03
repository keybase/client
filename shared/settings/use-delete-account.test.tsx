/** @jest-environment jsdom */
/// <reference types="jest" />
const mockAndroidIsTestDevice = {value: false}
jest.mock('@/constants', () => ({
  ...jest.requireActual<object>('@/constants'),
  // a live getter so a test can flip the platform flag the hook reads
  get androidIsTestDevice() {
    return mockAndroidIsTestDevice.value
  },
}))
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as NavTree from '@/constants/nav-tree'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper, type NavigationRecorder} from '@/test/navigation'
import {useDeleteAccount} from './use-delete-account'

const deleteRpc = 'keybase.1.login.accountDelete'

// The delete flow runs from its confirmation modal, so the hook renders as that route.
let nav: NavigationRecorder
const renderDelete = () => {
  const {wrapper, ...recorder} = navigationWrapper({route: 'deleteConfirm'})
  nav = recorder
  return renderHook(() => useDeleteAccount(), {wrapper})
}

const stillOnConfirm = () => {
  expect(nav.actions).toEqual([])
  expect(NavTree.modalStack(nav.getRootState()).map(r => r.name)).toEqual(['deleteConfirm'])
}

afterEach(() => {
  cleanup()
  mockAndroidIsTestDevice.value = false
  jest.restoreAllMocks()
  resetAllStores()
})

test('refuses to delete when there is no logged in user', async () => {
  const fake = installFakeEngine()
  const {result} = renderDelete()

  expect(() => result.current('hunter2')).toThrow('Unable to delete account: no username set')
  await flush()
  expect(fake.calls).toEqual([])
})

test('deletes forever once the service answers, records the deleted self and clears the modal', async () => {
  useCurrentUserState.setState({username: 'testuser'})
  const fake = installFakeEngine()
  const held = fake.hold(deleteRpc)

  const {result} = renderDelete()

  act(() => {
    result.current('hunter2')
  })
  await flush()

  expect(held.map(h => h.params as unknown)).toEqual([expect.objectContaining({passphrase: 'hunter2'})])
  // nothing moves while the service is still deleting
  expect(useConfigState.getState().justDeletedSelf).toBe('')
  stillOnConfirm()

  held[0]!.reply(null)
  await flush()

  expect(useConfigState.getState().justDeletedSelf).toBe('testuser')
  // the confirmation modal is cleared away, leaving only the tab navigator
  expect(NavTree.modalStack(nav.getRootState())).toEqual([])
  expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn'])
  expect(nav.pushes()).toEqual([])
})

test('passes no passphrase through for accounts without one', async () => {
  useCurrentUserState.setState({username: 'testuser'})
  const fake = installFakeEngine()
  const held = fake.hold(deleteRpc)

  const {result} = renderDelete()

  act(() => {
    result.current()
  })
  await flush()

  // undefined crosses the wire as null
  expect(held[0]!.params).toEqual(expect.objectContaining({passphrase: null}))
  held[0]!.reply(null)
  await flush()
})

test('pre-launch test devices never reach the delete rpc', async () => {
  // android pre-launch reports drive the whole app; deleting the account they
  // run under would be catastrophic
  useCurrentUserState.setState({username: 'testuser'})
  mockAndroidIsTestDevice.value = true
  const fake = installFakeEngine()

  const {result} = renderDelete()

  act(() => {
    result.current('hunter2')
  })
  await flush()

  expect(fake.calls).toEqual([])
  stillOnConfirm()
})

test('logs and stays put when the delete rpc fails', async () => {
  useCurrentUserState.setState({username: 'testuser'})
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const fake = installFakeEngine()
  fake.answer(deleteRpc, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))

  const {result} = renderDelete()

  act(() => {
    result.current('hunter2')
  })
  await flush()

  expect(warnSpy).toHaveBeenCalledWith(
    'Error deleting account',
    expect.objectContaining({code: T.RPCGen.StatusCode.scgeneric})
  )
  expect(useConfigState.getState().justDeletedSelf).toBe('')
  stillOnConfirm()
})
