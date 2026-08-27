/// <reference types="jest" />
import * as T from './types'
import {
  compareActivityLevels,
  compareTeamRoles,
  deriveCanPerform,
  getTeamRowBadgeCount,
  initialCanUserPerform,
  initialMemberInfo,
  isSubteam,
  makeRetentionPolicy,
  retentionPolicyToServiceRetentionPolicy,
  serviceRetentionPolicyToRetentionPolicy,
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

describe('deriveCanPerform', () => {
  test('returns the all-false defaults with no role', () => {
    expect(deriveCanPerform()).toBe(initialCanUserPerform)
  })

  test('an owner can do owner-only things', () => {
    const owner = deriveCanPerform({implicitAdmin: false, role: 'owner'})
    expect(owner.deleteTeam).toBe(true)
    expect(owner.manageMembers).toBe(true)
    expect(owner.chat).toBe(true)
    expect(owner.renameTeam).toBe(false)
  })

  test('an admin can manage but not delete the team', () => {
    const admin = deriveCanPerform({implicitAdmin: false, role: 'admin'})
    expect(admin.deleteTeam).toBe(false)
    expect(admin.manageMembers).toBe(true)
    expect(admin.setRetentionPolicy).toBe(true)
  })

  test('a writer can create channels but not manage members', () => {
    const writer = deriveCanPerform({implicitAdmin: false, role: 'writer'})
    expect(writer.createChannel).toBe(true)
    expect(writer.pinMessage).toBe(true)
    expect(writer.manageMembers).toBe(false)
    expect(writer.deleteChannel).toBe(false)
  })

  test('a reader and a bot can chat but nothing else', () => {
    for (const role of ['reader', 'bot'] as const) {
      const p = deriveCanPerform({implicitAdmin: false, role})
      expect(p.chat).toBe(true)
      expect(p.createChannel).toBe(false)
      expect(p.manageMembers).toBe(false)
    }
  })

  test('a non-member has nothing, and cannot even chat', () => {
    const none = deriveCanPerform({implicitAdmin: false, role: 'none'})
    expect(none.chat).toBe(false)
    expect(none.joinTeam).toBe(false)
  })

  test('an implicit admin gets subteam powers without being a member', () => {
    const implicit = deriveCanPerform({implicitAdmin: true, role: 'none'})
    expect(implicit.manageMembers).toBe(true)
    expect(implicit.renameTeam).toBe(true)
    expect(implicit.listFirst).toBe(true)
    expect(implicit.joinTeam).toBe(true)
    expect(implicit.deleteTeam).toBe(true)
    // still not a member, so still no chat
    expect(implicit.chat).toBe(false)
  })

  test('caches by role and implicit admin', () => {
    expect(deriveCanPerform({implicitAdmin: false, role: 'writer'})).toBe(
      deriveCanPerform({implicitAdmin: false, role: 'writer'})
    )
    expect(deriveCanPerform({implicitAdmin: true, role: 'writer'})).not.toBe(
      deriveCanPerform({implicitAdmin: false, role: 'writer'})
    )
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

describe('retention policy conversion', () => {
  test('a missing service policy means retain', () => {
    expect(serviceRetentionPolicyToRetentionPolicy()).toEqual(makeRetentionPolicy({type: 'retain'}))
    expect(serviceRetentionPolicyToRetentionPolicy(null)).toEqual(makeRetentionPolicy({type: 'retain'}))
  })

  test('a known expire age gets its canonical title', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({
        expire: {age: 30 * 3600 * 24},
        typ: T.RPCChat.RetentionPolicyType.expire,
      })
    ).toEqual({seconds: 30 * 3600 * 24, title: '30 days', type: 'expire'})
  })

  test('an unknown age falls back to a seconds title', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({
        expire: {age: 12345},
        typ: T.RPCChat.RetentionPolicyType.expire,
      })
    ).toEqual({seconds: 12345, title: '12345 seconds', type: 'expire'})
  })

  test('ephemeral becomes explode', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({
        ephemeral: {age: 30},
        typ: T.RPCChat.RetentionPolicyType.ephemeral,
      })
    ).toEqual({seconds: 30, title: '30 seconds', type: 'explode'})
  })

  test('inherit round trips back to the service shape', () => {
    const policy = serviceRetentionPolicyToRetentionPolicy({
      inherit: {},
      typ: T.RPCChat.RetentionPolicyType.inherit,
    })
    expect(policy).toEqual({seconds: 0, title: '', type: 'inherit'})
    expect(retentionPolicyToServiceRetentionPolicy(policy)).toEqual({
      inherit: {},
      typ: T.RPCChat.RetentionPolicyType.inherit,
    })
  })

  test('explode maps back to ephemeral, expire back to expire', () => {
    expect(retentionPolicyToServiceRetentionPolicy(makeRetentionPolicy({seconds: 30, type: 'explode'})))
      .toEqual({ephemeral: {age: 30}, typ: T.RPCChat.RetentionPolicyType.ephemeral})
    expect(retentionPolicyToServiceRetentionPolicy(makeRetentionPolicy({seconds: 99, type: 'expire'}))).toEqual(
      {expire: {age: 99}, typ: T.RPCChat.RetentionPolicyType.expire}
    )
  })

  test('makeRetentionPolicy fills in defaults and honors overrides', () => {
    expect(makeRetentionPolicy()).toEqual({seconds: 0, title: '', type: 'retain'})
    expect(makeRetentionPolicy({seconds: 5})).toEqual({seconds: 5, title: '', type: 'retain'})
  })
})
