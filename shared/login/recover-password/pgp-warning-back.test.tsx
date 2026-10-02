/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {flush} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {newModalRoutes} from '../routes'
import {startRecoverPassword} from './flow'
import PgpWarning from './pgp-warning'

type BeforeRemove = (e: {data: {action: {type: string}}}) => void

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    addListener: (type: string, cb: BeforeRemove) => {
      if (type === 'beforeRemove') {
        mockBeforeRemove.current = cb
      }
      return () => {}
    },
    canGoBack: () => true,
  }),
}))

const mockBeforeRemove: {current?: BeforeRemove} = {}

let nav: FakeNavigator

// Go asks only after the paper key has logged the user in, so the warning sits over the logged-in app.
beforeEach(() => {
  mockBeforeRemove.current = undefined
  useConfigState.getState().dispatch.setLoggedIn(true)
  nav = installFakeNavigator({modalRouteNames: Object.keys(newModalRoutes), rootState: makeRootState()})
})

afterEach(() => {
  cleanup()
  restoreNavigator()
  jest.restoreAllMocks()
  resetAllStores()
})

type Listener = Parameters<typeof T.RPCGen.loginRecoverPassphraseRpcListener>[0]

const mockRuns = () => {
  const listeners: Array<Listener> = []
  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async l => {
    listeners.push(l)
    await new Promise<void>(() => {})
    return undefined as any
  })
  return listeners
}

const prompt = (listener: Listener) => {
  const response = {error: jest.fn(), result: jest.fn()}
  listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
    {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
    response as any
  )
  const top = nav.getRootState()?.routes?.at(-1)
  expect(top?.name).toBe('recoverPasswordPgpWarning')
  return {id: (top?.params as {pgpPromptID: number}).pgpPromptID, response}
}

// Starts a run, has Go ask, and renders the warning the way its route would.
const setup = async () => {
  const listeners = mockRuns()
  startRecoverPassword({username: 'testuser'})
  await flush()
  const {id, response} = prompt(listeners[0]!)
  render(<PgpWarning route={{params: {pgpPromptID: id}}} />)
  return {id, listeners, response}
}

const rootRouteNames = () => nav.getRootState()?.routes?.map(r => r.name)

test('draws no header of its own under the route header', async () => {
  await setup()
  expect(screen.queryByText('Recover password')).toBeNull()
  expect(screen.queryByText('Back')).toBeNull()
})

test('Continue answers true once and closes the warning', async () => {
  const {response} = await setup()
  fireEvent.click(screen.getByText('Continue'))
  fireEvent.click(screen.getByText('Continue'))
  fireEvent.click(screen.getByText('Cancel'))
  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(true)
  expect(rootRouteNames()).toEqual(['loggedIn'])
})

test('Cancel answers false once and closes the warning', async () => {
  const {response} = await setup()
  fireEvent.click(screen.getByText('Cancel'))
  fireEvent.click(screen.getByText('Cancel'))
  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(false)
  expect(rootRouteNames()).toEqual(['loggedIn'])
})

test('the header back affordance answers false and closes the warning', async () => {
  const {id, response} = await setup()
  const {getOptions} = newModalRoutes.recoverPasswordPgpWarning
  const options = getOptions({route: {params: {pgpPromptID: id}}})
  expect(options.gestureEnabled).toBe(false)
  if (!('headerLeft' in options)) throw new Error('expected the non-iOS headerLeft')
  const {container} = render(options.headerLeft())
  const back = container.querySelector<HTMLElement>('.icon')
  expect(back).not.toBeNull()
  fireEvent.click(back!)

  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(false)
  expect(rootRouteNames()).toEqual(['loggedIn'])
})

describe('the user taking the warning away', () => {
  test.each(['GO_BACK', 'POP', 'REMOVE'])('%s answers false once and navigates nothing more', async type => {
    const {response} = await setup()
    nav.clearActions()
    mockBeforeRemove.current!({data: {action: {type}}})
    mockBeforeRemove.current!({data: {action: {type}}})
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    // The removal under way takes the screen; a second navigation would take something else too.
    expect(nav.actions).toEqual([])
  })

  // The app's own resets and replaces, like the flow closing the warning or a screen taking its place.
  test.each(['RESET', 'REPLACE'])('a %s is not the user, and answers nothing', async type => {
    const {response} = await setup()
    mockBeforeRemove.current!({data: {action: {type}}})
    expect(response.result).not.toHaveBeenCalled()
  })

  test('after Continue, answers nothing more', async () => {
    const {response} = await setup()
    fireEvent.click(screen.getByText('Continue'))
    mockBeforeRemove.current!({data: {action: {type: 'GO_BACK'}}})
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(true)
  })
})

test("a stale warning's buttons and removal can't reach a newer prompt", async () => {
  const {listeners, response} = await setup()
  startRecoverPassword({username: 'testuser'})
  await flush()
  expect(response.result).toHaveBeenCalledTimes(1)
  const next = prompt(listeners[1]!)
  nav.clearActions()

  fireEvent.click(screen.getByText('Continue'))
  fireEvent.click(screen.getByText('Cancel'))
  mockBeforeRemove.current!({data: {action: {type: 'GO_BACK'}}})

  expect(response.result).toHaveBeenCalledTimes(1)
  expect(next.response.result).not.toHaveBeenCalled()
  expect(nav.actions).toEqual([])
  expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
})
