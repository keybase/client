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
import {navigateAppend, navigateUp} from '@/constants/router'
import {HeaderLeftButton} from '@/common-adapters'
import PgpWarning from './pgp-warning'

type BeforeRemove = (e: {data: {action: {type: string}}}) => void

// One navigation object for the screen, as React Navigation hands a screen the same one on every render.
const mockNavigation = {
  addListener: (type: string, cb: BeforeRemove & (() => void)) => {
    if (type === 'beforeRemove') {
      mockBeforeRemove.current = cb
    } else if (type === 'focus') {
      mockFocus.current = cb
    }
    return () => {}
  },
  canGoBack: () => true,
  // A goBack asks the screen's beforeRemove, then pops it.
  goBack: () => {
    mockBeforeRemove.current?.({data: {action: {type: 'GO_BACK'}}})
    mockNavigateUp()
  },
  // The warning is focused while it is the top of the root stack.
  isFocused: () => mockTopRouteName() === 'recoverPasswordPgpWarning',
}
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}))

const mockBeforeRemove: {current?: BeforeRemove} = {}
const mockFocus: {current?: () => void} = {}
const mockNavigateUp = () => navigateUp()
const mockTopRouteName = () => nav.getRootState()?.routes?.at(-1)?.name

let nav: FakeNavigator

// Go asks only after the paper key has logged the user in, so the warning sits over the logged-in app.
beforeEach(() => {
  mockBeforeRemove.current = undefined
  mockFocus.current = undefined
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
  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(true)
  expect(rootRouteNames()).toEqual(['loggedIn'])
})

test('has no body Cancel; the header Cancel is the only one', async () => {
  await setup()
  expect(screen.queryByText('Cancel')).toBeNull()
})

// The route declares no header buttons of its own, so the modal group's Cancel (a plain goBack) is the header.
test("the modal group's header Cancel answers false once and closes the warning", async () => {
  const {response} = await setup()
  const options = newModalRoutes.recoverPasswordPgpWarning.getOptions
  expect(options).toEqual({gestureEnabled: false, title: 'Recover password'})
  render(<HeaderLeftButton mode="cancel" />)
  fireEvent.click(screen.getByText('Cancel'))

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

  test.each(['RESET', 'REPLACE'])('a %s removing the warning answers false once', async type => {
    const {response} = await setup()
    nav.clearActions()
    mockBeforeRemove.current!({data: {action: {type}}})
    mockBeforeRemove.current!({data: {action: {type}}})
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(nav.actions).toEqual([])
  })

  test('the removal when a restart settles the warning answers nothing more', async () => {
    const {listeners, response} = await setup()
    startRecoverPassword({username: 'testuser'})
    await flush()
    mockBeforeRemove.current!({data: {action: {type: 'RESET'}}})
    expect(listeners).toHaveLength(2)
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
  })

  test.each(['GO_BACK', 'RESET'])('after Continue, a %s answers nothing more', async type => {
    const {response} = await setup()
    fireEvent.click(screen.getByText('Continue'))
    mockBeforeRemove.current!({data: {action: {type}}})
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
  mockBeforeRemove.current!({data: {action: {type: 'GO_BACK'}}})

  expect(response.result).toHaveBeenCalledTimes(1)
  expect(next.response.result).not.toHaveBeenCalled()
  expect(nav.actions).toEqual([])
  expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
})

// A covered modal can lose its effects (Activity) while it is still on the stack, so only a removal answers.
test('the screen unmounting without a removal answers nothing', async () => {
  const {response} = await setup()
  cleanup()
  expect(response.result).not.toHaveBeenCalled()
  expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
})

// The flow can't remove a warning another modal covers (iOS aborts), so it leaves it to go by itself.
describe('a warning settled while another modal covers it', () => {
  const coverAndSettle = async () => {
    const {listeners, response} = await setup()
    navigateAppend({name: 'proxySettingsModal', params: {}})
    // A restart declines the old prompt.
    startRecoverPassword({username: 'testuser'})
    await flush()
    expect(listeners).toHaveLength(2)
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
    return {response}
  }

  test('closes itself once the cover is dismissed, answering nothing more', async () => {
    const {response} = await coverAndSettle()

    navigateUp()
    nav.clearActions()
    mockFocus.current!()

    expect(nav.types()).toEqual(['GO_BACK'])
    expect(rootRouteNames()).toEqual(['loggedIn'])
    expect(response.result).toHaveBeenCalledTimes(1)
  })

  test('stays while it is still covered', async () => {
    await coverAndSettle()
    nav.clearActions()

    mockFocus.current!()

    expect(nav.actions).toEqual([])
    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning', 'proxySettingsModal'])
  })

  // A covered screen can lose its effects (Activity) and get them back when it is uncovered.
  test('closes itself when it mounts focused with nothing to ask', async () => {
    const {response} = await coverAndSettle()
    navigateUp()
    cleanup()
    nav.clearActions()

    const id = (nav.getRootState()?.routes?.at(-1)?.params as {pgpPromptID: number}).pgpPromptID
    render(<PgpWarning route={{params: {pgpPromptID: id}}} />)

    expect(nav.types()).toEqual(['GO_BACK'])
    expect(rootRouteNames()).toEqual(['loggedIn'])
    expect(response.result).toHaveBeenCalledTimes(1)
  })
})

test('uncovered with its prompt still pending, it stays and answers nothing', async () => {
  const {response} = await setup()
  navigateAppend({name: 'proxySettingsModal', params: {}})
  navigateUp()
  nav.clearActions()

  mockFocus.current!()

  expect(nav.actions).toEqual([])
  expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
  expect(response.result).not.toHaveBeenCalled()
})
