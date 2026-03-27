/// <reference types="jest" />
import * as T from '../../constants/types'
import {resetAllStores} from '../../util/zustand'
import {useLogoutState} from '../logout'

describe('logout store', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('wait ignores version mismatches', () => {
    const store = useLogoutState
    store.getState().dispatch.wait('sync', 999, true)

    expect(store.getState().waiters.size).toBe(0)
  })

  test('wait tracks outstanding work and logs out when the last waiter finishes', async () => {
    const logoutSpy = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockResolvedValue(undefined)
    const store = useLogoutState
    const version = store.getState().version

    store.getState().dispatch.wait('sync', version, true)
    store.getState().dispatch.wait('sync', version, true)
    expect(store.getState().waiters.get('sync')).toBe(2)

    store.getState().dispatch.wait('sync', version, false)
    expect(store.getState().waiters.get('sync')).toBe(1)
    expect(logoutSpy).not.toHaveBeenCalled()

    store.getState().dispatch.wait('sync', version, false)
    await Promise.resolve()

    expect(store.getState().waiters.has('sync')).toBe(false)
    expect(logoutSpy).toHaveBeenCalledWith({force: false, keepSecrets: false})
  })

  test('start increments the handshake version', () => {
    const store = useLogoutState
    const version = store.getState().version

    store.getState().dispatch.start()

    expect(store.getState().version).toBe(version + 1)
  })
})
