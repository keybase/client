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
})

describe('makeCleanDeviceName', () => {
  test('leaves an already-clean name alone', () => {
    expect(makeCleanDeviceName('testuser-mac')).toBe('testuser-mac')
    expect(makeCleanDeviceName("testuser's mac")).toBe("testuser's mac")
  })

  test('empty input stays empty', () => {
    expect(makeCleanDeviceName('')).toBe('')
  })

  test('whitespace-only input collapses to a single space and stays disabled', () => {
    expect(makeCleanDeviceName('   ')).toBe(' ')
    expect(isDeviceNameDisabled(makeCleanDeviceName('   '))).toBe(true)
  })

  test('strips characters outside the allowed set', () => {
    expect(makeCleanDeviceName('testuser@mac')).toBe('testusermac')
    expect(makeCleanDeviceName('testuser.mac')).toBe('testusermac')
  })

  test('separators left touching by a stripped character are collapsed', () => {
    expect(makeCleanDeviceName('testuser 🙂 mac')).toBe('testuser mac')
    expect(makeCleanDeviceName('testuser🙂-🙂mac')).toBe('testuser-mac')
  })

  test('separator runs typed by hand are collapsed too', () => {
    expect(makeCleanDeviceName('testuser  mac')).toBe('testuser mac')
    expect(makeCleanDeviceName('testuser--mac')).toBe('testuser-mac')
    expect(makeCleanDeviceName("testuser_ 'mac")).toBe('testuser_mac')
  })

  test('a single trailing separator survives so a name can be typed through it', () => {
    expect(makeCleanDeviceName('testuser-')).toBe('testuser-')
    expect(makeCleanDeviceName('testuser ')).toBe('testuser ')
  })

  test('cleaning makes an otherwise-rejected name acceptable', () => {
    for (const raw of ['testuser.mac', 'testuser 🙂 mac', 'testuser  mac', "testuser_ 'mac"]) {
      expect(isDeviceNameDisabled(raw)).toBe(true)
      expect(isDeviceNameDisabled(makeCleanDeviceName(raw))).toBe(false)
    }
  })

  test('is idempotent', () => {
    for (const name of ['testuser@mac', "testuser's mac", '', '   ', 'testuser 🙂 mac', 'testuser--mac']) {
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
    // normalizeDeviceRE must be global. Without the g flag only the first
    // separator is removed, so the 3-64 bound is measured against a string that
    // still carries the rest of them and a legal name is rejected as too long.
    //
    // The inputs below are longer than the 64-character maxLength both device
    // name inputs set, which is unavoidable: the two implementations only
    // disagree once the separators alone push the raw string past 64, and the
    // shortest such name is 66 characters (64 alphanumerics + 2 separators).
    // The property is still worth pinning -- maxLength is a UI affordance, not
    // a guarantee about what reaches this function.
    const sixtyFourAlnum = `${'a'.repeat(62)} b c`
    expect(sixtyFourAlnum.length).toBe(66)
    expect(sixtyFourAlnum.replace(/[^a-zA-Z0-9]/g, '').length).toBe(64)
    // stripping only the first separator would leave 65 and reject this
    expect(isDeviceNameDisabled(sixtyFourAlnum)).toBe(false)

    // one alphanumeric more and it is genuinely too long, separators or not
    const sixtyFiveAlnum = `${'a'.repeat(63)} b c`
    expect(sixtyFiveAlnum.replace(/[^a-zA-Z0-9]/g, '').length).toBe(65)
    expect(isDeviceNameDisabled(sixtyFiveAlnum)).toBe(true)
  })
})
