/// <reference types="jest" />
import {validatePgpInfo} from './choice'

const makeInfo = (overrides?: Partial<Parameters<typeof validatePgpInfo>[0]>) => ({
  pgpEmail1: 'testuser@example.com',
  pgpEmail2: '',
  pgpEmail3: '',
  pgpFullName: 'Test User',
  ...overrides,
})

test('validatePgpInfo accepts a name plus a single email', () => {
  expect(validatePgpInfo(makeInfo())).toEqual({
    pgpErrorEmail1: false,
    pgpErrorEmail2: false,
    pgpErrorEmail3: false,
    pgpErrorText: '',
  })
})

test('validatePgpInfo treats the optional emails as valid while they are empty', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail2: '', pgpEmail3: ''}))
  expect(res.pgpErrorEmail2).toBe(false)
  expect(res.pgpErrorEmail3).toBe(false)
  expect(res.pgpErrorText).toBe('')
})

test('validatePgpInfo requires the first email even though 2 and 3 are optional', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail1: ''}))
  expect(res.pgpErrorEmail1).toBe(true)
  expect(res.pgpErrorText).toBe('Empty email address.')
})

test('validatePgpInfo reports a missing name ahead of any email problem', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail1: 'nope', pgpFullName: '   '}))
  expect(res.pgpErrorEmail1).toBe(true)
  expect(res.pgpErrorText).toBe('Please provide your name.')
})

test('validatePgpInfo flags each optional email independently once it is filled in', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail2: 'not-an-email', pgpEmail3: 'three@example.com'}))
  expect(res).toEqual({
    pgpErrorEmail1: false,
    pgpErrorEmail2: true,
    pgpErrorEmail3: false,
    pgpErrorText: 'Invalid email address.',
  })
})

test('validatePgpInfo rejects emails with spaces', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail1: 'test user@example.com'}))
  expect(res.pgpErrorEmail1).toBe(true)
  expect(res.pgpErrorText).toBe('Invalid email address.')
})
