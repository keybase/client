/** @jest-environment jsdom */
/// <reference types="jest" />
import * as RPCGen from '@/constants/rpc/rpc-gen'
import RPCError from '@/util/rpcerror'
import {cleanup, renderHook} from '@testing-library/react'
import {
  beginRun,
  clearInputState,
  createCommonState,
  getStatusCodeMessage,
  nextInputState,
  nextOpenedFileState,
  resetOutput,
  resetWarnings,
  useRunGeneration,
  type CommonState,
} from './helpers'

afterEach(() => {
  cleanup()
})

const makeState = (overrides?: Partial<CommonState>): CommonState => ({
  ...createCommonState(),
  bytesComplete: 5,
  bytesTotal: 10,
  errorMessage: 'boom',
  inProgress: true,
  input: 'previous input',
  output: 'previous output',
  outputSenderFullname: 'Test User',
  outputSenderUsername: 'testuser',
  outputSigned: true,
  outputStatus: 'success',
  outputType: 'text',
  outputValid: true,
  warningMessage: 'careful',
  ...overrides,
})

test('createCommonState seeds input from the route params and defaults to empty text input', () => {
  expect(createCommonState()).toEqual(
    expect.objectContaining({input: '', inputType: 'text', outputValid: false})
  )
  expect(createCommonState({seedInputPath: '/tmp/a.txt', seedInputType: 'file'})).toEqual(
    expect.objectContaining({input: '/tmp/a.txt', inputType: 'file'})
  )
})

test('resetWarnings clears both messages and leaves the output alone', () => {
  const next = resetWarnings(makeState())
  expect(next.errorMessage).toBe('')
  expect(next.warningMessage).toBe('')
  expect(next.output).toBe('previous output')
  expect(next.outputStatus).toBe('success')
})

test('resetOutput drops every output field and the progress counters', () => {
  const prev = makeState()
  const next = resetOutput(prev)

  expect(prev.output).toBe('previous output')
  expect(next).toEqual(
    expect.objectContaining({
      bytesComplete: 0,
      bytesTotal: 0,
      errorMessage: '',
      input: 'previous input',
      output: '',
      outputSenderFullname: undefined,
      outputSenderUsername: undefined,
      outputSigned: false,
      outputStatus: undefined,
      outputType: undefined,
      outputValid: false,
      warningMessage: '',
    })
  )
})

test('beginRun marks progress pending without dropping the previous output', () => {
  const next = beginRun(makeState())
  expect(next).toEqual(
    expect.objectContaining({
      bytesComplete: 0,
      bytesTotal: 0,
      errorMessage: '',
      inProgress: true,
      output: 'previous output',
      outputStatus: 'pending',
      outputValid: false,
    })
  )
})

test('clearInputState empties the input and marks the (now empty) output valid', () => {
  const next = clearInputState(makeState({inputType: 'file'}))
  expect(next).toEqual(
    expect.objectContaining({input: '', inputType: 'text', output: '', outputValid: true})
  )
})

test('nextInputState keeps the output valid only when the text is unchanged', () => {
  const prev = makeState({input: 'same'})

  expect(nextInputState(prev, 'text', 'same').outputValid).toBe(true)
  expect(nextInputState(prev, 'text', 'different').outputValid).toBe(false)
  // an unchanged text input must not throw away the output we already have
  expect(nextInputState(prev, 'text', 'same').output).toBe('previous output')
})

test('nextInputState resets the output when switching to a file input', () => {
  const next = nextInputState(makeState({input: 'same'}), 'file', 'same')
  expect(next.inputType).toBe('file')
  expect(next.input).toBe('same')
  expect(next.output).toBe('')
  // resetOutput runs after outputValid is computed, so a file input is never valid
  expect(next.outputValid).toBe(false)
})

test('nextOpenedFileState swaps in the dropped path and clears the previous output', () => {
  const next = nextOpenedFileState(makeState(), '/tmp/secret.txt')
  expect(next).toEqual(
    expect.objectContaining({input: '/tmp/secret.txt', inputType: 'file', output: '', outputStatus: undefined})
  )
})

const makeError = (code: RPCGen.StatusCode, message = 'nope', fields?: unknown) =>
  new RPCError(message, code, fields) as never

test('getStatusCodeMessage maps network errors to the offline message', () => {
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scapinetworkerror), 'decrypt', 'text')).toBe(
    'You are offline.'
  )
  expect(
    getStatusCodeMessage(makeError(RPCGen.StatusCode.scgeneric, 'API network error'), 'sign', 'text')
  ).toBe('You are offline.')
})

test('getStatusCodeMessage falls back to a generic message for an unmapped code', () => {
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scgeneric, 'nope'), 'verify', 'file')).toBe(
    'Failed to verify file.'
  )
})

test('getStatusCodeMessage tailors the bad-format hint to the operation and input type', () => {
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scstreamunknown), 'verify', 'text')).toBe(
    'This signed message is not in a valid Saltpack format. Please enter a Saltpack signed message.'
  )
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scstreamunknown), 'decrypt', 'text')).toBe(
    'This ciphertext is not in a valid Saltpack format. Please enter Saltpack ciphertext.'
  )
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scstreamunknown), 'decrypt', 'file')).toBe(
    'This file is not in a valid Saltpack format. Please drop a Saltpack encrypted file.'
  )
})

test('getStatusCodeMessage suggests the sibling operation on a wrong saltpack type', () => {
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scwrongcryptomsgtype), 'verify', 'text')).toBe(
    'This Saltpack format is unexpected. Did you mean to decrypt it?'
  )
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scwrongcryptomsgtype), 'decrypt', 'text')).toBe(
    'This Saltpack format is unexpected. Did you mean to verify it?'
  )
  // encrypt/sign get no sibling hint
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scwrongcryptomsgtype), 'encrypt', 'text')).toBe(
    'This Saltpack format is unexpected.'
  )
})

test('getStatusCodeMessage reads the cause code out of the second error field', () => {
  const fields = [
    {key: 'Something', value: RPCGen.StatusCode.scgeneric},
    {key: 'Code', value: RPCGen.StatusCode.scdecryptionkeynotfound},
  ]
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scdecryptionerror, 'x', fields), 'decrypt', 'text')).toBe(
    "This message was encrypted for someone else or for a key you don't have."
  )

  const verifyFields = [
    {key: 'Something', value: RPCGen.StatusCode.scgeneric},
    {key: 'Code', value: RPCGen.StatusCode.scverificationkeynotfound},
  ]
  expect(
    getStatusCodeMessage(makeError(RPCGen.StatusCode.scsigcannotverify, 'x', verifyFields), 'verify', 'text')
  ).toBe("This message couldn't be verified, because the signing key wasn't recognized.")
})

test('getStatusCodeMessage falls back to generic when the cause fields are missing or unnamed', () => {
  expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scdecryptionerror), 'decrypt', 'text')).toBe(
    'Failed to decrypt text.'
  )
  const unnamed = [
    {key: 'a', value: RPCGen.StatusCode.scgeneric},
    {key: 'NotCode', value: RPCGen.StatusCode.scdecryptionkeynotfound},
  ]
  expect(
    getStatusCodeMessage(makeError(RPCGen.StatusCode.scdecryptionerror, 'x', unnamed), 'decrypt', 'text')
  ).toBe('Failed to decrypt text.')
})

test('useRunGeneration only ever considers the newest run current', () => {
  const {rerender, result} = renderHook(() => useRunGeneration())

  const first = result.current.startRun()
  expect(result.current.isCurrentRun(first)).toBe(true)

  const second = result.current.startRun()
  expect(result.current.isCurrentRun(first)).toBe(false)
  expect(result.current.isCurrentRun(second)).toBe(true)

  // the generation survives re-renders, so a run started before one is still
  // recognised after it
  rerender()
  expect(result.current.isCurrentRun(first)).toBe(false)
  expect(result.current.isCurrentRun(second)).toBe(true)
})

test('useRunGeneration keeps stable callback identities across renders', () => {
  const {rerender, result} = renderHook(() => useRunGeneration())
  const {isCurrentRun, startRun} = result.current

  rerender()

  expect(result.current.startRun).toBe(startRun)
  expect(result.current.isCurrentRun).toBe(isCurrentRun)
})
