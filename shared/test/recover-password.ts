// Drives a password recovery run (keybase.1.login.recoverPassphrase) on the fake engine, with the
// app's real flow, engine listener and session in between. For act environments: each turn runs
// inside act so React commits what the flow navigated to.
import * as T from '@/constants/types'
import {act} from '@testing-library/react'
import {startRecoverPassword, submitRecoverPasswordPaperKey} from '@/login/recover-password/flow'
import type {FakeEngine} from './fake-engine'
import {settle} from './flush'

export const recover = 'keybase.1.login.recoverPassphrase'
export const pgpWarning = 'recoverPasswordPgpWarning'
export const setPassword = 'recoverPasswordSetPassword'

// The session read after a failed run finds Go logged out, as it does after a failure.
export const answerLoggedOut = (fake: FakeEngine) =>
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({
    deviceID: '',
    deviceName: '',
    fullname: '',
    loggedIn: false,
    registered: true,
    uid: '',
    userReacjis: {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: []},
    username: '',
  }))

// The service's messages cross IPC and the listener hands them to the flow on a timer.
export const flush = async (turns = 3) => {
  for (let i = 0; i < turns; i++) {
    await act(async () => settle())
  }
}

// Starts a run and holds its reply; push sends Go's prompts into this run's session.
export const startRun = async (
  fake: FakeEngine,
  start: () => void = () => startRecoverPassword({username: 'testuser'})
) => {
  const held = fake.hold(recover)
  act(start)
  await flush()
  const sessionID = fake.calls.filter(c => c.method === recover).at(-1)!.params.sessionID as number
  const push = async (method: string, params: object) => fake.push(method, params, {sessionID})
  return {push, reply: held.at(-1)!.reply}
}

export type Push = Awaited<ReturnType<typeof startRun>>['push']

// Go asks for the paper key and the user submits it; resolves to the answer Go gets.
export const answerPaperKey = async (push: Push) => {
  const answer = push('keybase.1.secretUi.getPassphrase', {
    pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.paperKey},
  })
  await flush()
  act(() => submitRecoverPasswordPaperKey('one two three'))
  await flush()
  return answer
}

// Go asks; the answer settles once the GUI answers, so it is handed back in a box, not awaited here.
const ask = async (push: Push, method: string, params: object) => {
  const answer = push(method, params)
  await flush()
  return {answer}
}
export const askPgp = async (push: Push) =>
  ask(push, 'keybase.1.loginUi.promptPassphraseRecovery', {
    kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys,
  })
export const askNewPassword = async (push: Push) =>
  ask(push, 'keybase.1.secretUi.getPassphrase', {
    pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase},
  })
