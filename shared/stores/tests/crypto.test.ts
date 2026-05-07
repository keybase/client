/// <reference types="jest" />
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {createEncryptState, encryptToOutputParams, teamBuilderResultToRecipients} from '@/crypto/encrypt'
import {
  createCommonState,
  getStatusCodeMessage,
} from '@/crypto/helpers'

test('createCommonState seeds route-provided input', () => {
  expect(
    createCommonState({
      entryNonce: 'nonce',
      seedInputPath: '/tmp/file.saltpack',
      seedInputType: 'file',
    })
  ).toEqual(
    expect.objectContaining({
      input: '/tmp/file.saltpack',
      inputType: 'file',
      output: '',
      outputStatus: undefined,
    })
  )
})

test('encryptToOutputParams preserves encrypt-specific metadata', () => {
  const state = {
    ...createEncryptState(),
    input: 'secret',
    meta: {hasRecipients: true, hasSBS: false, hideIncludeSelf: true},
    options: {includeSelf: false, sign: true},
    output: 'ciphertext',
    outputStatus: 'success' as const,
    outputType: 'text' as const,
    outputValid: true,
    recipients: ['bob'],
  }

  expect(encryptToOutputParams(state)).toEqual(
    expect.objectContaining({
      hasRecipients: true,
      includeSelf: false,
      input: 'secret',
      output: 'ciphertext',
      recipients: ['bob'],
    })
  )
})

test('teamBuilderResultToRecipients converts SBS assertions', () => {
  expect(
    teamBuilderResultToRecipients([
      {serviceId: 'keybase', username: 'alice'},
      {serviceId: 'email', username: 'carol'},
      {serviceId: 'twitter', username: 'bob'},
    ])
  ).toEqual({
    hasSBS: true,
    recipients: ['alice', '[carol]@email', 'bob@twitter'],
  })
})

test('getStatusCodeMessage maps wrong-format verify errors with the decrypt hint', () => {
  const error = new RPCError('wrong type', T.RPCGen.StatusCode.scwrongcryptomsgtype, [
    {key: 'ignored', value: T.RPCGen.StatusCode.scgeneric},
    {key: 'Code', value: T.RPCGen.StatusCode.scwrongcryptomsgtype},
  ])

  expect(getStatusCodeMessage(error, 'verify', 'text')).toContain('Did you mean to decrypt it?')
})
