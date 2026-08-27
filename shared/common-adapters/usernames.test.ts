/// <reference types="jest" />

import {expect, test, describe} from '@jest/globals'
import {assertionToDisplay} from './usernames'

describe('assertionToDisplay', () => {
  test('plain usernames pass through untouched', () => {
    expect(assertionToDisplay('testuser')).toBe('testuser')
    expect(assertionToDisplay('testuser-mac')).toBe('testuser-mac')
  })

  test('non phone/email assertions pass through untouched', () => {
    expect(assertionToDisplay('testuser@twitter')).toBe('testuser@twitter')
    expect(assertionToDisplay('example.com@dns')).toBe('example.com@dns')
  })

  test('email assertions unwrap the brackets and the suffix', () => {
    expect(assertionToDisplay('[testuser@example.com]@email')).toBe('testuser@example.com')
  })

  test('phone assertions render in the local display format', () => {
    expect(assertionToDisplay('15550123456@phone')).toBe('+1 (555) 012-3456')
  })

  test('unparseable phone assertions fall back to a bare e164 string', () => {
    expect(assertionToDisplay('000@phone')).toBe('+000')
  })
})
