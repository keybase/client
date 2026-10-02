import assert from 'node:assert/strict'
import {test} from 'node:test'
import {customResponseError, isOneway} from './message-flags.ts'

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
