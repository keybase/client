/// <reference types="jest" />
import {normalizeProofUsername} from './proof-utils'

test('normalizeProofUsername leaves non-web, non-btc platforms untouched', () => {
  expect(normalizeProofUsername('twitter', 'testuser')).toEqual({normalized: 'testuser', valid: true})
  expect(normalizeProofUsername(undefined, 'testuser')).toEqual({normalized: 'testuser', valid: true})
})

test('normalizeProofUsername strips scheme, port and path off web proofs', () => {
  expect(normalizeProofUsername('https', 'https://example.com/some/path').normalized).toBe('example.com')
  expect(normalizeProofUsername('http', 'http://example.com:8080').normalized).toBe('example.com')
  expect(normalizeProofUsername('https', 'example.com').normalized).toBe('example.com')
  // subdomains survive; only the scheme/port/path are removed
  expect(normalizeProofUsername('https', 'https://www.example.com:443/x?y=1').normalized).toBe(
    'www.example.com'
  )
})

test('normalizeProofUsername accepts legacy bitcoin addresses', () => {
  expect(normalizeProofUsername('btc', '1BoatSLRHtKNngkdXEeobR76b53LETtpyT')).toEqual({
    normalized: '1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
    valid: true,
  })
  expect(normalizeProofUsername('btc', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy').valid).toBe(true)
})

test('normalizeProofUsername accepts bech32 segwit addresses regardless of case', () => {
  expect(normalizeProofUsername('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').valid).toBe(true)
  expect(normalizeProofUsername('btc', 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4').valid).toBe(true)
})

test('normalizeProofUsername rejects malformed bitcoin addresses without changing the value', () => {
  // leading 2 is not a valid version byte for this format
  expect(normalizeProofUsername('btc', '2BoatSLRHtKNngkdXEeobR76b53LETtpyT')).toEqual({
    normalized: '2BoatSLRHtKNngkdXEeobR76b53LETtpyT',
    valid: false,
  })
  // too short
  expect(normalizeProofUsername('btc', '1Boat').valid).toBe(false)
  // 0, O, I and l are excluded from the legacy alphabet
  expect(normalizeProofUsername('btc', '1B0atSLRHtKNngkdXEeobR76b53LETtpyT').valid).toBe(false)
  // not a valid bech32 data character
  expect(normalizeProofUsername('btc', 'bc1bbbbbbbbbbb').valid).toBe(false)
  expect(normalizeProofUsername('btc', '').valid).toBe(false)
})
