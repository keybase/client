/// <reference types="jest" />
import type * as T from '@/constants/types'
import {formatMessage} from './revoke'

const p = (platform: string) => platform as T.More.PlatformsExpandedType

describe('formatMessage', () => {
  test('pgp is a drop, not a revoke', () => {
    expect(formatMessage(p('pgp'))).toBe('Are you sure you want to drop your PGP key?')
  })

  test('btc is described as a bitcoin address', () => {
    expect(formatMessage(p('btc'))).toBe('Are you sure you want to revoke your Bitcoin address?')
  })

  test('every web-ish platform collapses to the same website wording', () => {
    const expected = 'Are you sure you want to revoke your website?'
    expect(formatMessage(p('dns'))).toBe(expected)
    expect(formatMessage(p('http'))).toBe(expected)
    expect(formatMessage(p('https'))).toBe(expected)
    expect(formatMessage(p('web'))).toBe(expected)
  })

  test('hacker news gets its own capitalization rather than the default', () => {
    expect(formatMessage(p('hackernews'))).toBe('Are you sure you want to revoke your Hacker News identity?')
  })

  test('other platforms fall back to a capitalized identity', () => {
    expect(formatMessage(p('twitter'))).toBe('Are you sure you want to revoke your Twitter identity?')
    expect(formatMessage(p('github'))).toBe('Are you sure you want to revoke your Github identity?')
    expect(formatMessage(p('reddit'))).toBe('Are you sure you want to revoke your Reddit identity?')
    expect(formatMessage(p('facebook'))).toBe('Are you sure you want to revoke your Facebook identity?')
  })

  test('the fallback capitalizes only the first letter and lowercases the rest', () => {
    expect(formatMessage(p('zcash'))).toBe('Are you sure you want to revoke your Zcash identity?')
    expect(formatMessage(p('HACKER'))).toBe('Are you sure you want to revoke your Hacker identity?')
  })
})
