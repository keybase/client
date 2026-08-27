/// <reference types="jest" />
import {isDeviceNameDisabled, makeCleanDeviceName} from './device-name'

describe('isDeviceNameDisabled', () => {
  test('empty and whitespace-only names are disabled', () => {
    expect(isDeviceNameDisabled('')).toBe(true)
    expect(isDeviceNameDisabled(' ')).toBe(true)
    expect(isDeviceNameDisabled('   ')).toBe(true)
    expect(isDeviceNameDisabled('\t')).toBe(true)
  })

  test('a plain valid name is enabled', () => {
    expect(isDeviceNameDisabled('testuser mac')).toBe(false)
    expect(isDeviceNameDisabled('testusermac')).toBe(false)
    expect(isDeviceNameDisabled("testuser's mac")).toBe(false)
    expect(isDeviceNameDisabled('testuser_mac')).toBe(false)
    expect(isDeviceNameDisabled('testuser-mac')).toBe(false)
  })

  test('boundary: fewer than 3 alphanumerics is disabled, exactly 3 is enabled', () => {
    expect(isDeviceNameDisabled('a')).toBe(true)
    expect(isDeviceNameDisabled('ab')).toBe(true)
    expect(isDeviceNameDisabled('abc')).toBe(false)
    expect(isDeviceNameDisabled('abcd')).toBe(false)
  })

  test('boundary: the 3-char minimum counts alphanumerics, not raw length', () => {
    // 'a b' is 3 characters but only 2 alphanumerics
    expect(isDeviceNameDisabled('a b')).toBe(true)
    expect(isDeviceNameDisabled('a-b')).toBe(true)
    expect(isDeviceNameDisabled('a b c')).toBe(false)
  })

  test('boundary: exactly 64 alphanumerics is enabled, 65 is disabled', () => {
    expect(isDeviceNameDisabled('a'.repeat(63))).toBe(false)
    expect(isDeviceNameDisabled('a'.repeat(64))).toBe(false)
    expect(isDeviceNameDisabled('a'.repeat(65))).toBe(true)
    expect(isDeviceNameDisabled('a'.repeat(200))).toBe(true)
  })

  test('names must start with an alphanumeric', () => {
    expect(isDeviceNameDisabled(' testuser')).toBe(true)
    expect(isDeviceNameDisabled('-testuser')).toBe(true)
    expect(isDeviceNameDisabled('_testuser')).toBe(true)
    expect(isDeviceNameDisabled("'testuser")).toBe(true)
    expect(isDeviceNameDisabled('1testuser')).toBe(false)
  })

  test('names may not end with punctuation or a space', () => {
    expect(isDeviceNameDisabled('testuser ')).toBe(true)
    expect(isDeviceNameDisabled('testuser-')).toBe(true)
    expect(isDeviceNameDisabled('testuser_')).toBe(true)
    expect(isDeviceNameDisabled("testuser'")).toBe(true)
  })

  test('adjacent punctuation (with or without a space between) is disabled', () => {
    expect(isDeviceNameDisabled('testuser--mac')).toBe(true)
    expect(isDeviceNameDisabled('testuser__mac')).toBe(true)
    expect(isDeviceNameDisabled("testuser''mac")).toBe(true)
    expect(isDeviceNameDisabled("testuser_ 'mac")).toBe(true)
    // a single separator between words is fine, even when a space sits next to it
    expect(isDeviceNameDisabled('testuser- mac')).toBe(false)
    expect(isDeviceNameDisabled('testuser-mac-2')).toBe(false)
  })

  test('double spaces are disabled', () => {
    expect(isDeviceNameDisabled('testuser  mac')).toBe(true)
    expect(isDeviceNameDisabled('testuser mac')).toBe(false)
  })

  test('characters outside the allowed set are disabled', () => {
    expect(isDeviceNameDisabled('testuser@mac')).toBe(true)
    expect(isDeviceNameDisabled('testuser.mac')).toBe(true)
    expect(isDeviceNameDisabled('testuser/mac')).toBe(true)
    expect(isDeviceNameDisabled('🙂🙂🙂')).toBe(true)
  })

  test('every rejection reason is independently sufficient', () => {
    // too short only
    expect(isDeviceNameDisabled('ab')).toBe(true)
    // too long only (all other rules pass)
    expect(isDeviceNameDisabled('a'.repeat(65))).toBe(true)
    // bad leading char only
    expect(isDeviceNameDisabled('-abcdef')).toBe(true)
    // bad trailing char only
    expect(isDeviceNameDisabled('abcdef-')).toBe(true)
  })

  test('is pure: repeated calls with the same input give the same answer', () => {
    for (const name of ['testuser-mac', 'testuser mac', 'ab', 'testuser--mac', '']) {
      expect(isDeviceNameDisabled(name)).toBe(isDeviceNameDisabled(name))
    }
  })
})

describe('makeCleanDeviceName', () => {
  test('leaves an already-clean name alone', () => {
    expect(makeCleanDeviceName('testuser-mac')).toBe('testuser-mac')
    expect(makeCleanDeviceName("testuser's mac")).toBe("testuser's mac")
  })

  test('empty input stays empty', () => {
    expect(makeCleanDeviceName('')).toBe('')
  })

  test('whitespace-only input keeps only spaces and stays disabled', () => {
    expect(makeCleanDeviceName('   ')).toBe('   ')
    expect(isDeviceNameDisabled(makeCleanDeviceName('   '))).toBe(true)
  })

  test('strips characters outside the allowed set', () => {
    expect(makeCleanDeviceName('testuser@mac')).toBe('testusermac')
    expect(makeCleanDeviceName('testuser.mac')).toBe('testusermac')
    expect(makeCleanDeviceName('testuser 🙂 mac')).toBe('testuser  mac')
  })

  test('cleaning makes an otherwise-rejected name acceptable', () => {
    expect(isDeviceNameDisabled('testuser.mac')).toBe(true)
    expect(isDeviceNameDisabled(makeCleanDeviceName('testuser.mac'))).toBe(false)
  })

  test('is idempotent', () => {
    for (const name of ['testuser@mac', "testuser's mac", '', '   ', 'testuser 🙂 mac']) {
      expect(makeCleanDeviceName(makeCleanDeviceName(name))).toBe(makeCleanDeviceName(name))
    }
  })
})

describe('smart apostrophes and separator normalization', () => {
  test('a smart apostrophe is converted to ASCII, not deleted', () => {
    expect(makeCleanDeviceName('testuser’s mac')).toBe("testuser's mac")
    expect(makeCleanDeviceName('testuser‘s mac')).toBe("testuser's mac")
    expect(makeCleanDeviceName('testuser´s mac')).toBe("testuser's mac")
    expect(makeCleanDeviceName('testuser`s mac')).toBe("testuser's mac")
  })

  test('the length check strips every separator, not just the first', () => {
    // 60 alphanumerics spread over 59 single spaces: 119 characters in all.
    // Counting only the alphanumerics keeps it under the 64 maximum; leaving
    // the separators in (stripping only the first) pushes it well over.
    const spacedOut = Array.from({length: 60}, () => 'a').join(' ')
    expect(spacedOut.length).toBe(119)
    expect(isDeviceNameDisabled(spacedOut)).toBe(false)
  })
})
