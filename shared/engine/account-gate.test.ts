/// <reference types="jest" />
// Calls made while the app switches accounts wait for the switch to end, and calls that outlive an
// account never wait.
import * as T from '@/constants/types'
import {installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {settle} from '@/test/flush'

afterEach(() => {
  // The store reset keeps an in-progress switch, and a later test's switch would not start
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

const methodsSent = (fake: {calls: Array<{method: string}>}) => fake.calls.map(c => c.method)

describe('known bugs', () => {
  test.failing('K6: a call made mid-switch reaches the service only once the switch ends', async () => {
    const fake = installFakeEngine()
    fake.answer('keybase.1.user.loadMySettings', () => ({}))
    const {dispatch} = useConfigState.getState()
    dispatch.setLoggedIn(true)
    dispatch.setUserSwitching(true, 'testuser2')
    const p = T.RPCGen.userLoadMySettingsRpcPromise()
    await settle()
    expect(methodsSent(fake)).not.toContain('keybase.1.user.loadMySettings')
    dispatch.setUserSwitching(false)
    await expect(p).resolves.toEqual({})
    uninstallFakeEngine()
  })
})
