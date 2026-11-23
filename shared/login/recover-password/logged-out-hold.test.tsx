/** @jest-environment jsdom */
/// <reference types="jest" />
// Between the paper key and the end of recovery Go is logged in but has not said so, so a session
// read in that window (back online, another notification) says logged in. The router keeps the
// logged-out screens for the run, so the prompt stays, and lets go when the run ends.
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as NavTree from '@/constants/nav-tree'
import {navigationRef} from '@/constants/navigator'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useLoggedInScreens} from '@/router-v2/logged-in-screens'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {settle} from '@/test/flush'
import {NavigationTree, makeRootState} from '@/test/navigation'
import {modalRouteNames} from '@/test/route-names'
import {startRecoverPassword, submitRecoverPasswordPaperKey} from './flow'
import PgpWarning from './pgp-warning'

const recover = 'keybase.1.login.recoverPassphrase'
const pgpWarning = 'recoverPasswordPgpWarning'

let fake: FakeEngine
// The root group each committed navigation state showed, collapsing repeats: one entry per switch.
let roots: Array<string>

// The app's root: the router decides the group from the session, as router.tsx does. It starts on
// the device chooser, which the paper key screen replaces.
const App = () => (
  <NavigationTree
    layout="desktop"
    loggedIn={useLoggedInScreens()}
    initialState={makeRootState({above: [{name: 'recoverPasswordDeviceSelector', params: {devices: []}}], loggedIn: false})}
    screen={r => (r.name === pgpWarning ? <PgpWarning /> : null)}
  />
)

beforeEach(() => {
  NavTree.setModalRouteNames(modalRouteNames)
  fake = installFakeEngine()
  roots = []
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

const flush = async (turns = 3) => {
  for (let i = 0; i < turns; i++) {
    await act(async () => settle())
  }
}

const mount = async () => {
  render(<App />)
  await flush()
  navigationRef.addListener('state', () => {
    const root = navigationRef.getRootState()?.routes[0]?.name ?? ''
    if (roots.at(-1) !== root) roots.push(root)
  })
  roots.push(navigationRef.getRootState()?.routes[0]?.name ?? '')
}

const visibleName = () => NavTree.visibleScreen(navigationRef.getRootState() as NavTree.NavState)?.name

const startRun = async () => {
  const held = fake.hold(recover)
  act(() => startRecoverPassword({username: 'testuser'}))
  await flush()
  const sessionID = fake.calls.find(c => c.method === recover)!.params.sessionID as number
  const push = async (method: string, params: object) => fake.push(method, params, {sessionID})
  return {push, reply: held.at(-1)!.reply}
}

// Through the paper key to the pgp warning: Go is logged in now, and asks.
const toPgpWarning = async () => {
  const run = await startRun()
  const paperKey = run.push('keybase.1.secretUi.getPassphrase', {
    pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.paperKey},
  })
  await flush()
  act(() => submitRecoverPasswordPaperKey('one two three'))
  await flush()
  await paperKey
  const pgp = run.push('keybase.1.loginUi.promptPassphraseRecovery', {
    kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys,
  })
  await flush()
  expect(visibleName()).toBe(pgpWarning)
  return {...run, pgp}
}

// What the session read applies when it finds the service logged in or out.
const sessionSays = async (loggedIn: boolean) => {
  act(() => useConfigState.getState().dispatch.setLoggedIn(loggedIn))
  await flush()
}

test('a session read mid-prompt keeps the prompt, and success switches to the app once', async () => {
  await mount()
  const {pgp, push, reply} = await toPgpWarning()

  await sessionSays(true)
  expect(visibleName()).toBe(pgpWarning)
  expect(roots).toEqual(['loggedOut'])

  fireEvent.click(screen.getByText('Continue'))
  await flush()
  await expect(pgp).resolves.toEqual({result: true})
  const password = push('keybase.1.secretUi.getPassphrase', {
    pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase},
  })
  await flush()
  expect(visibleName()).toBe('recoverPasswordSetPassword')
  expect(roots).toEqual(['loggedOut'])
  void password

  reply(null)
  await flush()
  expect(roots).toEqual(['loggedOut', 'loggedIn'])
})

test('without a run, a session read switches to the app at once', async () => {
  await mount()
  await sessionSays(true)
  expect(roots).toEqual(['loggedOut', 'loggedIn'])
})

describe('the hold ends with the run', () => {
  test('when the run fails', async () => {
    await mount()
    const {reply} = await toPgpWarning()
    reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'the password change failed'))
    await flush()

    await sessionSays(true)
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
  })

  test('when the user cancels', async () => {
    await mount()
    const {pgp, reply} = await toPgpWarning()
    act(() => navigationRef.goBack())
    await flush()
    await expect(pgp).resolves.toEqual({result: false})
    reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'Password recovery canceled'))
    await flush()

    await sessionSays(true)
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
  })

  test('when the app resets its stores', async () => {
    await mount()
    await toPgpWarning()
    act(() => resetAllStores())
    await flush()

    await sessionSays(true)
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
  })

  test('when an account switch starts', async () => {
    await mount()
    await toPgpWarning()
    act(() => useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-mac'))
    await flush()
    act(() => useConfigState.getState().dispatch.setUserSwitching(false))
    await flush()

    await sessionSays(true)
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
  })

  test("an earlier run ending does not end a newer run's hold", async () => {
    await mount()
    const first = await startRun()
    const second = await toPgpWarning()
    first.reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'Canceling RPC'))
    await flush()

    await sessionSays(true)
    expect(visibleName()).toBe(pgpWarning)
    expect(roots).toEqual(['loggedOut'])

    second.reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'Canceling RPC'))
    await flush()
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
  })
})

test('a run started logged in holds nothing', async () => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  await mount()
  expect(roots).toEqual(['loggedIn'])
  const {reply} = await startRun()
  reply(fakeError(T.RPCGen.StatusCode.scalreadyloggedin, 'already logged in'))
  await flush()
  expect(roots).toEqual(['loggedIn'])
})
