/// <reference types="jest" />
import {normalizeUrl} from './deep-link-emitter'

test('keybase urls pass through untouched', () => {
  expect(normalizeUrl('keybase://convid/conv-1')).toBe('keybase://convid/conv-1')
  expect(normalizeUrl('keybase://anything/at/all?q=1')).toBe('keybase://anything/at/all?q=1')
})

test('non-http schemes are rejected', () => {
  expect(normalizeUrl('ftp://keybase.io/testuser')).toBeUndefined()
  expect(normalizeUrl('testuser')).toBeUndefined()
  expect(normalizeUrl('')).toBeUndefined()
})

test('only keybase.io hosts are converted', () => {
  expect(normalizeUrl('https://example.com/testuser')).toBeUndefined()
  expect(normalizeUrl('https://keybase.io.evil.com/testuser')).toBeUndefined()
  expect(normalizeUrl('https://www.keybase.io/testuser')).toBe('keybase://profile/show/testuser')
  expect(normalizeUrl('http://keybase.io/testuser')).toBe('keybase://profile/show/testuser')
})

test('a port on the host does not block conversion', () => {
  expect(normalizeUrl('https://keybase.io:8080/testuser')).toBe('keybase://profile/show/testuser')
})

test('usernames are lowercased and query strings dropped', () => {
  expect(normalizeUrl('https://keybase.io/TestUser?utm=x')).toBe('keybase://profile/show/testuser')
})

test('a trailing slash on a profile url is tolerated', () => {
  expect(normalizeUrl('https://keybase.io/testuser/')).toBe('keybase://profile/show/testuser')
})

test('non-username single segments are not treated as profiles', () => {
  // reserved
  expect(normalizeUrl('https://keybase.io/app')).toBeUndefined()
  // too short
  expect(normalizeUrl('https://keybase.io/a')).toBeUndefined()
  // too long
  expect(normalizeUrl(`https://keybase.io/${'a'.repeat(17)}`)).toBeUndefined()
  // bare host
  expect(normalizeUrl('https://keybase.io')).toBeUndefined()
  expect(normalizeUrl('https://keybase.io/')).toBeUndefined()
})

test('multi-segment paths are not profiles', () => {
  expect(normalizeUrl('https://keybase.io/docs/acceptable-use-policy')).toBeUndefined()
})

test('team urls become team-page links', () => {
  expect(normalizeUrl('https://keybase.io/team/keybasefriends')).toBe('keybase://team-page/keybasefriends')
  expect(normalizeUrl('https://keybase.io/team/keybasefriends/')).toBe('keybase://team-page/keybasefriends')
})

test('an applink query becomes the team-page action segment', () => {
  expect(normalizeUrl('https://keybase.io/team/keybasefriends?applink=join_team')).toBe(
    'keybase://team-page/keybasefriends/join_team'
  )
  expect(normalizeUrl('https://keybase.io/team/keybasefriends?foo=1&applink=manage_settings')).toBe(
    'keybase://team-page/keybasefriends/manage_settings'
  )
})

test('an unrecognized applink value is ignored', () => {
  expect(normalizeUrl('https://keybase.io/team/keybasefriends?applink=JOIN')).toBe(
    'keybase://team-page/keybasefriends'
  )
})

test('subteam urls are not team-page links', () => {
  // the team pattern does not allow the '.' separator twice in a row
  expect(normalizeUrl('https://keybase.io/team/keybase/sub')).toBeUndefined()
})
