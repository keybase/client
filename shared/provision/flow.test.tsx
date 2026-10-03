/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {waitingKeyProvision} from '@/constants/strings'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import * as Router from '@/constants/router'
import logger from '@/logger'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'

import {
  cancelProvision,
  pauseProvision,
  startAddNewDevice,
  submitProvisionDeviceName,
  submitProvisionDeviceSelect,
  submitProvisionPassphrase,
  submitProvisionTextCode,
  submitProvisionUsername,
  startProvision,
} from './flow'

const login = 'keybase.1.login.login'
const deviceAdd = 'keybase.1.device.deviceAdd'
const bootstrap = 'keybase.1.config.getBootstrapStatus'
const deviceName = 'keybase.1.provisionUi.PromptNewDeviceName'
const chooseDevice = 'keybase.1.provisionUi.chooseDevice'
const getPassphrase = 'keybase.1.secretUi.getPassphrase'
const secret = 'keybase.1.provisionUi.DisplayAndPromptSecret'
const secretExchanged = 'keybase.1.provisionUi.DisplaySecretExchanged'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}

let nav: FakeNavigator
let fake: FakeEngine

// Provisioning runs from a modal, so the fake starts with one open: clearModals only has
// something to dispatch when a modal is actually on screen. This one is never a
// navigation target below, so a replace onto another screen stays a replace.
const openModal = 'deviceAdd'

beforeEach(() => {
  nav = installFakeNavigator({
    modalRouteNames: [openModal],
    rootState: makeRootState({above: [{name: openModal}]}),
  })
  fake = installFakeEngine()
})

afterEach(() => {
  jest.restoreAllMocks()
  cancelProvision()
  restoreNavigator()
  resetAllStores()
})

// The listener hands incoming calls to their handlers on a timer, and a flow reading a dialog's events
// sees its end on another
const settle = async () => {
  for (let i = 0; i < 2; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 0))
    // eslint-disable-next-line no-await-in-loop
    await tick()
  }
}

const makeRpcDevice = (name: string, deviceID: string, type: 'mobile' | 'desktop' | 'backup') => ({
  deviceID,
  deviceNumberOfType: 1,
  name,
  type,
})

// Every login attempt is held until the test replies to it, like the real RPC waiting on prompts
const startLogin = async () => {
  const held = fake.hold(login)
  // A login that returns reads the session again
  fake.hold(bootstrap)
  submitProvisionUsername('testuser')
  await tick()
  return held
}
const loginCalls = () => fake.calls.filter(c => c.method === login)
const sessionOf = (attempt: number) => loginCalls()[attempt]!.params.sessionID as number

// Resolves with what the GUI answered; settle() lets the flow see it first
const push = async (method: string, params: object, attempt: number) =>
  fake.push(method, params, {sessionID: sessionOf(attempt)})
const pushDeviceName = async (attempt: number, errorMessage = '') =>
  push(deviceName, {errorMessage, existingDevices: []}, attempt)
const pushPassword = async (attempt: number) =>
  push(getPassphrase, {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}}, attempt)

test('startProvision navigates to the username screen', () => {
  startProvision('alice', true)
  expect(nav.navigations()).toContainEqual({
    name: 'username',
    params: {fromReset: true, username: 'alice'},
    replace: false,
  })
})

describe('login', () => {
  test('chooseDevice navigates with the devices and the selection answers once; a second tap starts over', async () => {
    const held = await startLogin()
    expect(held).toHaveLength(1)

    const answered = push(chooseDevice, {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]}, 0)
    await settle()

    expect(nav.navigations()).toContainEqual({
      name: 'selectOtherDevice',
      params: {
        devices: [
          expect.objectContaining({id: T.Devices.stringToDeviceID('device-1'), name: 'phone', type: 'mobile'}),
        ],
        username: 'testuser',
      },
      replace: false,
    })

    submitProvisionDeviceSelect('phone')
    await expect(answered).resolves.toEqual({result: T.Devices.stringToDeviceID('device-1')})

    // Nothing is waiting on a selection any more, so this records it and runs the login again
    submitProvisionDeviceSelect('phone')
    await settle()
    expect(held).toHaveLength(2)
    // The device prompt of the new attempt is answered from the record, without a screen
    nav.clearActions()
    const replayed = push(chooseDevice, {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]}, 1)
    await expect(replayed).resolves.toEqual({result: T.Devices.stringToDeviceID('device-1')})
    expect(nav.actions).toEqual([])
    held[1]!.reply(undefined)
    await settle()
  })

  test('changing an earlier answer restarts the RPC and replays the recorded answers in order', async () => {
    const held = await startLogin()

    // first attempt: the user names the device and picks the other device, then gets the password screen
    const name1 = push(deviceName, {errorMessage: '', existingDevices: []}, 0)
    await settle()
    expect(nav.navigations()).toContainEqual({
      name: 'setPublicName',
      params: {devices: [], error: undefined},
      replace: false,
    })
    submitProvisionDeviceName('dev1')
    await expect(name1).resolves.toEqual({result: 'dev1'})

    const choose1 = push(chooseDevice, {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]}, 0)
    await settle()
    submitProvisionDeviceSelect('phone')
    await expect(choose1).resolves.toEqual({result: T.Devices.stringToDeviceID('device-1')})

    const password = pushPassword(0)
    await settle()
    expect(nav.navigations()).toContainEqual({
      name: 'password',
      params: {error: undefined, username: 'testuser'},
      replace: false,
    })

    // the user goes back and submits a different device name: the pending password prompt is
    // refused and the RPC starts over
    submitProvisionDeviceName('dev2')
    await expect(password).resolves.toEqual({error: inputCanceled})
    await settle()
    expect(held).toHaveLength(2)

    // the new attempt answers the device name with the new answer without showing it; the answers
    // after the changed step are dropped, so the device choice is shown again
    nav.clearActions()
    await expect(pushDeviceName(1)).resolves.toEqual({result: 'dev2'})
    expect(nav.actions).toEqual([])
    void push(chooseDevice, {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]}, 1)
    await settle()
    expect(nav.navigations()).toEqual([
      {name: 'selectOtherDevice', params: {devices: [expect.objectContaining({name: 'phone'})], username: 'testuser'}, replace: false},
    ])
    held[1]!.reply(undefined)
    await settle()
    // the login returned: the session is read again
    expect(fake.calls.filter(c => c.method === bootstrap)).toHaveLength(1)
  })

  test('a stale submit after a restart, to the ended attempt\'s prompt, starts nothing over', async () => {
    const held = await startLogin()
    const password = pushPassword(0)
    await settle()
    // the user goes back and changes the device name while the password screen is up
    submitProvisionDeviceName('dev1')
    await expect(password).resolves.toEqual({error: inputCanceled})
    await settle()
    expect(held).toHaveLength(2)

    // the password screen still up answers its closed prompt: nothing
    submitProvisionPassphrase('hunter2')
    await settle()
    expect(held).toHaveLength(2)
    await expect(pushDeviceName(1)).resolves.toEqual({result: 'dev1'})
  })

  test('a later step resubmitted replays every earlier answer in order, then answers it', async () => {
    const held = await startLogin()
    const name1 = pushDeviceName(0)
    await settle()
    submitProvisionDeviceName('dev1')
    await expect(name1).resolves.toEqual({result: 'dev1'})
    const choose1 = push(chooseDevice, {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]}, 0)
    await settle()
    submitProvisionDeviceSelect('phone')
    await expect(choose1).resolves.toEqual({result: T.Devices.stringToDeviceID('device-1')})
    const password1 = pushPassword(0)
    await settle()
    submitProvisionPassphrase('wrong')
    await expect(password1).resolves.toEqual({result: {passphrase: 'wrong', storeSecret: false}})

    // the service is slow; the user backs out and submits the password screen again
    pauseProvision()
    await settle()
    submitProvisionPassphrase('hunter2')
    await settle()
    expect(held).toHaveLength(2)

    nav.clearActions()
    await expect(pushDeviceName(1)).resolves.toEqual({result: 'dev1'})
    await expect(
      push(chooseDevice, {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]}, 1)
    ).resolves.toEqual({result: T.Devices.stringToDeviceID('device-1')})
    await expect(pushPassword(1)).resolves.toEqual({result: {passphrase: 'hunter2', storeSecret: false}})
    expect(nav.actions).toEqual([])
    held[1]!.reply(undefined)
    await settle()
  })

  // The error retry doesn't move past the replayed step, so the recorded answer is sent again
  test('a replayed step the service asks again with an error is answered again from the record', async () => {
    const held = await startLogin()
    const name1 = pushDeviceName(0)
    await settle()
    submitProvisionDeviceName('dev1')
    await name1
    // a later step is changed, so the attempt starts over with the device name recorded
    submitProvisionPassphrase('hunter2')
    await settle()
    expect(held).toHaveLength(2)

    await expect(pushDeviceName(1)).resolves.toEqual({result: 'dev1'})
    nav.clearActions()
    await expect(pushDeviceName(1, 'name taken')).resolves.toEqual({result: 'dev1'})
    expect(nav.actions).toEqual([])
  })

  test('pause during server work cancels the attempt and parks the run', async () => {
    const held = await startLogin()

    // no prompt pending: the service is mid-work (or hung)
    pauseProvision()
    await settle()

    // parked: no restart, no error navigation
    expect(held).toHaveLength(1)
    expect(nav.navigations()).toEqual([])
  })

  test('resubmit while parked restarts and replays the recorded answers', async () => {
    const held = await startLogin()

    // answer the device-name prompt, then the service hangs before the next prompt
    const name1 = pushDeviceName(0)
    await settle()
    submitProvisionDeviceName('dev1')
    await expect(name1).resolves.toEqual({result: 'dev1'})

    pauseProvision()
    await settle()
    expect(held).toHaveLength(1)

    // user resubmits from the (still-mounted) device name screen
    submitProvisionDeviceName('dev2')
    await settle()
    expect(held).toHaveLength(2)

    // the new attempt answers with the replayed answer without navigating
    nav.clearActions()
    await expect(pushDeviceName(1)).resolves.toEqual({result: 'dev2'})
    expect(nav.actions).toEqual([])

    held[1]!.reply(undefined)
    await settle()
  })

  test('cancel while parked tears the run down', async () => {
    const held = await startLogin()
    pauseProvision()
    await settle()

    cancelProvision()
    await settle()

    // dead run: submits are no-ops, nothing restarts, no error screen
    submitProvisionDeviceName('dev1')
    submitProvisionPassphrase('hunter2')
    await settle()
    expect(held).toHaveLength(1)
    expect(nav.navigations()).toEqual([])
  })

  test('cancel with a prompt open refuses it and ends the run', async () => {
    const held = await startLogin()
    const password = pushPassword(0)
    await settle()

    cancelProvision()
    await expect(password).resolves.toEqual({error: inputCanceled})
    // the service's next prompt on that session is refused too
    await expect(pushPassword(0)).resolves.toEqual({error: inputCanceled})

    submitProvisionPassphrase('hunter2')
    await settle()
    expect(held).toHaveLength(1)
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
    expect(nav.navigations()).toEqual([{name: 'password', params: {error: undefined, username: 'testuser'}, replace: false}])
  })

  test('a resubmit and a back-out in the same moment start over rather than park', async () => {
    const held = await startLogin()
    submitProvisionPassphrase('hunter2')
    pauseProvision()
    await settle()
    expect(held).toHaveLength(2)
  })

  test('a prompt arriving after pause is refused and does not navigate', async () => {
    await startLogin()

    pauseProvision()
    await settle()

    nav.clearActions()
    await expect(pushPassword(0)).resolves.toEqual({error: inputCanceled})
    expect(nav.actions).toEqual([])
  })

  test('pause with a pending prompt still resumes when the same step is resubmitted', async () => {
    const held = await startLogin()

    // the service prompts for a device name and the user is looking at it (unanswered) when they
    // back out mid-prompt
    const name1 = pushDeviceName(0)
    await settle()

    pauseProvision()
    await expect(name1).resolves.toEqual({error: inputCanceled})
    await settle()
    expect(held).toHaveLength(1)

    // user resubmits the same step that was pending at pause time
    submitProvisionDeviceName('dev1')
    await settle()
    expect(held).toHaveLength(2)

    // the new attempt answers with the replayed answer without navigating
    nav.clearActions()
    await expect(pushDeviceName(1)).resolves.toEqual({result: 'dev1'})
    expect(nav.actions).toEqual([])

    held[1]!.reply(undefined)
    await settle()
  })

  test('a new username starts a new run and the old one is refused', async () => {
    const held = await startLogin()
    const password = pushPassword(0)
    await settle()

    submitProvisionUsername('testuser2')
    await expect(password).resolves.toEqual({error: inputCanceled})
    await settle()
    expect(held).toHaveLength(2)
    expect(loginCalls()[1]!.params.username).toBe('testuser2')

    // the old run is over: its own end shows nothing and the new run owns the screens
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
    nav.clearActions()
    const password2 = pushPassword(1)
    await settle()
    expect(nav.navigations()).toEqual([{name: 'password', params: {error: undefined, username: 'testuser2'}, replace: false}])
    submitProvisionPassphrase('hunter2')
    await expect(password2).resolves.toEqual({result: {passphrase: 'hunter2', storeSecret: false}})
  })

  test('secret-exchange progress keeps the provision waiting key on while the code page is up', async () => {
    const held = await startLogin()
    const count = () => {
      fake.engine._throttledDispatchWaitingAction.flush()
      return useWaitingState.getState().counts.get(waitingKeyProvision)
    }
    void push(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    expect(count()).toBeUndefined()
    await push(secretExchanged, {}, 0)
    await settle()
    expect(count()).toBe(1)
    held[0]!.reply(undefined)
    await settle()
    expect(count()).toBeUndefined()
  })

  test('the exchange hold ends at the next prompt: a retried secret or a password shows waiting off', async () => {
    const held = await startLogin()
    const count = () => {
      fake.engine._throttledDispatchWaitingAction.flush()
      return useWaitingState.getState().counts.get(waitingKeyProvision)
    }
    void push(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    await push(secretExchanged, {}, 0)
    await push(secretExchanged, {}, 0)
    await settle()
    expect(count()).toBe(1)
    // Go says the code was wrong and asks again
    void push(secret, {phrase: 'one two three', previousErr: 'bad code'}, 0)
    await settle()
    expect(count()).toBeUndefined()
    await push(secretExchanged, {}, 0)
    await settle()
    expect(count()).toBe(1)
    void pushPassword(0)
    await settle()
    expect(count()).toBeUndefined()
    held[0]!.reply(undefined)
    await settle()
    expect(count()).toBeUndefined()
  })

  test('a restart replays its recorded answers without the waiting key turning off', async () => {
    const held = await startLogin()
    const name1 = push(deviceName, {errorMessage: '', existingDevices: []}, 0)
    await settle()
    submitProvisionDeviceName('dev1')
    await name1
    const choose1 = push(chooseDevice, {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]}, 0)
    await settle()
    submitProvisionDeviceSelect('phone')
    await choose1
    // the user resubmits the device choice: the RPC starts over and replays both answers
    submitProvisionDeviceSelect('phone')
    await settle()
    expect(held).toHaveLength(2)
    fake.engine._throttledDispatchWaitingAction.flush()
    expect(useWaitingState.getState().counts.get(waitingKeyProvision)).toBe(1)
    const seen: Array<number> = []
    const unsubscribe = useWaitingState.subscribe(st => seen.push(st.counts.get(waitingKeyProvision) ?? 0))
    await expect(pushDeviceName(1)).resolves.toEqual({result: 'dev1'})
    await expect(push(chooseDevice, {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]}, 1)).resolves.toEqual({
      result: T.Devices.stringToDeviceID('device-1'),
    })
    await settle()
    unsubscribe()
    fake.engine._throttledDispatchWaitingAction.flush()
    expect(seen).not.toContain(0)
    expect(useWaitingState.getState().counts.get(waitingKeyProvision)).toBe(1)
    held[1]!.reply(undefined)
    await settle()
  })

  test('the service cancelling the secret prompt, then the provisionee success, ends the login', async () => {
    const held = await startLogin()
    const shown = push(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    expect(nav.navigations()).toContainEqual(expect.objectContaining({name: 'codePage', replace: false}))

    // the other device entered the code: the service stops asking this one
    fake.cancelPush(secret)
    await expect(shown).resolves.toEqual({
      error: {code: T.RPCGen.StatusCode.sccanceled, desc: 'fake engine: the service cancelled it'},
    })
    await settle()
    await push('keybase.1.provisionUi.ProvisioneeSuccess', {deviceName: 'dev1', username: 'testuser'}, 0)
    await settle()

    // a code typed in the meantime goes nowhere and starts nothing over
    submitProvisionTextCode('one two three')
    await settle()
    expect(held).toHaveLength(1)

    held[0]!.reply(undefined)
    await settle()
    expect(fake.calls.filter(c => c.method === bootstrap)).toHaveLength(1)
    expect(nav.navigations().filter(n => n.name === 'error')).toEqual([])
    expect(nav.modalsCleared()).toBe(false)
  })

  test('the gpg and email prompts are refused, once each', async () => {
    await startLogin()
    for (const method of [
      'keybase.1.gpgUi.selectKey',
      'keybase.1.loginUi.getEmailOrUsername',
      'keybase.1.provisionUi.chooseGPGMethod',
      'keybase.1.provisionUi.switchToGPGSignOK',
    ]) {
      await expect(push(method, {}, 0)).resolves.toEqual({error: inputCanceled})
    }
    expect(nav.navigations()).toEqual([])
  })

  test('the reset prompt during login is answered nothing, once', async () => {
    await startLogin()
    await expect(
      push('keybase.1.loginUi.promptResetAccount', {prompt: {t: T.RPCGen.ResetPromptType.enterNoDevices}}, 0)
    ).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
    expect(nav.navigations()).toEqual([])
  })

  test('the primary paper key notice and the success notices show nothing', async () => {
    await startLogin()
    await push('keybase.1.loginUi.displayPrimaryPaperKey', {phrase: 'a b c'}, 0)
    await push('keybase.1.provisionUi.ProvisionerSuccess', {deviceName: 'dev1', deviceType: 'mobile'}, 0)
    expect(nav.navigations()).toEqual([])
  })
})

describe('account changes', () => {
  // The login logs out first; the run lives outside the stores the logout resets
  test('a logout keeps the login run answerable', async () => {
    const {setLoggedIn} = useConfigState.getState().dispatch
    setLoggedIn(true)
    const held = await startLogin()
    const password = pushPassword(0)
    await settle()

    setLoggedIn(false)
    await settle()
    submitProvisionPassphrase('hunter2')

    await expect(password).resolves.toEqual({result: {passphrase: 'hunter2', storeSecret: false}})
    held[0]!.reply(undefined)
    await settle()
  })

  // The switch cancels the login's session, and a cancel ends the run quietly
  test('an account switch mid-login refuses the prompt and ends the run, showing nothing', async () => {
    const logError = jest.spyOn(logger, 'error')
    const {setUserSwitching} = useConfigState.getState().dispatch
    const held = await startLogin()
    const password = pushPassword(0)
    await settle()
    nav.clearActions()

    setUserSwitching(true, 'testuser2')
    await settle()
    setUserSwitching(false)

    // the session was cancelled: its prompt and the service's next one are refused
    await expect(password).resolves.toEqual({error: inputCanceled})
    expect(fake.engine._sessionsMap.get(sessionOf(0))?.isRefusing()).toBe(true)
    await expect(pushPassword(0)).resolves.toEqual({error: inputCanceled})
    // and the run is over: a submit starts nothing
    submitProvisionPassphrase('hunter2')
    await settle()
    expect(held).toHaveLength(1)
    // the service's reply settles the session
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
    expect(fake.engine._sessionsMap.has(sessionOf(0))).toBe(false)
    expect(nav.modalsCleared()).toBe(false)
    expect(nav.navigations()).toEqual([])
    expect(logError).not.toHaveBeenCalled()
  })
})

describe('add device', () => {
  const startAdd = async (otherDeviceType: 'desktop' | 'mobile' = 'mobile') => {
    startAddNewDevice(otherDeviceType)
    await tick()
  }
  const addSession = (attempt: number) =>
    fake.calls.filter(c => c.method === deviceAdd)[attempt]!.params.sessionID as number
  const pushAdd = async (method: string, params: object, attempt = 0) =>
    fake.push(method, params, {sessionID: addSession(attempt)})

  test('the device type is answered from the button the user picked', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd('desktop')
    await expect(
      pushAdd('keybase.1.provisionUi.chooseDeviceType', {kind: T.RPCGen.ChooseType.newDevice}, 0)
    ).resolves.toEqual({result: T.RPCGen.DeviceType.desktop})
    held[0]!.reply(undefined)
    await settle()

    await startAdd('mobile')
    await expect(
      pushAdd('keybase.1.provisionUi.chooseDeviceType', {kind: T.RPCGen.ChooseType.newDevice}, 1)
    ).resolves.toEqual({result: T.RPCGen.DeviceType.mobile})
    held[1]!.reply(undefined)
    await settle()
  })

  test('the secret prompt shows the code page and the typed code answers it, normalized', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd()
    const answered = pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    expect(nav.navigations()).toEqual([
      {
        name: 'codePage',
        params: {error: undefined, otherDevice: expect.objectContaining({name: '', type: 'mobile'}), textCode: 'one two three'},
        replace: false,
      },
    ])
    submitProvisionTextCode('  one,two\n\nthree  ')
    await expect(answered).resolves.toEqual({result: {phrase: 'one two three', secret: null}})

    await pushAdd('keybase.1.provisionUi.ProvisionerSuccess', {deviceName: 'phone', deviceType: 'mobile'}, 0)
    held[0]!.reply(undefined)
    await settle()
    expect(nav.modalsCleared()).toBe(true)
  })

  test('a previous error replaces the code page', async () => {
    fake.hold(deviceAdd)
    await startAdd()
    void pushAdd(secret, {phrase: 'four five six', previousErr: 'nope'}, 0)
    await settle()
    expect(nav.navigations()).toEqual([
      expect.objectContaining({name: 'codePage', params: expect.objectContaining({error: 'nope'}), replace: true}),
    ])
  })

  test('a cancelled add-device run does not clear modals out from under a retry', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd()
    const answered1 = pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    expect(nav.navigations()).toContainEqual(expect.objectContaining({name: 'codePage', replace: false}))

    // the user cancels, then tries again: the dead run must not clear modals or eat the new run's UI
    startAddNewDevice('mobile')
    await expect(answered1).resolves.toEqual({error: inputCanceled})
    await settle()
    expect(nav.modalsCleared()).toBe(false)
    expect(held).toHaveLength(2)
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
    expect(nav.modalsCleared()).toBe(false)

    nav.clearActions()
    const answered2 = pushAdd(secret, {phrase: 'four five six', previousErr: ''}, 1)
    await settle()
    expect(nav.navigations()).toContainEqual(expect.objectContaining({name: 'codePage', replace: false}))
    submitProvisionTextCode('four five six')
    await expect(answered2).resolves.toEqual({result: {phrase: 'four five six', secret: null}})

    held[1]!.reply(undefined)
    await settle()
    // the successful run still clears modals when it finishes
    expect(nav.modalsCleared()).toBe(true)
  })

  test('cancel before any prompt kills the RPC at its first prompt', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd()

    // user cancels while the service is still working, before any prompt
    cancelProvision()

    await expect(pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)).resolves.toEqual({
      error: inputCanceled,
    })
    expect(nav.navigations()).toEqual([])

    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
    expect(nav.modalsCleared()).toBe(false)
  })

  test('pause is a full cancel', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd()
    const answered = pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()

    pauseProvision()
    await expect(answered).resolves.toEqual({error: inputCanceled})
    // nothing to resume: a code submitted now answers nothing
    submitProvisionTextCode('one two three')
    await settle()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
    expect(held).toHaveLength(1)
    expect(nav.modalsCleared()).toBe(false)
  })

  // A cancel shows no error; only the run's own end leaves the modals up
  test.each([
    [T.RPCGen.StatusCode.sccanceled, 'Received RPC cancel for session'],
    [T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'],
  ])('a cancel from the service (%s) ends quietly and closes the modals', async (code, desc) => {
    const logError = jest.spyOn(logger, 'error')
    const held = fake.hold(deviceAdd)
    await startAdd()
    held[0]!.reply(fakeError(code, desc))
    await settle()
    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations()).toEqual([])
    expect(logError).not.toHaveBeenCalled()
  })

  test('a lost service connection closes the modals', async () => {
    fake.hold(deviceAdd)
    await startAdd()
    const answered = pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    fake.drop()
    await answered
    await settle()
    expect(nav.modalsCleared()).toBe(true)
  })

  // As login: the exception goes to the log, the user sees a generic message
  test('a code page that throws while showing refuses the prompt and ends on the error screen', async () => {
    const logError = jest.spyOn(logger, 'error')
    fake.hold(deviceAdd)
    await startAdd()
    const thrown = new Error('no navigator')
    const navigate = jest.spyOn(Router, 'navigateAppend').mockImplementationOnce(() => {
      throw thrown
    })
    try {
      await expect(pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)).resolves.toEqual({
        error: inputCanceled,
      })
      await settle()
    } finally {
      navigate.mockRestore()
    }
    expect(logError).toHaveBeenCalledWith(`Provision: showing ${secret} failed`, thrown)
    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations()).toEqual([
      {
        name: 'error',
        params: {
          error: expect.objectContaining({
            code: T.RPCGen.StatusCode.scgeneric,
            desc: 'Something went wrong. Please try again.',
          }),
          username: undefined,
        },
        replace: false,
      },
    ])
  })

  test('a failure clears modals and shows nothing else', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'kex failed'))
    await settle()
    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations()).toEqual([])
  })

  test('the service cancelling the secret prompt, then the provisioner success, closes the modals', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd()
    const shown = pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    fake.cancelPush(secret)
    await shown
    await settle()
    await pushAdd('keybase.1.provisionUi.ProvisionerSuccess', {deviceName: 'phone', deviceType: 'mobile'}, 0)
    submitProvisionTextCode('one two three')
    held[0]!.reply(undefined)
    await settle()
    expect(nav.modalsCleared()).toBe(true)
  })

  test('a retried secret after the exchange shows waiting off', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd()
    const count = () => {
      fake.engine._throttledDispatchWaitingAction.flush()
      return useWaitingState.getState().counts.get(waitingKeyProvision)
    }
    void pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    await pushAdd(secretExchanged, {})
    await pushAdd(secretExchanged, {})
    await settle()
    expect(count()).toBe(1)
    void pushAdd(secret, {phrase: 'one two three', previousErr: 'bad code'}, 0)
    await settle()
    expect(count()).toBeUndefined()
    held[0]!.reply(undefined)
    await settle()
    expect(count()).toBeUndefined()
  })

  test('secret-exchange progress holds the provision waiting key until the run ends', async () => {
    const held = fake.hold(deviceAdd)
    await startAdd()
    const count = () => {
      fake.engine._throttledDispatchWaitingAction.flush()
      return useWaitingState.getState().counts.get(waitingKeyProvision)
    }
    const shown = pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()
    // The secret prompt is the GUI's, until Go says it is working on the exchange
    expect(count()).toBeUndefined()
    await pushAdd(secretExchanged, {})
    await pushAdd(secretExchanged, {})
    await settle()
    expect(count()).toBe(1)
    submitProvisionTextCode('one two three')
    await shown
    expect(count()).toBe(1)
    held[0]!.reply(undefined)
    await settle()
    expect(count()).toBeUndefined()

    await startAdd()
    await pushAdd(secretExchanged, {}, 1)
    await settle()
    expect(count()).toBe(1)
    cancelProvision()
    await settle()
    expect(count()).toBeUndefined()

    // the service sends one and then fails, before the GUI's handler ran
    await startAdd()
    void pushAdd(secretExchanged, {}, 2)
    held[2]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'kex failed'))
    await settle()
    await settle()
    expect(count()).toBeUndefined()
  })

  test('a logout ends the run: its prompt is refused and it closes nothing', async () => {
    const {setLoggedIn} = useConfigState.getState().dispatch
    setLoggedIn(true)
    const held = fake.hold(deviceAdd)
    await startAdd()
    const answered = pushAdd(secret, {phrase: 'one two three', previousErr: ''}, 0)
    await settle()

    setLoggedIn(false)
    await expect(answered).resolves.toEqual({error: inputCanceled})
    submitProvisionTextCode('one two three')
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await settle()
    expect(nav.modalsCleared()).toBe(false)
  })

  test('starting add-device ends a running login', async () => {
    const held = await startLogin()
    const password = pushPassword(0)
    await settle()
    fake.hold(deviceAdd)
    await startAdd()
    await expect(password).resolves.toEqual({error: inputCanceled})
    // its submits now reach nothing
    submitProvisionPassphrase('hunter2')
    await settle()
    expect(held).toHaveLength(1)
  })
})
