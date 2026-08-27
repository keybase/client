/// <reference types="jest" />
import type * as T from '@/constants/types'
import {initialCanUserPerform} from '@/constants/teams'
import {getOrderedBotsArray, getOrderedMemberArray, sortInvites} from './helpers'

const member = (
  username: string,
  type: T.Teams.TeamRoleType,
  status: T.Teams.MemberStatus = 'active'
): T.Teams.MemberInfo => ({fullName: '', needsPUK: false, status, type, username})

const membersMap = (...ms: Array<T.Teams.MemberInfo>) => new Map(ms.map(m => [m.username, m]))

const ops = (over?: Partial<T.Teams.TeamOperations>): T.Teams.TeamOperations => ({
  ...initialCanUserPerform,
  ...over,
})

const names = (ms: Array<T.Teams.MemberInfo>) => ms.map(m => m.username)

describe('getOrderedMemberArray', () => {
  test('missing member info yields an empty list', () => {
    expect(getOrderedMemberArray(undefined, 'testuser', ops())).toEqual([])
    expect(getOrderedMemberArray(new Map(), 'testuser', ops())).toEqual([])
  })

  test('orders owner, admin, writer, reader and breaks ties alphabetically', () => {
    const result = getOrderedMemberArray(
      membersMap(
        member('zed-reader', 'reader'),
        member('amy-writer', 'writer'),
        member('bob-admin', 'admin'),
        member('carl-owner', 'owner'),
        member('abe-reader', 'reader')
      ),
      'nobody',
      ops()
    )
    expect(names(result)).toEqual(['carl-owner', 'bob-admin', 'amy-writer', 'abe-reader', 'zed-reader'])
  })

  test('bots and restricted bots are never in the member list', () => {
    const result = getOrderedMemberArray(
      membersMap(
        member('testuser', 'writer'),
        member('a-bot', 'bot'),
        member('a-restrictedbot', 'restrictedbot')
      ),
      'nobody',
      ops()
    )
    expect(names(result)).toEqual(['testuser'])
  })

  test('admins do not see reset members here - they show up under requests', () => {
    const result = getOrderedMemberArray(
      membersMap(member('testuser', 'writer'), member('testuser-mac', 'writer', 'reset')),
      'testuser',
      ops({manageMembers: true})
    )
    expect(names(result)).toEqual(['testuser'])
  })

  test('members without manage permission still see reset members inline', () => {
    const result = getOrderedMemberArray(
      membersMap(member('testuser', 'writer'), member('testuser-mac', 'writer', 'reset')),
      'testuser',
      ops({manageMembers: false})
    )
    expect(names(result)).toEqual(['testuser', 'testuser-mac'])
  })

  test('actionable statuses float to the top only when you can act on them', () => {
    const roster = membersMap(
      member('active-writer', 'writer'),
      member('deleted-writer', 'writer', 'deleted')
    )
    // manage permission: deleted is actionable so it comes first
    expect(names(getOrderedMemberArray(roster, 'nobody', ops({manageMembers: true})))).toEqual([
      'deleted-writer',
      'active-writer',
    ])
    // without it, status is neutral and the tie falls through to the username
    expect(names(getOrderedMemberArray(roster, 'nobody', ops({manageMembers: false})))).toEqual([
      'active-writer',
      'deleted-writer',
    ])
  })

  test('listFirst pins you to the top regardless of role', () => {
    const result = getOrderedMemberArray(
      membersMap(member('boss', 'owner'), member('testuser', 'reader')),
      'testuser',
      ops({listFirst: true})
    )
    expect(names(result)).toEqual(['testuser', 'boss'])
  })

  test('without listFirst you sort by role like anyone else', () => {
    const result = getOrderedMemberArray(
      membersMap(member('boss', 'owner'), member('testuser', 'reader')),
      'testuser',
      ops({listFirst: false})
    )
    expect(names(result)).toEqual(['boss', 'testuser'])
  })
})

describe('getOrderedBotsArray', () => {
  test('keeps only bots, sorted alphabetically', () => {
    const result = getOrderedBotsArray(
      membersMap(
        member('zbot', 'bot'),
        member('testuser', 'admin'),
        member('abot', 'restrictedbot'),
        member('mbot', 'bot')
      )
    )
    expect(names(result)).toEqual(['abot', 'mbot', 'zbot'])
  })

  test('missing member info yields an empty list', () => {
    expect(getOrderedBotsArray(undefined)).toEqual([])
  })
})

describe('sortInvites', () => {
  const inv = (over: Partial<T.Teams.InviteInfo>): T.Teams.InviteInfo => ({
    email: '',
    id: '',
    name: '',
    phone: '',
    role: 'writer',
    username: '',
    ...over,
  })

  test('sorts by the first non-empty of email, username, name, id', () => {
    const invites = [
      inv({id: 'zzz'}),
      inv({id: '2', username: 'mid-user'}),
      inv({email: 'aaa@b.com', id: '3'}),
      inv({id: '4', name: 'nnn-token'}),
    ]
    expect([...invites].sort(sortInvites).map(i => i.id)).toEqual(['3', '2', '4', 'zzz'])
  })

  test('email wins over username on the same invite', () => {
    const withBoth = inv({email: 'aaa@b.com', id: '1', username: 'zzz-user'})
    const other = inv({id: '2', username: 'mmm-user'})
    expect([other, withBoth].sort(sortInvites).map(i => i.id)).toEqual(['1', '2'])
  })
})
