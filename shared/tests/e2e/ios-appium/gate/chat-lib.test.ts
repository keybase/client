import {inboxRowMatches, persistedMismatch} from './chat-lib'

describe('inboxRowMatches', () => {
  test('a small conversation row matches by the exact name its label starts with', () => {
    expect(inboxRowMatches('testuser-mac, 3:04 PM, hello', 'testuser-mac')).toBe(true)
    expect(inboxRowMatches('testuser,testuser-mac, Yesterday, Draft: hi', 'testuser,testuser-mac')).toBe(true)
  })

  test('a row whose name only starts with the asked-for name does not match', () => {
    expect(inboxRowMatches('testuser-mac, 3:04 PM, hello', 'testuser')).toBe(false)
    expect(inboxRowMatches('testuser,testuser-mac, 3:04 PM, hello', 'testuser')).toBe(false)
  })

  test('the name must be the first field, not appear later in the label', () => {
    expect(inboxRowMatches('testuser-mac, 3:04 PM, testuser', 'testuser')).toBe(false)
  })

  test('a row whose label is only the name matches', () => {
    expect(inboxRowMatches('testuser', 'testuser')).toBe(true)
  })

  test('a big team channel row, drawn "# name", matches "#name" and nothing longer', () => {
    expect(inboxRowMatches('# general', '#general')).toBe(true)
    expect(inboxRowMatches('# general-e2e', '#general')).toBe(false)
    expect(inboxRowMatches('# general', 'general')).toBe(false)
  })

  test('an empty name matches nothing', () => {
    expect(inboxRowMatches('', '')).toBe(false)
    expect(inboxRowMatches(', 3:04 PM', '')).toBe(false)
  })
})

describe('persistedMismatch', () => {
  test('a value equal in depth to the one wanted is no mismatch', () => {
    expect(persistedMismatch('the setting', {a: [1, 2]}, {a: [1, 2]})).toBeUndefined()
  })

  test('a different value names what was read, what came back and what was wanted', () => {
    expect(persistedMismatch('the mobile notifications', 'never', 'onAnyActivity')).toBe(
      'the mobile notifications after a relaunch: "never", want "onAnyActivity"'
    )
  })
})
