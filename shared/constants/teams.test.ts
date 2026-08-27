/// <reference types="jest" />
import type * as T from './types'
import {
  compareActivityLevels,
  compareTeamRoles,
  getTeamRowBadgeCount,
  initialMemberInfo,
  isSubteam,
  sortTeamnames,
  stringifyPeople,
  userInTeamNotBotWithInfo,
  userIsRoleInTeamWithInfo,
} from './teams'

describe('sortTeamnames', () => {
  test('sorts case insensitively', () => {
    expect(['beta', 'Alpha', 'gamma'].toSorted(sortTeamnames)).toEqual(['Alpha', 'beta', 'gamma'])
  })

  test('is a total order with a stable zero for equal names', () => {
    expect(sortTeamnames('a', 'A')).toBe(0)
    expect(sortTeamnames('a', 'b')).toBe(-1)
    expect(sortTeamnames('b', 'a')).toBe(1)
  })

  test('sorts a parent before its subteams', () => {
    expect(['keybase.core', 'keybase'].toSorted(sortTeamnames)).toEqual(['keybase', 'keybase.core'])
  })
})

describe('isSubteam', () => {
  test('needs at least one dot', () => {
    expect(isSubteam('keybase')).toBe(false)
    expect(isSubteam('keybase.core')).toBe(true)
    expect(isSubteam('keybase.core.deep')).toBe(true)
  })

  test('an empty name is not a subteam', () => {
    expect(isSubteam('')).toBe(false)
  })
})

describe('compareTeamRoles', () => {
  test('orders highest role first', () => {
    const roles: Array<T.Teams.MaybeTeamRoleType> = ['reader', 'owner', 'writer', 'admin', 'none', 'bot']
    expect(roles.toSorted(compareTeamRoles)).toEqual([
      'owner',
      'admin',
      'writer',
      'reader',
      'bot',
      'none',
    ])
  })

  test('equal roles compare equal', () => {
    expect(compareTeamRoles('admin', 'admin')).toBe(0)
  })
})

describe('compareActivityLevels', () => {
  test('orders active before recently before none', () => {
    expect(compareActivityLevels('active', 'recently')).toBeLessThan(0)
    expect(compareActivityLevels('recently', 'none')).toBeLessThan(0)
    expect(compareActivityLevels('none', 'active')).toBeGreaterThan(0)
  })

  test('treats undefined as none', () => {
    expect(compareActivityLevels(undefined, 'none')).toBe(0)
    expect(compareActivityLevels(undefined, 'active')).toBeGreaterThan(0)
  })
})

describe('stringifyPeople', () => {
  test('reads naturally up to three people', () => {
    expect(stringifyPeople([])).toBe('nobody')
    expect(stringifyPeople(['testuser'])).toBe('testuser')
    expect(stringifyPeople(['testuser', 'testuser-mac'])).toBe('testuser and testuser-mac')
    expect(stringifyPeople(['testuser', 'testuser-mac', 'carol'])).toBe('testuser, testuser-mac and carol')
  })

  test('summarizes past three people', () => {
    expect(stringifyPeople(['testuser', 'testuser-mac', 'carol', 'dave'])).toBe(
      'testuser, testuser-mac, and 2 others'
    )
    expect(stringifyPeople(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, and 3 others')
  })
})

describe('getTeamRowBadgeCount', () => {
  const requests = new Map([['id1', new Set(['testuser', 'testuser-mac'])]])
  const resets = new Map([['id1', new Set(['carol'])]])

  test('adds requests and resets for the team', () => {
    expect(getTeamRowBadgeCount(requests, resets, 'id1')).toBe(3)
  })

  test('is zero for a team in neither map', () => {
    expect(getTeamRowBadgeCount(requests, resets, 'other')).toBe(0)
  })

  test('counts one side when the other is missing', () => {
    expect(getTeamRowBadgeCount(requests, new Map(), 'id1')).toBe(2)
    expect(getTeamRowBadgeCount(new Map(), resets, 'id1')).toBe(1)
  })
})


describe('member info predicates', () => {
  const members = new Map([
    ['testuser', {...initialMemberInfo, type: 'admin' as const, username: 'testuser'}],
    ['botuser', {...initialMemberInfo, type: 'restrictedbot' as const, username: 'botuser'}],
  ])

  test('userInTeamNotBotWithInfo excludes bots and non-members', () => {
    expect(userInTeamNotBotWithInfo(members, 'testuser')).toBe(true)
    expect(userInTeamNotBotWithInfo(members, 'botuser')).toBe(false)
    expect(userInTeamNotBotWithInfo(members, 'nobody')).toBe(false)
  })

  test('userIsRoleInTeamWithInfo matches the exact role', () => {
    expect(userIsRoleInTeamWithInfo(members, 'testuser', 'admin')).toBe(true)
    expect(userIsRoleInTeamWithInfo(members, 'testuser', 'owner')).toBe(false)
    expect(userIsRoleInTeamWithInfo(members, 'nobody', 'admin')).toBe(false)
  })
})

