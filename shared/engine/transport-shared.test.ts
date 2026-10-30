/// <reference types="jest" />
import {redactRpcParams} from './transport-shared'

const fixture = 'fixture-secret-9f3a'
const cases: Array<[string, unknown]> = [
  ['account.passphraseChange', {oldPassphrase: fixture, passphrase: fixture, force: false, sessionID: 1}],
  ['account.passphraseCheck', {passphrase: fixture, sessionID: 1}],
  ['login.accountDelete', {passphrase: fixture, sessionID: 1}],
  ['account.enterResetPipeline', {interactive: true, passphrase: fixture, usernameOrEmail: 'testuser'}],
  ['account.resetAccount', {passphrase: fixture}],
  ['login.paperKeySubmit', {paperPhrase: fixture, sessionID: 1}],
  ['login.unlockWithPassphrase', {passphrase: fixture}],
  ['loginUi.displayPaperKeyPhrase', {phrase: fixture, sessionID: 1}],
  ['loginUi.displayPrimaryPaperKey', {phrase: fixture}],
  ['provisionUi.DisplayAndPromptSecret', {phrase: fixture, previousErr: '', secret: new Uint8Array([1, 2])}],
  ['signup.signup', {passphrase: fixture, storeSecret: true}],
  ['wrapped payload', {payload: {method: 'm', param: [{phrase: fixture}], response: {result: () => {}}}}],
  ['mixed-case key', {PaperKey: fixture}],
]

test.each(cases)('%s: logged copy holds no secret', (_name, params) => {
  const logged = JSON.stringify(redactRpcParams(params))
  expect(logged).not.toContain(fixture)
  expect(logged).toContain('<redacted>')
})

test('sent params are not mutated and non-secrets stay', () => {
  const params = {force: false, oldPassphrase: fixture, passphrase: fixture, sessionID: 1, storeSecret: true}
  const logged = redactRpcParams(params) as typeof params
  expect(params.passphrase).toBe(fixture)
  expect(params.oldPassphrase).toBe(fixture)
  expect(logged.sessionID).toBe(1)
  expect(logged.storeSecret).toBe(true)
  expect(logged).not.toBe(params)
})

test('cyclic and non-plain values do not throw', () => {
  const a: Record<string, unknown> = {passphrase: fixture}
  a['self'] = a
  const fn = () => {}
  const out = redactRpcParams({a, fn}) as {fn: unknown}
  expect(out.fn).toBe(fn)
  expect(JSON.stringify(redactRpcParams({a: {passphrase: fixture}}))).not.toContain(fixture)
})
