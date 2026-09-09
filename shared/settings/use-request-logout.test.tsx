/** @jest-environment jsdom */
/// <reference types="jest" />
// useRPC is exported as a re-export getter (non-configurable), so we mock the
// module to make it a plain configurable property that jest.spyOn can wrap.
jest.mock('@/constants', () => ({
  ...(jest.requireActual('@/constants') as object),
  useRPC: jest.fn(),
}))
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {settingsPasswordTab} from '@/constants/settings'
import {resetAllStores} from '@/util/zustand'
import {usePushState} from '@/stores/push'
import {installFakeNavigator, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {useRequestLogout} from './use-request-logout'

type MutableGlobals = {isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

type CanLogoutSubmit = (
  args: [undefined],
  resolve: (res: {canLogout: boolean; reason: string}) => void,
  reject: (error: Error) => void
) => void

const mockCanLogoutRPC = () => {
  const pending = new Array<(res: {canLogout: boolean; reason: string}) => void>()
  const submit = jest.fn(
    (_args: Parameters<CanLogoutSubmit>[0], resolve: Parameters<CanLogoutSubmit>[1]) => {
      pending.push(resolve)
    }
  )
  jest.spyOn(C, 'useRPC').mockImplementation((() => submit) as never)
  return {
    answer: (canLogout: boolean) => pending.shift()?.({canLogout, reason: ''}),
    submit,
  }
}

let nav: FakeNavigator

beforeEach(() => {
  nav = installFakeNavigator()
})

afterEach(() => {
  restoreNavigator()
  cleanup()
  jest.clearAllMocks()
  jest.restoreAllMocks()
  resetAllStores()
  g.isMobile = false
})

test('logs out after unregistering the push token when the service allows it', async () => {
  const rpc = mockCanLogoutRPC()
  const order = new Array<string>()
  const deleteTokenForLogout = jest.fn(async () => {
    order.push('deleteToken')
    await Promise.resolve()
  })
  usePushState.setState(s => ({...s, dispatch: {...s.dispatch, deleteTokenForLogout}}))
  const logoutRPC = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockImplementation(async () => {
    order.push('logout')
    await Promise.resolve()
    return undefined as never
  })

  const {result} = renderHook(() => useRequestLogout())

  act(() => {
    result.current()
  })
  act(() => {
    rpc.answer(true)
  })

  await waitFor(() => expect(logoutRPC).toHaveBeenCalledWith({force: false, keepSecrets: false}))
  // the API call needs the still-logged-in session, so the token has to go first
  expect(order).toEqual(['deleteToken', 'logout'])
  expect(nav.actions).toEqual([])
})

test('a failing logout rpc is swallowed', async () => {
  const rpc = mockCanLogoutRPC()
  const deleteTokenForLogout = jest.fn(async () => {
    await Promise.resolve()
  })
  usePushState.setState(s => ({...s, dispatch: {...s.dispatch, deleteTokenForLogout}}))
  const logoutRPC = jest
    .spyOn(T.RPCGen, 'loginLogoutRpcPromise')
    .mockRejectedValue(new Error('service down'))

  const {result} = renderHook(() => useRequestLogout())

  act(() => {
    result.current()
  })
  act(() => {
    rpc.answer(true)
  })

  await waitFor(() => expect(logoutRPC).toHaveBeenCalled())
  // failures are swallowed: nothing navigates and the caller never sees a rejection
  expect(nav.actions).toEqual([])
})

test('desktop routes to the password tab when the user cannot log out yet', () => {
  const rpc = mockCanLogoutRPC()
  const logoutRPC = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockResolvedValue(undefined as never)

  const {result} = renderHook(() => useRequestLogout())

  act(() => {
    result.current()
  })
  act(() => {
    rpc.answer(false)
  })

  expect(logoutRPC).not.toHaveBeenCalled()
  expect(nav.actions).toContainEqual(
    expect.objectContaining({payload: {name: Tabs.settingsTab}, type: 'JUMP_TO'})
  )
  expect(nav.pushes()).toContainEqual({name: settingsPasswordTab, params: {}})
})

test('mobile pushes the password tab without switching tabs', () => {
  g.isMobile = true
  const rpc = mockCanLogoutRPC()

  const {result} = renderHook(() => useRequestLogout())

  act(() => {
    result.current()
  })
  act(() => {
    rpc.answer(false)
  })

  expect(nav.types()).not.toContain('JUMP_TO')
  expect(nav.pushes()).toContainEqual({name: settingsPasswordTab, params: {}})
})
