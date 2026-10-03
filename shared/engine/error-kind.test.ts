/// <reference types="jest" />
// What each error the client produces or receives looks like to the code that catches it: its code
// and desc, and the kind that says why the call failed.
import * as T from '@/constants/types'
import {errors} from './rpc-transport'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {isErrorTransient, RPCError} from '@/util/errors'
import {openDialog} from './dialog'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyConfigLogin} from '@/constants/waiting-keys'
import {ignorePromise} from '@/constants/utils'
import {resetAllStores} from '@/util/zustand'
import {tick} from '@/test/flush'
import logger from '@/logger'
import {testWaitingKey} from '@/test/waiting-key'

afterEach(() => {
  jest.restoreAllMocks()
  // The store reset keeps an in-progress switch, and a later test's switch would not start
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

const rejection = async (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error('expected a rejection')
    },
    (e: unknown) => e as RPCError
  )

// The listener hands incoming calls to their handlers on a timer
const afterTimers = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

const kindOf = (e: unknown) => (e as {kind?: unknown}).kind
const byCaller = {reason: 'caller', type: 'cancelled'}
const byAccountChange = {reason: 'accountChange', type: 'cancelled'}
const byDisconnect = {reason: 'disconnect', type: 'cancelled'}
const byService = {reason: 'service', type: 'cancelled'}

const recoverListener = (fake: FakeEngine) => {
  const held = fake.hold('keybase.1.login.recoverPassphrase')
  let cancel = () => {}
  const p = T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {},
    incomingCallMap: {},
    onSessionCreated: c => {
      cancel = c
    },
    params: {username: 'testuser'},
  })
  return {cancel: () => cancel(), held, p}
}

describe('the code, desc and kind of each error the client makes', () => {
  test('P1: a client cancel of a session', async () => {
    const fake = installFakeEngine()
    const {cancel, p} = recoverListener(fake)
    await tick()
    cancel()
    expect(await rejection(p)).toMatchObject({
      code: T.RPCGen.StatusCode.sccanceled,
      desc: 'Received RPC cancel for session',
      kind: byCaller,
    })
    uninstallFakeEngine()
  })

  test('P2: the account-switch cancel', async () => {
    const fake = installFakeEngine()
    fake.hold('keybase.1.user.loadMySettings')
    useConfigState.getState().dispatch.setLoggedIn(true)
    const p = T.RPCGen.userLoadMySettingsRpcPromise()
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    expect(await rejection(p)).toMatchObject({
      code: T.RPCGen.StatusCode.sccanceled,
      desc: 'Received RPC cancel for session',
      kind: byAccountChange,
    })
    uninstallFakeEngine()
  })

  test('P3: a reply that lands after the account changed', async () => {
    const fake = installFakeEngine()
    useConfigState.getState().dispatch.setLoggedIn(true)
    // A background session, which the switch's cancel leaves running
    const held = fake.hold('keybase.1.SimpleFS.simpleFSUserEditHistory')
    const p = T.RPCGen.SimpleFSSimpleFSUserEditHistoryRpcPromise()
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    held[0]!.reply({folders: []})
    expect(await rejection(p)).toMatchObject({
      code: T.RPCGen.StatusCode.sccanceled,
      desc: 'The account changed during this call',
      kind: byAccountChange,
    })
    uninstallFakeEngine()
  })

  test('P4: a call in flight when the link drops', async () => {
    const fake = installFakeEngine()
    fake.hold('keybase.1.config.getBootstrapStatus')
    const p = T.RPCGen.configGetBootstrapStatusRpcPromise()
    fake.drop()
    expect(await rejection(p)).toMatchObject({code: errors.EOF, desc: 'The service connection was lost', kind: byDisconnect, name: 'EOF'})
    uninstallFakeEngine()
  })

  test('P5: a call made while the link is lost', async () => {
    const fake = installFakeEngine()
    fake.drop()
    const p = T.RPCGen.configGetBootstrapStatusRpcPromise()
    expect(await rejection(p)).toMatchObject({code: errors.EOF, desc: 'The service connection was lost', kind: byDisconnect, name: 'EOF'})
    uninstallFakeEngine()
  })

  test('P6: a call in flight when the transport closes', async () => {
    const fake = installFakeEngine()
    fake.hold('keybase.1.config.getBootstrapStatus')
    const p = T.RPCGen.configGetBootstrapStatusRpcPromise()
    fake.engine._rpcClient.transport.close()
    expect(await rejection(p)).toMatchObject({code: errors.EOF, desc: 'EOF from server', kind: byDisconnect, name: 'EOF'})
    uninstallFakeEngine()
  })

  test('P9: a Dialog disposed', async () => {
    const fake = installFakeEngine()
    fake.hold('keybase.1.login.recoverPassphrase')
    const dialog = openDialog('keybase.1.login.recoverPassphrase', {username: 'testuser'}, {prompts: []})
    await tick()
    dialog.dispose()
    expect(await rejection(dialog.done)).toMatchObject({
      code: T.RPCGen.StatusCode.sccanceled,
      desc: 'Dialog disposed',
      kind: byCaller,
    })
    uninstallFakeEngine()
  })

  test('P9 on an account switch: a Dialog the switch disposes is cancelled by the account change', async () => {
    const fake = installFakeEngine()
    fake.hold('keybase.1.pgp.pgpKeyGenDefault')
    useConfigState.getState().dispatch.setLoggedIn(true)
    const dialog = openDialog('keybase.1.pgp.pgpKeyGenDefault', {createUids: {ids: [], useDefault: true}}, {prompts: []})
    await tick()
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    expect(await rejection(dialog.done)).toMatchObject({desc: 'Dialog disposed', kind: byAccountChange})
    uninstallFakeEngine()
  })

  test("a listener's session cancelled for an account change says so", async () => {
    const fake = installFakeEngine()
    fake.hold('keybase.1.login.recoverPassphrase')
    let cancel: (reason?: 'caller' | 'accountChange') => void = () => {}
    const p = T.RPCGen.loginRecoverPassphraseRpcListener({
      customResponseIncomingCallMap: {},
      incomingCallMap: {},
      onSessionCreated: c => {
        cancel = c
      },
      params: {username: 'testuser'},
    })
    await tick()
    cancel('accountChange')
    expect(kindOf(await rejection(p))).toEqual(byAccountChange)
    uninstallFakeEngine()
  })

  test("a listener rejects with an Error carrying the service error's code and desc, and the RPCError as its cause", async () => {
    const fake = installFakeEngine()
    const {held, p} = recoverListener(fake)
    await tick()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scnotfound, 'no such user'))
    const e = await rejection(p)
    expect(e).toBeInstanceOf(Error)
    expect(e).toMatchObject({code: T.RPCGen.StatusCode.scnotfound, desc: 'no such user', kind: {type: 'service'}})
    expect((e as unknown as Error).cause).toBeInstanceOf(RPCError)
    uninstallFakeEngine()
  })

  test("a Dialog's done rejects with the RPCError itself", async () => {
    const fake = installFakeEngine()
    const held = fake.hold('keybase.1.login.recoverPassphrase')
    const dialog = openDialog('keybase.1.login.recoverPassphrase', {username: 'testuser'}, {prompts: []})
    await tick()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scnotfound, 'no such user'))
    const e = await rejection(dialog.done)
    expect(e).toBeInstanceOf(RPCError)
    expect(e).toMatchObject({code: T.RPCGen.StatusCode.scnotfound, desc: 'no such user', kind: {type: 'service'}})
    uninstallFakeEngine()
  })
})

// The service fails an RPC with the refusal it read on one of its prompts. The session knows what it
// wrote, so that echo is the client's own cancel; any other cancel code is the service's.
describe('a reply that echoes a refusal the client wrote', () => {
  const rpc = 'keybase.1.login.recoverPassphrase'
  const choose = 'keybase.1.loginUi.chooseDeviceToRecoverWith'
  const waitingKey = testWaitingKey('error-kind-test')
  const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
  const keyError = (fake: FakeEngine) => {
    fake.engine._throttledDispatchWaitingAction.flush()
    return useWaitingState.getState().errors.get(waitingKey)
  }

  const openRecover = async () => {
    const fake = installFakeEngine()
    const held = fake.hold(rpc)
    const dialog = openDialog(rpc, {username: 'testuser'}, {prompts: [choose], waitingKey})
    await tick()
    const sessionID = fake.calls[0]!.params.sessionID as number
    const pushed = fake.push(choose, {devices: []}, {sessionID})
    await afterTimers()
    const prompt = dialog.openPrompt(choose)
    expect(prompt).toBeDefined()
    return {cancel: () => prompt?.cancel(), dialog, fake, held, pushed}
  }

  test('a cancelled prompt: cancelled by the caller, and nothing recorded on the key', async () => {
    const {cancel, dialog, fake, held, pushed} = await openRecover()
    expect(cancel()).toBe(true)
    expect(await pushed).toEqual({error: inputCanceled})
    held[0]!.reply(fakeError(inputCanceled.code, inputCanceled.desc))
    expect(kindOf(await rejection(dialog.done))).toEqual(byCaller)
    expect(keyError(fake)).toBeUndefined()
    uninstallFakeEngine()
  })

  test('the same code and desc with no refusal written: cancelled by the service, and recorded', async () => {
    const {dialog, fake, held} = await openRecover()
    held[0]!.reply(fakeError(inputCanceled.code, inputCanceled.desc))
    expect(kindOf(await rejection(dialog.done))).toEqual(byService)
    expect(keyError(fake)).toMatchObject(inputCanceled)
    uninstallFakeEngine()
  })

  test('a reply that differs from the refusal in its desc is not ours', async () => {
    const {cancel, dialog, held} = await openRecover()
    expect(cancel()).toBe(true)
    held[0]!.reply(fakeError(inputCanceled.code, 'Input canceled due to skip secret prompt'))
    expect(kindOf(await rejection(dialog.done))).toEqual(byService)
    uninstallFakeEngine()
  })

  test('a reply that differs from the refusal in its code is not ours', async () => {
    const {cancel, dialog, held} = await openRecover()
    expect(cancel()).toBe(true)
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, inputCanceled.desc))
    expect(kindOf(await rejection(dialog.done))).toEqual({type: 'service'})
    uninstallFakeEngine()
  })

  // The service moved on past the refusal, so a later failure with the same code and desc is its own
  test.each([
    ['answered', true],
    ['only surfaced', false],
  ])('a refusal followed by a later prompt %s is not what the RPC fails with', async (_, answer) => {
    const {cancel, dialog, fake, held} = await openRecover()
    expect(cancel()).toBe(true)
    const sessionID = fake.calls[0]!.params.sessionID as number
    const later = fake.push(choose, {devices: []}, {sessionID})
    await afterTimers()
    if (answer) {
      expect(dialog.openPrompt(choose)?.answer('') ?? false).toBe(true)
      await expect(later).resolves.toEqual({result: ''})
    }
    held[0]!.reply(fakeError(inputCanceled.code, inputCanceled.desc))
    expect(kindOf(await rejection(dialog.done))).toEqual(byService)
    uninstallFakeEngine()
  })

  test('a refusal followed by an answer to a prompt that was already open is not what the RPC fails with', async () => {
    const {dialog, fake, held} = await openRecover()
    const sessionID = fake.calls[0]!.params.sessionID as number
    const second = fake.push(choose, {devices: []}, {sessionID})
    await afterTimers()
    const [first, other] = dialog.openPrompts()
    expect(first?.cancel()).toBe(true)
    expect(other?.answer('')).toBe(true)
    await expect(second).resolves.toEqual({result: ''})
    held[0]!.reply(fakeError(inputCanceled.code, inputCanceled.desc))
    expect(kindOf(await rejection(dialog.done))).toEqual(byService)
    uninstallFakeEngine()
  })

  test("a must-answer call with no handler is refused, and Go's 'Input canceled' echo is the caller's cancel", async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    const fake = installFakeEngine()
    const held = fake.hold(rpc)
    const callback = jest.fn()
    const sessionID = fake.engine.call({
      callback,
      // misconfigured: a call that needs an answer in the map that cannot give one
      incomingCallMap: {'keybase.1.secretUi.getPassphrase': () => {}} as never,
      method: rpc,
      params: {username: 'testuser'},
    })
    await tick()
    const pushed = fake.push('keybase.1.secretUi.getPassphrase', {pinentry: {}}, {sessionID})
    expect(await pushed).toEqual({
      error: {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'No handler for keybase.1.secretUi.getPassphrase'},
    })
    held[0]!.reply(fakeError(inputCanceled.code, inputCanceled.desc))
    await tick()
    expect(kindOf(callback.mock.calls[0]![0])).toEqual(byCaller)
    uninstallFakeEngine()
  })

  test("a handler that throws refuses its prompt, and the echo is the caller's cancel", async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    const fake = installFakeEngine()
    const held = fake.hold(rpc)
    const p = T.RPCGen.loginRecoverPassphraseRpcListener({
      customResponseIncomingCallMap: {
        [choose]: () => {
          throw new Error('handler broke')
        },
      },
      incomingCallMap: {},
      params: {username: 'testuser'},
    })
    await tick()
    const sessionID = fake.calls[0]!.params.sessionID as number
    const pushed = fake.push(choose, {devices: []}, {sessionID})
    await afterTimers()
    expect(await pushed).toEqual({error: inputCanceled})
    held[0]!.reply(fakeError(inputCanceled.code, inputCanceled.desc))
    expect(kindOf(await rejection(p))).toEqual(byCaller)
    uninstallFakeEngine()
  })
})

describe('known bugs', () => {
  // Fixed by the gating half (6b), which filters the switch's cancel by the survive flag
  test.failing('K1: a call that survives an account change is not cancelled when a switch starts', async () => {
    const fake = installFakeEngine()
    const held = fake.hold('keybase.1.login.getConfiguredAccounts')
    useConfigState.getState().dispatch.setLoggedIn(true)
    const p = T.RPCGen.loginGetConfiguredAccountsRpcPromise()
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    held[0]!.reply([])
    await expect(p).resolves.toEqual([])
    uninstallFakeEngine()
  })

  test('K2: a client cancel and an account-switch cancel are told apart', async () => {
    const fake = installFakeEngine()
    const {cancel, p} = recoverListener(fake)
    fake.hold('keybase.1.user.loadMySettings')
    await tick()
    cancel()
    const byCallerError = await rejection(p)
    useConfigState.getState().dispatch.setLoggedIn(true)
    const q = T.RPCGen.userLoadMySettingsRpcPromise()
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    const bySwitch = await rejection(q)
    expect(kindOf(byCallerError)).toEqual(byCaller)
    expect(kindOf(bySwitch)).toEqual(byAccountChange)
    uninstallFakeEngine()
  })

  test("K3: the service's assertion-parse error (code 101) is not read as a lost link", async () => {
    const fake = installFakeEngine()
    fake.answer('keybase.1.config.getBootstrapStatus', () =>
      fakeError(T.RPCGen.StatusCode.scassertionparseerror, 'bad assertion')
    )
    const e = await rejection(T.RPCGen.configGetBootstrapStatusRpcPromise())
    expect(e.code).toBe(T.RPCGen.StatusCode.scassertionparseerror)
    expect(isErrorTransient(e)).toBe(false)
    uninstallFakeEngine()
  })

  test("K4: config login's own refusal leaves no error on its waiting key", async () => {
    useDaemonState.setState(s => ({dispatch: {...s.dispatch, refreshSessionFromDaemon: () => {}}}))
    const fake = installFakeEngine()
    const held = fake.hold('keybase.1.login.login')
    useConfigState.getState().dispatch.login('testuser', 'password')
    await tick()
    const sessionID = fake.calls[0]!.params.sessionID as number
    const pushed = fake.push('keybase.1.provisionUi.chooseDevice', {devices: [], canSelectNoDevice: false}, {sessionID})
    await afterTimers()
    const refusal = {code: T.RPCGen.StatusCode.scgeneric, desc: 'Canceling RPC'}
    expect(await pushed).toEqual({error: refusal})
    // The service fails the login with the refusal it read
    held[0]!.reply(fakeError(refusal.code, refusal.desc))
    await afterTimers()
    fake.engine._throttledDispatchWaitingAction.flush()
    expect(useWaitingState.getState().counts.get(waitingKeyConfigLogin) ?? 0).toBe(0)
    expect(useWaitingState.getState().errors.get(waitingKeyConfigLogin)).toBeUndefined()
    uninstallFakeEngine()
  })

  test('K5: ignorePromise does not log a cancel as an error', async () => {
    const fake = installFakeEngine()
    fake.hold('keybase.1.user.loadMySettings')
    const logged = jest.spyOn(logger, 'error').mockImplementation(() => {})
    useConfigState.getState().dispatch.setLoggedIn(true)
    ignorePromise(
      (async () => {
        await T.RPCGen.userLoadMySettingsRpcPromise()
      })()
    )
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    await afterTimers()
    expect(logged).not.toHaveBeenCalled()
    uninstallFakeEngine()
  })
})
