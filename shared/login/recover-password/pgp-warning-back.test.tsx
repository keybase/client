/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {fireEvent, render, screen} from '@testing-library/react'
import {flush} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {newModalRoutes} from '../routes'
import {setNamedScoped} from '@/stores/flow-handles'
import {startRecoverPassword} from './flow'

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    addListener: (_type: string, cb: () => void) => {
      mockBeforeRemove.push(cb)
      return () => {}
    },
    canGoBack: () => true,
    goBack: jest.fn(),
  }),
}))

const mockBeforeRemove: Array<() => void> = []

let nav: FakeNavigator

// Go asks only after the paper key has logged the user in, so the warning sits over the logged-in app.
beforeEach(() => {
  mockBeforeRemove.length = 0
  useConfigState.getState().dispatch.setLoggedIn(true)
  nav = installFakeNavigator({modalRouteNames: Object.keys(newModalRoutes), rootState: makeRootState()})
})

afterEach(() => {
  restoreNavigator()
  jest.restoreAllMocks()
  resetAllStores()
})

test('the pgp warning header back affordance answers the prompt false and leaves the flow', async () => {
  let listener: Parameters<typeof T.RPCGen.loginRecoverPassphraseRpcListener>[0] | undefined
  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async l => {
    listener = l
    await new Promise<void>(() => {})
    return undefined as any
  })
  startRecoverPassword({username: 'testuser'})
  await flush()
  const response = {error: jest.fn(), result: jest.fn()}
  listener?.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
    {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
    response as any
  )
  expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])

  const {getOptions} = newModalRoutes.recoverPasswordPgpWarning
  expect(getOptions.gestureEnabled).toBe(false)
  if (!('headerLeft' in getOptions)) throw new Error('expected the non-iOS headerLeft')
  const {container} = render(getOptions.headerLeft())
  const back = container.querySelector<HTMLElement>('.icon')
  expect(back).not.toBeNull()
  fireEvent.click(back!)

  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(false)
  expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn'])
})

describe('removing the pgp warning without a button press', () => {
  const setup = async () => {
    let listener: Parameters<typeof T.RPCGen.loginRecoverPassphraseRpcListener>[0] | undefined
    jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async l => {
      listener = l
      await new Promise<void>(() => {})
      return undefined as any
    })
    startRecoverPassword({username: 'testuser'})
    await flush()
    const response = {error: jest.fn(), result: jest.fn()}
    listener?.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
      {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
      response as any
    )
    const PgpWarning = (await import('./pgp-warning')).default
    render(<PgpWarning />)
    return response
  }

  test('answers false exactly once', async () => {
    const response = await setup()
    expect(mockBeforeRemove).toHaveLength(1)
    mockBeforeRemove[0]!()
    mockBeforeRemove[0]!()
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
  })

  test('removal after Continue answers nothing more', async () => {
    const response = await setup()
    fireEvent.click(screen.getByText('Continue'))
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(true)
    // The next prompt registers its own cancel slot before replacing the warning.
    const nextCancel = jest.fn()
    setNamedScoped('recoverPassword', 'cancel', nextCancel)
    mockBeforeRemove[0]!()
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(nextCancel).not.toHaveBeenCalled()
  })
})
