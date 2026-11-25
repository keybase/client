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
import {holdLoggedOutLink, releaseLoggedOutLink, useLinksLoggedIn} from '@/router-v2/logged-out-share'
import {_onEngineIncoming, initSharedSubscriptions} from '@/constants/init/shared'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {NavigationTree, makeRootState} from '@/test/navigation'
import {modalRouteNames} from '@/test/route-names'
import {
  answerLoggedOut,
  answerPaperKey,
  askNewPassword,
  askPgp,
  flush,
  pgpWarning,
  setPassword,
  startRun as startRunOn,
} from '@/test/recover-password'
import PgpWarning from './pgp-warning'

let fake: FakeEngine
// The root group each committed navigation state showed, collapsing repeats: one entry per switch.
let roots: Array<string>

// The app's root: the router decides the group from the session, and releases a share held while
// logged out, as router.tsx does. It starts on the device chooser, which the paper key screen replaces.
const App = () => {
  useLinksLoggedIn()
  return (
    <NavigationTree
      layout="desktop"
      loggedIn={useLoggedInScreens()}
      initialState={makeRootState({above: [{name: 'recoverPasswordDeviceSelector', params: {devices: []}}], loggedIn: false})}
      screen={r => (r.name === pgpWarning ? <PgpWarning /> : null)}
    />
  )
}

beforeEach(() => {
  NavTree.setModalRouteNames(modalRouteNames)
  fake = installFakeEngine()
  roots = []
  answerLoggedOut(fake)
})

afterEach(() => {
  cleanup()
  releaseLoggedOutLink()
  resetAllStores()
})

const pendingURL = () => useNavigationIntentsState.getState().intent?.url

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

const startRun = async () => startRunOn(fake)

// Through the paper key to the pgp warning: Go is logged in now, and asks.
const toPgpWarning = async () => {
  const run = await startRun()
  await answerPaperKey(run.push)
  const {answer: pgp} = await askPgp(run.push)
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
  await askNewPassword(push)
  expect(visibleName()).toBe(setPassword)
  expect(roots).toEqual(['loggedOut'])

  fake.answer('keybase.1.config.getBootstrapStatus', () => ({loggedIn: true}))
  reply(null)
  await flush()
  expect(roots).toEqual(['loggedOut', 'loggedIn'])
})

test('a share held while logged out stays held through the run, and opens once the app is up', async () => {
  await mount()
  holdLoggedOutLink('keybase://incoming-share/0000ab')
  const {pgp, push, reply} = await toPgpWarning()

  await sessionSays(true)
  holdLoggedOutLink('keybase://incoming-share')
  expect(pendingURL()).toBeUndefined()

  fireEvent.click(screen.getByText('Continue'))
  await flush()
  await pgp
  await askNewPassword(push)
  expect(pendingURL()).toBeUndefined()

  fake.answer('keybase.1.config.getBootstrapStatus', () => ({loggedIn: true}))
  reply(null)
  await flush()
  expect(roots).toEqual(['loggedOut', 'loggedIn'])
  expect(pendingURL()).toBe('keybase://incoming-share')
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

// The service's reply to the run and its login notification take separate paths. These run the
// app's real session handling: a notification makes the app read the session from the daemon, and
// the reply applies. Last in the file: the session subscriptions stay installed.
describe('the run ends on what the daemon says', () => {
  const status = (loggedIn: boolean): T.RPCGen.BootstrapStatus => ({
    deviceID: loggedIn ? 'device-1' : '',
    deviceName: loggedIn ? 'phone' : '',
    fullname: '',
    loggedIn,
    registered: true,
    uid: loggedIn ? 'uid-1' : '',
    userReacjis: {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: []},
    sessionSeq,
    username: loggedIn ? 'testuser' : '',
  })
  let daemonLoggedIn = false
  // the service numbers each session it announces and a read carries the latest number; the
  // daemon store keeps the last one across a reset, so this only grows
  let sessionSeq = 0
  const notifyLogin = async () => {
    daemonLoggedIn = true
    sessionSeq++
    await fake.push('keybase.1.NotifySession.sessionChanged', {status: status(true)}, {oneway: true})
    await flush()
  }

  beforeEach(() => {
    daemonLoggedIn = false
    uninstallFakeEngine()
    fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
    // the app reads the gregor UI prefs once it knows the signed-in account
    fake.answer('keybase.1.gregor.getUIPrefs', () => ({allowAnimatedEmojis: false, blockButtonsAdders: {}, chosenChannelsTeamnames: [], explodingModes: {}, pinnedConvs: [], teamAccessRequests: {}, unreadableExplodingModes: []}))
    fake.answer('keybase.1.config.getBootstrapStatus', () => status(daemonLoggedIn))
    fake.answer('keybase.1.login.getConfiguredAccounts', () => [])
    initSharedSubscriptions()
  })

  // Through Save: Go has the new password and is logged in, and has not said so yet.
  const toSaved = async () => {
    const run = await toPgpWarning()
    fireEvent.click(screen.getByText('Continue'))
    await flush()
    await run.pgp
    await askNewPassword(run.push)
    expect(visibleName()).toBe(setPassword)
    daemonLoggedIn = true
    return run
  }

  test('the reply before the login notification: the session read switches to the app', async () => {
    await mount()
    const {reply} = await toSaved()
    reply(null)
    await flush()
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
    expect(useConfigState.getState().recoverPasswordHold).toBe(0)

    await notifyLogin()
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
  })

  test('the login notification before the reply: the prompt stays until the reply', async () => {
    await mount()
    const {reply} = await toSaved()
    await notifyLogin()
    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(roots).toEqual(['loggedOut'])

    reply(null)
    await flush()
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
  })

  test('a success the daemon reads as logged out goes back to login, not a dead prompt', async () => {
    await mount()
    const {reply} = await toSaved()
    daemonLoggedIn = false
    reply(null)
    await flush()
    expect(roots).toEqual(['loggedOut'])
    expect(visibleName()).toBe('login')
    expect(useConfigState.getState().recoverPasswordHold).toBe(0)

    // A login the service reports later still lands.
    await notifyLogin()
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
  })

  test('a failed run the daemon still reads as logged in shows the app it is logged in to', async () => {
    await mount()
    const {reply} = await toSaved()
    // the service announces the login it could not undo, so the session it reads is a newer one
    sessionSeq++
    reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'password change failed'))
    await flush()
    expect(roots).toEqual(['loggedOut', 'loggedIn'])
    expect(useConfigState.getState().recoverPasswordHold).toBe(0)
  })
})
