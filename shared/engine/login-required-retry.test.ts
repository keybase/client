/// <reference types="jest" />
// A call the service fails as login-required just after a login, while its session is still being
// set up, is tried again a bounded number of times while the app is logged in as the same user.
import * as T from '@/constants/types'
import {fakeError, installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'

afterEach(() => {
  jest.useRealTimers()
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

const loginRequired = () => fakeError(T.RPCGen.StatusCode.scloginrequired, 'login required')

describe('known bugs', () => {
  test.failing('a login-required failure while logged in is tried again', async () => {
    jest.useFakeTimers({doNotFake: ['queueMicrotask']})
    const fake = installFakeEngine()
    let attempts = 0
    fake.answer('keybase.1.user.loadMySettings', () => (++attempts === 1 ? loginRequired() : {}))
    useConfigState.getState().dispatch.setLoggedIn(true)
    const p = T.RPCGen.userLoadMySettingsRpcPromise()
    const result = p.then(
      r => ({r}),
      (e: unknown) => ({e})
    )
    await jest.advanceTimersByTimeAsync(250)
    expect(await result).toEqual({r: {}})
    uninstallFakeEngine()
  })
})
