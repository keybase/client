/// <reference types="jest" />
// What each error the client produces or receives looks like to the code that catches it: its code
// and desc, and the kind that says why the call failed.
import * as T from '@/constants/types'
import {errors} from './rpc-transport'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {isErrorTransient, RPCError} from '@/util/errors'
import {openDialog} from './dialog'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
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

// The waiting key records a service error or a lost link, never a cancel, whichever side made it: the
// service often fails an RPC with the refusal the client wrote on one of its prompts.
describe('what a reply records on its waiting key', () => {
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

  test('the echo of a refused prompt: cancelled by the service, and nothing recorded', async () => {
    const {cancel, dialog, fake, held, pushed} = await openRecover()
    expect(cancel()).toBe(true)
    expect(await pushed).toEqual({error: inputCanceled})
    held[0]!.reply(fakeError(inputCanceled.code, inputCanceled.desc))
    expect(kindOf(await rejection(dialog.done))).toEqual(byService)
    expect(keyError(fake)).toBeUndefined()
    uninstallFakeEngine()
  })

  test.each([
    ['sccanceled', T.RPCGen.StatusCode.sccanceled],
    ['scinputcanceled', T.RPCGen.StatusCode.scinputcanceled],
  ])("the service's own %s: cancelled by the service, and nothing recorded", async (_, code) => {
    const {dialog, fake, held} = await openRecover()
    held[0]!.reply(fakeError(code, 'cancelled'))
    expect(kindOf(await rejection(dialog.done))).toEqual(byService)
    expect(keyError(fake)).toBeUndefined()
    uninstallFakeEngine()
  })

  test('a service error is recorded', async () => {
    const {dialog, fake, held} = await openRecover()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scnotfound, 'no such user'))
    expect(kindOf(await rejection(dialog.done))).toEqual({type: 'service'})
    expect(keyError(fake)).toMatchObject({code: T.RPCGen.StatusCode.scnotfound})
    uninstallFakeEngine()
  })
})

describe('telling errors apart', () => {
  test('a client cancel and an account-switch cancel are told apart', async () => {
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

  test("the service's assertion-parse error (code 101) is not read as a lost link", async () => {
    const fake = installFakeEngine()
    fake.answer('keybase.1.config.getBootstrapStatus', () =>
      fakeError(T.RPCGen.StatusCode.scassertionparseerror, 'bad assertion')
    )
    const e = await rejection(T.RPCGen.configGetBootstrapStatusRpcPromise())
    expect(e.code).toBe(T.RPCGen.StatusCode.scassertionparseerror)
    expect(isErrorTransient(e)).toBe(false)
    uninstallFakeEngine()
  })

  test('ignorePromise does not log a cancel as an error', async () => {
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
