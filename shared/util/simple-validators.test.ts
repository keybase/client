/// <reference types="jest" />
import {validateEmailAddress} from './email-address'
import {isValidEmail, isValidName, isValidUsername} from './simple-validators'

describe('isValidUsername', () => {
  test('accepts a plain username', () => {
    expect(isValidUsername('testuser')).toBe('')
    expect(isValidUsername('testuser_mac')).toBe('')
    expect(isValidUsername('a1')).toBe('')
  })

  test('rejects blanks and spaces', () => {
    expect(isValidUsername('   ')).toBe('Cannot be blank')
    expect(isValidUsername('test user')).toBe('No spaces allowed')
  })

  test('rejects periods', () => {
    expect(isValidUsername('test.user')).toBe("Usernames can't contain periods.")
  })

  test('rejects a leading underscore', () => {
    expect(isValidUsername('_testuser')).toBe("Usernames can't start with an underscore.")
  })

  test('rejects double underscores anywhere', () => {
    expect(isValidUsername('test__user')).toBe("Usernames can't contain double underscores to avoid confusion.")
    expect(isValidUsername('testuser__')).toBe("Usernames can't contain double underscores to avoid confusion.")
  })

  test('reports the first problem when there are several', () => {
    expect(isValidUsername('_test.user')).toBe("Usernames can't contain periods.")
  })

  test('treats an unset username as not-yet-an-error', () => {
    expect(isValidUsername()).toBe('')
    expect(isValidUsername('')).toBe('')
  })
})

describe('isValidEmail', () => {
  test('accepts anything with an at sign and no spaces', () => {
    expect(isValidEmail('testuser@keybase.io')).toBe('')
    expect(isValidEmail('a@b')).toBe('')
  })

  test('rejects a missing at sign', () => {
    expect(isValidEmail('testuser.keybase.io')).toBe('Invalid email address.')
  })

  test('rejects spaces', () => {
    expect(isValidEmail('test user@keybase.io')).toBe('Invalid email address.')
  })

  test('only reports empty when nothing was typed at all', () => {
    expect(isValidEmail()).toBe('Empty email address.')
    expect(isValidEmail('')).toBe('Empty email address.')
    // anything the user actually typed, blank included, is reported as invalid
    expect(isValidEmail('   ')).toBe('Invalid email address.')
    expect(isValidEmail('\t')).toBe('Invalid email address.')
  })
})

describe('isValidName', () => {
  test('accepts a name and rejects blanks', () => {
    expect(isValidName('Test User')).toBe('')
    expect(isValidName()).toBe('Please provide your name.')
    expect(isValidName('')).toBe('Please provide your name.')
    expect(isValidName('  \t ')).toBe('Please provide your name.')
  })
})

describe('validateEmailAddress', () => {
  test('accepts a normal address', () => {
    expect(validateEmailAddress('testuser@keybase.io')).toBe(true)
    expect(validateEmailAddress('a.b+c@sub.example.co.uk')).toBe(true)
  })

  test('requires an at sign and a dotted domain', () => {
    expect(validateEmailAddress('testuser')).toBe(false)
    expect(validateEmailAddress('testuser@keybase')).toBe(false)
    expect(validateEmailAddress('@keybase.io')).toBe(false)
  })

  test('rejects whitespace anywhere', () => {
    expect(validateEmailAddress('test user@keybase.io')).toBe(false)
    expect(validateEmailAddress(' testuser@keybase.io')).toBe(false)
    expect(validateEmailAddress('testuser@keybase.io ')).toBe(false)
  })

  test('rejects the empty string and very short inputs', () => {
    expect(validateEmailAddress('')).toBe(false)
    expect(validateEmailAddress('a@b')).toBe(false)
  })

  test('is single line only', () => {
    expect(validateEmailAddress('testuser@keybase.io\nevil@evil.com')).toBe(false)
  })
})
