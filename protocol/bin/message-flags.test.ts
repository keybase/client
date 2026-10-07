import assert from 'node:assert/strict'
import {test} from 'node:test'
import {customResponseError, enabledCallErrors, isMustAnswer, isOneway} from './message-flags.ts'

test('a message marked oneway or notify is oneway', () => {
  assert.equal(isOneway({oneway: true}), true)
  assert.equal(isOneway({notify: ''}), true)
  assert.equal(isOneway({}), false)
})

test('custom is refused on a oneway message', () => {
  const method = "'keybase.1.NotifyApp.exit'"
  assert.match(customResponseError(method, {oneway: true}, true) ?? '', /cannot be a notify method/)
  assert.match(customResponseError(method, {notify: ''}, true) ?? '', /cannot be a notify method/)
})

test('custom is allowed on a call with a response, and a oneway message without custom is fine', () => {
  const method = "'keybase.1.secretUi.getPassphrase'"
  assert.equal(customResponseError(method, {}, true), undefined)
  assert.equal(customResponseError(method, {oneway: true}, false), undefined)
})

test('the GUI must answer a custom call that returns a value', () => {
  assert.equal(isMustAnswer({}, true, 'GetPassphraseRes'), true)
  assert.equal(isMustAnswer({}, true, 'boolean'), true)
})

test('a void custom call, a call without custom, and a oneway message need no answer', () => {
  assert.equal(isMustAnswer({}, true, 'null'), false)
  assert.equal(isMustAnswer({}, true, 'void'), false)
  assert.equal(isMustAnswer({}, false, 'GetPassphraseRes'), false)
  assert.equal(isMustAnswer({oneway: true}, true, 'GetPassphraseRes'), false)
})

test('an entry may only name call types and survivesAccountChange', () => {
  assert.deepEqual(enabledCallErrors('keybase.1.user.loadMySettings', {promise: true}), [])
  assert.match(enabledCallErrors('keybase.1.user.loadMySettings', {promise: true, notify: true})[0] ?? '', /Invalid/)
})

test('survivesAccountChange goes only on a call the GUI makes', () => {
  assert.deepEqual(enabledCallErrors('keybase.1.login.login', {engineListener: true, survivesAccountChange: true}), [])
  assert.deepEqual(enabledCallErrors('keybase.1.login.logout', {promise: true, survivesAccountChange: true}), [])
  assert.match(
    enabledCallErrors('keybase.1.NotifySession.loggedOut', {incoming: true, survivesAccountChange: true})[0] ?? '',
    /needs promise or engineListener/
  )
})

test('a delegateUiCtl or notifyCtl call must survive an account change', () => {
  assert.match(
    enabledCallErrors('keybase.1.delegateUiCtl.registerChatUI', {promise: true})[0] ?? '',
    /mark it survivesAccountChange/
  )
  assert.match(
    enabledCallErrors('keybase.1.notifyCtl.setNotifications', {promise: true})[0] ?? '',
    /mark it survivesAccountChange/
  )
  assert.deepEqual(
    enabledCallErrors('keybase.1.notifyCtl.setNotifications', {promise: true, survivesAccountChange: true}),
    []
  )
})
