/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {getCallPort, installCallPort, uninstallCallPort} from '@/engine/call-port'
import {useConfigState} from '@/stores/config'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {settle, tick} from '@/test/flush'

const mockStartProvision = jest.fn()

jest.mock('@/provision/flow', () => ({
  startProvision: (...args: Array<unknown>) => mockStartProvision(...args),
}))

import {installFakeNavigator, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {
  declineResetPrompt,
  enterResetPipeline,
  resetRunEnded,
  startAccountReset,
  submitResetPrompt,
} from './account-reset'

const pipeline = 'keybase.1.account.enterResetPipeline'
const promptReset = 'keybase.1.loginUi.promptResetAccount'
const resetProgress = 'keybase.1.loginUi.displayResetProgress'
const completePrompt = (hasWallet: boolean) => ({
  prompt: {complete: {hasWallet}, t: T.RPCGen.ResetPromptType.complete},
})
const loginPopTo = expect.objectContaining({payload: {name: 'login'}, type: 'POP_TO'})

let nav: FakeNavigator

beforeEach(() => {
  nav = installFakeNavigator()
})

afterEach(() => {
  restoreNavigator()
  mockStartProvision.mockReset()
  resetAllStores()
})

const start = async (p?: {
  onEngineIncoming?: () => void
  onError?: (e: string) => void
  password?: string
}) => {
  const fake = installFakeEngine({onEngineIncoming: p?.onEngineIncoming})
  const held = fake.hold(pipeline)
  enterResetPipeline({onError: p?.onError, password: p?.password, username: 'testuser'})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  return {fake, held, sessionID}
}

// The confirm screen is handed the prompt's id, and the only way to learn it is to read the params
// the flow navigated with
const lastPromptId = () => (nav.navigations().at(-1)?.params as {promptId?: number} | undefined)?.promptId ?? -1

// Pushes the final prompt and returns its id from the confirm screen's params
const showConfirm = async (s: Awaited<ReturnType<typeof start>>, hasWallet = false) => {
  const answered = s.fake.push(promptReset, completePrompt(hasWallet), {sessionID: s.sessionID})
  await settle()
  return {answered, promptId: lastPromptId()}
}

test('startAccountReset navigates into the reset flow', () => {
  startAccountReset(true, 'testuser')

  expect(nav.navigations()).toContainEqual({
    name: 'recoverPasswordPromptResetAccount',
    params: {skipPassword: true, username: 'testuser'},
    replace: true,
  })
})

test('it starts the pipeline non-interactively with the username and password', async () => {
  const {fake, held} = await start({password: 'hunter2'})
  expect(fake.calls[0]!.method).toBe(pipeline)
  expect(fake.calls[0]!.params).toMatchObject({
    interactive: false,
    passphrase: 'hunter2',
    usernameOrEmail: 'testuser',
  })
  held[0]!.reply(undefined)
  await settle()
})

test('the final prompt shows the confirm screen, and confirming answers it and starts provision', async () => {
  const s = await start()
  const {answered, promptId} = await showConfirm(s, true)
  expect(nav.navigations()).toContainEqual({
    name: 'resetConfirm',
    params: {hasWallet: true, promptId},
    replace: true,
  })
  expect(mockStartProvision).not.toHaveBeenCalled()

  expect(submitResetPrompt(promptId, T.RPCGen.ResetPromptResponse.confirmReset)).toBe(true)

  await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.confirmReset})
  expect(mockStartProvision).toHaveBeenCalledWith('testuser', true)
  expect(nav.actions).not.toContainEqual(loginPopTo)
  s.held[0]!.reply(undefined)
  await settle()
})

test.each([T.RPCGen.ResetPromptResponse.cancelReset, T.RPCGen.ResetPromptResponse.nothing])(
  'answering the confirm screen with %s goes back to login',
  async action => {
    const s = await start()
    const {answered, promptId} = await showConfirm(s)

    submitResetPrompt(promptId, action)

    await expect(answered).resolves.toEqual({result: action})
    expect(nav.actions).toContainEqual(loginPopTo)
    expect(mockStartProvision).not.toHaveBeenCalled()
    s.held[0]!.reply(undefined)
    await settle()
  }
)

test('the confirm screen answers once; a second submit does nothing', async () => {
  const s = await start()
  const {answered, promptId} = await showConfirm(s)

  submitResetPrompt(promptId, T.RPCGen.ResetPromptResponse.nothing)
  submitResetPrompt(promptId, T.RPCGen.ResetPromptResponse.confirmReset)

  await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
  expect(mockStartProvision).not.toHaveBeenCalled()
  expect(nav.actions.filter(a => a.type === 'POP_TO')).toHaveLength(1)
  s.held[0]!.reply(undefined)
  await settle()
})

test('a submit for an unknown prompt id does nothing', async () => {
  const s = await start()
  const {answered, promptId} = await showConfirm(s)

  submitResetPrompt(promptId + 1000, T.RPCGen.ResetPromptResponse.confirmReset)
  await settle()

  expect(mockStartProvision).not.toHaveBeenCalled()
  expect(nav.actions).not.toContainEqual(loginPopTo)
  submitResetPrompt(promptId, T.RPCGen.ResetPromptResponse.nothing)
  await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
  s.held[0]!.reply(undefined)
  await settle()
})

test('a non-final prompt is answered nothing and starts the reset flow', async () => {
  const {fake, held, sessionID} = await start()

  const answered = fake.push(promptReset, {prompt: {t: T.RPCGen.ResetPromptType.enterNoDevices}}, {sessionID})

  await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
  expect(nav.navigations()).toContainEqual({
    name: 'recoverPasswordPromptResetAccount',
    params: {skipPassword: true, username: 'testuser'},
    replace: true,
  })
  held[0]!.reply(undefined)
  await settle()
})

test('once the pipeline ends, the confirm screen answer does nothing', async () => {
  const s = await start()
  const {promptId} = await showConfirm(s)

  s.held[0]!.reply(undefined)
  await settle()

  expect(submitResetPrompt(promptId, T.RPCGen.ResetPromptResponse.confirmReset)).toBe(false)

  expect(mockStartProvision).not.toHaveBeenCalled()
  expect(nav.actions).not.toContainEqual(loginPopTo)
})

test('a logout leaves the pipeline running, so the confirm screen still answers it', async () => {
  const s = await start()
  const {answered, promptId} = await showConfirm(s)

  const {setLoggedIn} = useConfigState.getState().dispatch
  setLoggedIn(true)
  setLoggedIn(false)
  await settle()

  submitResetPrompt(promptId, T.RPCGen.ResetPromptResponse.confirmReset)

  await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.confirmReset})
  expect(mockStartProvision).toHaveBeenCalledWith('testuser', true)
  s.held[0]!.reply(undefined)
  await settle()
})

test('the service message falls through to the global handler', async () => {
  const onEngineIncoming = jest.fn()
  const {fake, held, sessionID} = await start({onEngineIncoming})
  await fake.push('keybase.1.loginUi.displayResetMessage', {kind: 0}, {sessionID})
  expect(onEngineIncoming).toHaveBeenCalledWith(
    expect.objectContaining({type: 'keybase.1.loginUi.displayResetMessage'})
  )
  held[0]!.reply(undefined)
  await settle()
})

test('reset progress before verification shows the check-your-email screen', async () => {
  const {fake, held, sessionID} = await start()
  await fake.push(resetProgress, {endTime: 1700000000, needVerify: true, text: ''}, {sessionID})
  await settle()

  expect(nav.navigations()).toContainEqual({
    name: 'resetWaiting',
    params: {endTime: undefined, pipelineStarted: false, username: 'testuser'},
    replace: true,
  })
  held[0]!.reply(undefined)
  await settle()
})

test('reset progress after verification passes the countdown end time in milliseconds', async () => {
  const {fake, held, sessionID} = await start()
  await fake.push(resetProgress, {endTime: 1700000000, needVerify: false, text: ''}, {sessionID})
  await settle()

  expect(nav.navigations()).toContainEqual({
    name: 'resetWaiting',
    params: {endTime: 1700000000000, pipelineStarted: true, username: 'testuser'},
    replace: true,
  })
  held[0]!.reply(undefined)
  await settle()
})

test('an rpc failure clears then reports the error to the caller', async () => {
  const onError = jest.fn()
  const {held} = await start({onError})
  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scbadloginpassword, 'nope'))
  await settle()

  expect(onError).toHaveBeenNthCalledWith(1, '')
  expect(onError).toHaveBeenLastCalledWith('nope')
})

test.each([T.RPCGen.StatusCode.sccanceled, T.RPCGen.StatusCode.scinputcanceled])(
  'a cancel from the service (%s) is not reported as an error',
  async code => {
    const onError = jest.fn()
    const {held} = await start({onError})
    held[0]!.reply(fakeError(code, 'canceled'))
    await settle()

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('')
  }
)

test('an account switch cancels the pipeline without reporting an error', async () => {
  const onError = jest.fn()
  const s = await start({onError})
  const {answered} = await showConfirm(s)

  getCallPort().cancelOutstandingSessions()
  await settle()

  await expect(answered).resolves.toMatchObject({error: {code: T.RPCGen.StatusCode.scinputcanceled}})
  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledWith('')
  s.held[0]!.reply(undefined)
  await settle()
})

test('a non-rpc failure is not reported as a user facing error', async () => {
  // The service only fails with RPCErrors, so a port stands in for a listener failing some other way
  installCallPort({
    call: () => 0,
    cancelOutstandingSessions: () => {},
    listen: async () => Promise.reject(new Error('boom')),
  })
  const onError = jest.fn()
  try {
    enterResetPipeline({onError, username: 'testuser'})
    await settle()
  } finally {
    uninstallCallPort()
  }

  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledWith('')
})

test('declining the confirm prompt answers it nothing without navigating', async () => {
  const s = await start()
  const {answered, promptId} = await showConfirm(s)
  nav.clearActions()

  declineResetPrompt(promptId)
  declineResetPrompt(promptId)

  await expect(answered).resolves.toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
  expect(nav.actions).toEqual([])
  s.held[0]!.reply(undefined)
  await settle()
})

test("the confirm prompt's pipeline end is there while the prompt is open, and settles when the pipeline does", async () => {
  const s = await start()
  const {promptId} = await showConfirm(s)
  const ended = resetRunEnded(promptId)
  expect(ended).toBeDefined()
  expect(resetRunEnded(promptId + 1000)).toBeUndefined()

  s.held[0]!.reply(undefined)

  await expect(ended).resolves.toBeUndefined()
  expect(resetRunEnded(promptId)).toBeUndefined()
})
