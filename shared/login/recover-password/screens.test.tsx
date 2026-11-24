/** @jest-environment jsdom */
/// <reference types="jest" />
// A paper-key recovery end to end: the real flow, engine listener and screens, against the fake
// service. Go asks about pgp keys and for a new password once the paper key has logged it in, but
// holds back its login notification until the new password is set, so the app stays logged out
// through every prompt and logs in once, when the service says so.
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, screen} from '@testing-library/react'
import {CommonActions, StackActions} from '@react-navigation/core'
import {navigationRef} from '@/constants/navigator'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {installNavigation, makeRootState, stackKeyOf, type MountedNavigation} from '@/test/navigation'
import {
  answerLoggedOut,
  answerPaperKey,
  askNewPassword,
  askPgp,
  flush,
  pgpWarning,
  recover,
  setPassword,
  startRun as startRunOn,
  type Push,
} from '@/test/recover-password'
import ProvisionPassword from '@/provision/password'
import {submitRecoverPasswordDeviceSelect, submitRecoverPasswordPgpWarning} from './flow'
import PgpWarning from './pgp-warning'
import SetPassword from './password'

let nav: MountedNavigation
let fake: FakeEngine

const install = (above: ReadonlyArray<{name: string; params?: object}>) => {
  nav = installNavigation({
    rootState: makeRootState({above, loggedIn: false}),
    screen: r =>
      r.name === pgpWarning ? (
        <PgpWarning />
      ) : r.name === setPassword ? (
        <SetPassword route={r as never} />
      ) : r.name === 'password' ? (
        <ProvisionPassword route={r as never} />
      ) : null,
  })
}

beforeEach(() => {
  fake = installFakeEngine()
  answerLoggedOut(fake)
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

const loggedOutStack = () => nav.getRootState()?.routes?.[0]?.state?.routes.map(r => r.name)
const rootNames = () => nav.getRootState()?.routes?.map(r => r.name)

const startRun = async (start?: () => void) => startRunOn(fake, start)

// From the device chooser to the paper key being accepted.
const throughPaperKey = async (push: Push) => {
  const chosen = push('keybase.1.loginUi.chooseDeviceToRecoverWith', {
    devices: [{deviceID: 'paper-1', deviceNumberOfType: 1, name: 'paper one', type: 'backup'}],
  })
  await flush()
  act(() => submitRecoverPasswordDeviceSelect(T.Devices.stringToDeviceID('paper-1')))
  await flush()
  await expect(chosen).resolves.toEqual({result: 'paper-1'})

  await expect(answerPaperKey(push)).resolves.toEqual({
    result: {passphrase: 'one two three', storeSecret: false},
  })
}

const typeAndSave = (password: string) => {
  fireEvent.change(screen.getByPlaceholderText('New password'), {target: {value: password}})
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), {target: {value: password}})
  fireEvent.click(screen.getByText('Save'))
}

// The ways a user takes a screen away, as the library and its views dispatch them.
const userRemovals = {
  // native-stack's onDismissed: a native back or swipe
  DISMISS: (name: string) => ({...StackActions.dismiss(), source: nav.visibleScreen()?.key, target: stackKeyOf(name)}),
  GO_BACK: () => CommonActions.goBack(),
  POP: () => StackActions.pop(),
}
type Removal = keyof typeof userRemovals
const removalTypes = Object.keys(userRemovals) as Array<Removal>

test('success: every prompt shows while logged out, and the app logs in once, from the service', async () => {
  install([])
  const {push, reply} = await startRun()
  await throughPaperKey(push)

  const {answer: pgp} = await askPgp(push)
  expect(rootNames()).toEqual(['loggedOut'])
  expect(loggedOutStack()).toEqual(['login', pgpWarning])
  fireEvent.click(screen.getByText('Continue'))
  await flush()
  await expect(pgp).resolves.toEqual({result: true})

  const {answer: password} = await askNewPassword(push)
  // The new password replacing the warning does not cancel it: Save below still answers.
  expect(loggedOutStack()).toEqual(['login', setPassword])
  typeAndSave('hunter2hunter2')
  await flush()
  await expect(password).resolves.toEqual({result: {passphrase: 'hunter2hunter2', storeSecret: true}})

  // The service's login notification makes the session read say logged in, here before the run's
  // reply (the other order is in logged-out-hold.test.tsx). The run's own read finds the same.
  act(() => useConfigState.getState().dispatch.setLoggedIn(true))
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({loggedIn: true}))
  nav.clearActions()
  reply(null)
  await flush()
  // The flow neither logs in nor moves on its own.
  expect(nav.actions).toEqual([])

  // The router flips the root once the run lets go of the logged-out screens.
  act(() => nav.setLoggedIn(true))
  await flush()
  expect(rootNames()).toEqual(['loggedIn'])
})

test.each(removalTypes)('the user taking the pgp warning away (%s) declines it, and recovery ends logged out', async type => {
  install([])
  const {push, reply} = await startRun()
  await throughPaperKey(push)
  const {answer: pgp} = await askPgp(push)

  act(() => navigationRef.dispatch(userRemovals[type](pgpWarning)))
  await flush()
  await expect(pgp).resolves.toEqual({result: false})
  expect(loggedOutStack()).toEqual(['login'])

  // Go cancels and logs back out; nothing was ever shown as a login.
  reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'Password recovery canceled'))
  await flush()
  expect(rootNames()).toEqual(['loggedOut'])
  expect(loggedOutStack()).toEqual(['login'])
  expect(useConfigState.getState().loggedIn).toBe(false)
})

test.each(removalTypes)('the user taking the new password away (%s) cancels it', async type => {
  install([])
  const {push, reply} = await startRun()
  await throughPaperKey(push)
  const {answer: password} = await askNewPassword(push)
  expect(loggedOutStack()).toEqual(['login', setPassword])

  act(() => navigationRef.dispatch(userRemovals[type](setPassword)))
  await flush()
  expect(await password).toMatchObject({error: {code: T.RPCGen.StatusCode.scinputcanceled}})
  expect(loggedOutStack()).toEqual(['login'])

  reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
  await flush()
  expect(loggedOutStack()).toEqual(['login'])
  expect(useConfigState.getState().loggedIn).toBe(false)
  // the cancel ends the run; nothing restarts it
  expect(fake.calls.filter(c => c.method === recover)).toHaveLength(1)
})

// An answered screen stays up until Go asks its next question; the user can still take it away.
test.each(removalTypes)('taking the pgp warning away (%s) after Continue declines the next prompt', async type => {
  install([])
  const {push, reply} = await startRun()
  await throughPaperKey(push)
  const {answer: pgp} = await askPgp(push)
  fireEvent.click(screen.getByText('Continue'))
  await flush()
  await expect(pgp).resolves.toEqual({result: true})

  act(() => navigationRef.dispatch(userRemovals[type](pgpWarning)))
  await flush()
  expect(loggedOutStack()).toEqual(['login'])

  const {answer: password} = await askNewPassword(push)
  expect(await password).toMatchObject({error: {code: T.RPCGen.StatusCode.scinputcanceled}})
  expect(loggedOutStack()).toEqual(['login'])

  reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
  await flush()
  expect(loggedOutStack()).toEqual(['login'])
})

test('taking the new password away after Save declines a retry, which replaces nothing', async () => {
  install([{name: 'username', params: {username: 'testuser'}}])
  const {push} = await startRun()
  await throughPaperKey(push)
  const {answer: password} = await askNewPassword(push)
  typeAndSave('hunter2hunter2')
  await flush()
  await password

  act(() => navigationRef.dispatch(CommonActions.goBack()))
  await flush()
  expect(loggedOutStack()).toEqual(['login', 'username'])

  const retry = push('keybase.1.secretUi.getPassphrase', {
    pinentry: {retryLabel: 'too weak', type: T.RPCGen.PassphraseType.passPhrase},
  })
  await flush()
  expect(await retry).toMatchObject({error: {code: T.RPCGen.StatusCode.scinputcanceled}})
  expect(loggedOutStack()).toEqual(['login', 'username'])
})

test('an app reset that removes the pgp warning is not an answer', async () => {
  install([])
  const {push} = await startRun()
  await throughPaperKey(push)
  const {answer: pgp} = await askPgp(push)
  const answered = jest.fn()
  void pgp.then(answered)

  const rs = nav.getRootState()!
  const loggedOut = rs.routes![0]!.state!
  act(() =>
    navigationRef.dispatch({
      ...CommonActions.reset({...loggedOut, index: 0, routes: loggedOut.routes.slice(0, 1)} as never),
      target: loggedOut.key,
    })
  )
  await flush()

  expect(loggedOutStack()).toEqual(['login'])
  expect(answered).not.toHaveBeenCalled()
})

test('the service failing after the paper key shows the error in place, still logged out', async () => {
  install([])
  const {push, reply} = await startRun()
  await throughPaperKey(push)
  const {answer: password} = await askNewPassword(push)
  typeAndSave('hunter2hunter2')
  await flush()
  await password

  reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'the password change failed'))
  await flush()

  expect(rootNames()).toEqual(['loggedOut'])
  expect(loggedOutStack()).toEqual(['login', 'recoverPasswordError'])
  expect(nav.visibleScreen()?.params).toEqual({error: expect.stringContaining('the password change failed')})
  expect(useConfigState.getState().loggedIn).toBe(false)
})

test('a pgp prompt arriving after the run ended shows nothing and takes no answer', async () => {
  install([])
  const {push, reply} = await startRun()
  const answered = jest.fn()
  void push('keybase.1.loginUi.promptPassphraseRecovery', {
    kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys,
  }).then(answered)
  reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'Canceling RPC'))
  await flush()
  act(() => submitRecoverPasswordPgpWarning())
  await flush()

  expect(loggedOutStack()).toEqual(['login'])
  expect(answered).not.toHaveBeenCalled()
})

test('the run waits on the service except while a prompt is up', async () => {
  install([])
  // The engine throttles turning waiting on; flush it before reading the store
  const waitingCount = () => {
    fake.engine._throttledDispatchWaitingAction.flush()
    return useWaitingState.getState().counts.get(waitingKeyRecoverPassword) ?? 0
  }
  const {push, reply} = await startRun()
  expect(waitingCount()).toBe(1)

  const {answer: pgp} = await askPgp(push)
  expect(nav.visibleScreen()?.name).toBe(pgpWarning)
  expect(waitingCount()).toBe(0)

  act(() => submitRecoverPasswordPgpWarning())
  await expect(pgp).resolves.toEqual({result: true})
  expect(waitingCount()).toBe(1)

  fake.answer('keybase.1.config.getBootstrapStatus', () => ({loggedIn: true}))
  reply(null)
  await flush()
  expect(waitingCount()).toBe(0)
})

describe('started from the provisioning password screen', () => {
  const provisionStack = [{name: 'username', params: {username: 'testuser'}}, {name: 'password', params: {username: 'testuser'}}]

  const forgotPassword = async () => {
    install(provisionStack)
    return startRun(() => fireEvent.click(screen.getByText('Forgot password?')))
  }

  test('the prompts replace each other above it, and declining returns to it', async () => {
    const {push, reply} = await forgotPassword()
    await throughPaperKey(push)
    expect(loggedOutStack()).toEqual(['login', 'username', 'password', 'recoverPasswordPaperKey'])

    const {answer: pgp} = await askPgp(push)
    expect(loggedOutStack()).toEqual(['login', 'username', 'password', pgpWarning])
    act(() => navigationRef.dispatch(CommonActions.goBack()))
    await flush()
    await expect(pgp).resolves.toEqual({result: false})

    reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'Password recovery canceled'))
    await flush()
    expect(loggedOutStack()).toEqual(['login', 'username', 'password'])
    expect(useConfigState.getState().loggedIn).toBe(false)
  })

  test('a successful recovery ends on the logged-in app', async () => {
    const {push, reply} = await forgotPassword()
    await throughPaperKey(push)
    const {answer: password} = await askNewPassword(push)
    expect(loggedOutStack()).toEqual(['login', 'username', 'password', setPassword])
    typeAndSave('hunter2hunter2')
  await flush()
    await password

    act(() => useConfigState.getState().dispatch.setLoggedIn(true))
    fake.answer('keybase.1.config.getBootstrapStatus', () => ({loggedIn: true}))
    reply(null)
    await flush()
    expect(loggedOutStack()).toEqual(['login', 'username', 'password', setPassword])
    act(() => nav.setLoggedIn(true))
    await flush()
    expect(rootNames()).toEqual(['loggedIn'])
  })
})
