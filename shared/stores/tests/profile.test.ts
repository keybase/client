/// <reference types="jest" />
import {validatePgpInfo} from '@/profile/pgp/validation'
import {normalizeProofUsername} from '@/profile/proof-utils'
import {resetAllStores} from '@/util/zustand'
import {useProfileState} from '../profile'

beforeEach(() => {
  resetAllStores()
})

afterEach(() => {
  resetAllStores()
})

test('normalizeProofUsername normalizes http proofs to the bare hostname', () => {
  const result = normalizeProofUsername('https', 'https://example.com:3000/path/to/proof')

  expect(result.normalized).toBe('example.com')
  expect(result.valid).toBe(true)
})

test('normalizeProofUsername validates bitcoin addresses', () => {
  expect(normalizeProofUsername('btc', 'not-a-btc-address').valid).toBe(false)
  expect(normalizeProofUsername('btc', '1BoatSLRHtKNngkdXEeobR76b53LETtpyT').valid).toBe(true)
})

test('validatePgpInfo derives validation errors from local form state', () => {
  let result = validatePgpInfo({
    pgpEmail1: 'bad-email',
    pgpEmail2: 'also-bad',
    pgpEmail3: '',
    pgpFullName: 'Alice',
  })

  expect(result.pgpErrorEmail1).toBe(true)
  expect(result.pgpErrorEmail2).toBe(true)
  expect(result.pgpErrorEmail3).toBe(false)

  result = validatePgpInfo({
    pgpEmail1: 'alice@keybase.io',
    pgpEmail2: '',
    pgpEmail3: '',
    pgpFullName: 'Alice',
  })

  expect(result.pgpErrorEmail1).toBe(false)
  expect(result.pgpErrorText).toBe('')
})

test('resetState clears dynamic profile callbacks and preserves the default cancel hook', () => {
  useProfileState.setState(s => {
    s.dispatch.dynamic.afterCheckProof = () => {}
    s.dispatch.dynamic.cancelPgpGen = () => {}
    s.dispatch.dynamic.finishedWithKeyGen = () => {}
    s.dispatch.dynamic.submitUsername = () => {}
  })

  useProfileState.getState().dispatch.resetState()

  const state = useProfileState.getState()
  expect(state.dispatch.dynamic.afterCheckProof).toBeUndefined()
  expect(state.dispatch.dynamic.cancelPgpGen).toBeUndefined()
  expect(state.dispatch.dynamic.finishedWithKeyGen).toBeUndefined()
  expect(state.dispatch.dynamic.submitUsername).toBeUndefined()
  expect(typeof state.dispatch.dynamic.cancelAddProof).toBe('function')
})
