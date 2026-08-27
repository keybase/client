/// <reference types="jest" />
import type * as T from '@/constants/types'
import {orderTeams} from './container'

const makeTeam = (teamname: string, role: T.Teams.MaybeTeamRoleType = 'reader'): T.Teams.TeamMeta => ({
  allowPromote: false,
  id: `id-${teamname}`,
  isMember: true,
  isOpen: false,
  memberCount: 1,
  role,
  showcasing: false,
  teamname,
})

const noRequests = new Map<T.Teams.TeamID, ReadonlySet<string>>()
const noResets = new Map<T.Teams.TeamID, ReadonlySet<string>>()
const noNew = new Set<T.Teams.TeamID>()
const noActivity: T.Teams.ActivityLevels = {channels: new Map(), loaded: false, teams: new Map()}

const activityFor = (entries: ReadonlyArray<[string, T.Teams.ActivityLevel]>): T.Teams.ActivityLevels => ({
  channels: new Map(),
  loaded: true,
  teams: new Map(entries),
})

const order = (
  teams: ReadonlyArray<T.Teams.TeamMeta>,
  opts: {
    activityLevels?: T.Teams.ActivityLevels
    filter?: string
    newRequests?: ReadonlyMap<T.Teams.TeamID, ReadonlySet<string>>
    newTeams?: ReadonlySet<T.Teams.TeamID>
    resets?: ReadonlyMap<T.Teams.TeamID, ReadonlySet<string>>
    sortOrder?: T.Teams.TeamListSort
  } = {}
) =>
  orderTeams(
    teams,
    opts.newRequests ?? noRequests,
    opts.resets ?? noResets,
    opts.newTeams ?? noNew,
    opts.sortOrder ?? 'alphabetical',
    opts.activityLevels ?? noActivity,
    opts.filter ?? ''
  ).map(t => t.teamname)

describe('orderTeams filtering', () => {
  const teams = [makeTeam('keybasefriends'), makeTeam('Keybase'), makeTeam('other')]

  test('an empty filter keeps everything', () => {
    expect(order(teams)).toEqual(['Keybase', 'keybasefriends', 'other'])
  })

  test('filtering is a case-insensitive substring match', () => {
    expect(order(teams, {filter: 'KEYBASE'})).toEqual(['Keybase', 'keybasefriends'])
    expect(order(teams, {filter: 'friends'})).toEqual(['keybasefriends'])
  })

  test('surrounding whitespace in the filter is ignored', () => {
    expect(order(teams, {filter: '  other  '})).toEqual(['other'])
  })

  test('a filter that matches nothing yields nothing', () => {
    expect(order(teams, {filter: 'nope'})).toEqual([])
  })

  test('an empty team list stays empty', () => {
    expect(order([])).toEqual([])
    expect(order([], {filter: 'anything'})).toEqual([])
  })

  test('a single team is returned as is', () => {
    expect(order([makeTeam('solo')])).toEqual(['solo'])
  })

  test('the input array is never sorted in place', () => {
    const input = [makeTeam('zeta'), makeTeam('alpha')]
    const names = input.map(t => t.teamname)
    expect(order(input)).toEqual(['alpha', 'zeta'])
    expect(input.map(t => t.teamname)).toEqual(names)
  })

  test('the input array is not sorted in place when filtering either', () => {
    const input = [makeTeam('zeta'), makeTeam('alpha')]
    expect(order(input, {filter: 'a'})).toEqual(['alpha', 'zeta'])
    expect(input.map(t => t.teamname)).toEqual(['zeta', 'alpha'])
  })
})

describe('orderTeams badge and new-team priority', () => {
  test('teams with badges sort first, by badge count descending', () => {
    const teams = [makeTeam('quiet'), makeTeam('loud'), makeTeam('some')]
    const requests = new Map([['id-loud', new Set(['a', 'b', 'c'])]])
    const resets = new Map([['id-some', new Set(['d'])]])
    expect(order(teams, {newRequests: requests, resets})).toEqual(['loud', 'some', 'quiet'])
  })

  test('requests and resets add up into one badge count', () => {
    const teams = [makeTeam('requests'), makeTeam('both')]
    const requests = new Map([
      ['id-requests', new Set(['a', 'b'])],
      ['id-both', new Set(['a'])],
    ])
    const resets = new Map([['id-both', new Set(['b', 'c'])]])
    expect(order(teams, {newRequests: requests, resets})).toEqual(['both', 'requests'])
  })

  test('new teams sort ahead of the rest but behind badged teams', () => {
    const teams = [makeTeam('aaa'), makeTeam('zzz'), makeTeam('badged')]
    expect(
      order(teams, {
        newRequests: new Map([['id-badged', new Set(['a'])]]),
        newTeams: new Set(['id-zzz']),
      })
    ).toEqual(['badged', 'zzz', 'aaa'])
  })

  test('badges outrank the sort order', () => {
    const teams = [makeTeam('owned', 'owner'), makeTeam('read', 'reader')]
    expect(
      order(teams, {newRequests: new Map([['id-read', new Set(['a'])]]), sortOrder: 'role'})
    ).toEqual(['read', 'owned'])
  })

  test('two equally badged teams fall through to the sort order', () => {
    const teams = [makeTeam('zzz', 'owner'), makeTeam('aaa', 'reader')]
    const requests = new Map([
      ['id-zzz', new Set(['a'])],
      ['id-aaa', new Set(['b'])],
    ])
    expect(order(teams, {newRequests: requests, sortOrder: 'role'})).toEqual(['zzz', 'aaa'])
  })
})

describe('orderTeams sort orders', () => {
  test('alphabetical uses localeCompare, so case does not split the list', () => {
    const teams = [makeTeam('banana'), makeTeam('Apple'), makeTeam('apricot')]
    expect(order(teams, {sortOrder: 'alphabetical'})).toEqual(['Apple', 'apricot', 'banana'])
  })

  test('role sorts owner > admin > writer > reader > bot > restrictedbot', () => {
    const teams = [
      makeTeam('e', 'bot'),
      makeTeam('c', 'writer'),
      makeTeam('a', 'owner'),
      makeTeam('f', 'restrictedbot'),
      makeTeam('d', 'reader'),
      makeTeam('b', 'admin'),
    ]
    expect(order(teams, {sortOrder: 'role'})).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  test('equal roles break the tie alphabetically', () => {
    const teams = [makeTeam('zzz', 'admin'), makeTeam('aaa', 'admin')]
    expect(order(teams, {sortOrder: 'role'})).toEqual(['aaa', 'zzz'])
  })

  test('activity sorts active > recently > none, and unknown counts as none', () => {
    const teams = [makeTeam('quiet'), makeTeam('busy'), makeTeam('sometimes'), makeTeam('unknown')]
    const activityLevels = activityFor([
      ['id-busy', 'active'],
      ['id-sometimes', 'recently'],
      ['id-quiet', 'none'],
    ])
    expect(order(teams, {activityLevels, sortOrder: 'activity'})).toEqual([
      'busy',
      'sometimes',
      'quiet',
      'unknown',
    ])
  })

  test('equal activity breaks the tie alphabetically', () => {
    const teams = [makeTeam('zzz'), makeTeam('aaa')]
    const activityLevels = activityFor([
      ['id-zzz', 'active'],
      ['id-aaa', 'active'],
    ])
    expect(order(teams, {activityLevels, sortOrder: 'activity'})).toEqual(['aaa', 'zzz'])
  })

  test('the activity sort ignores roles and the role sort ignores activity', () => {
    const teams = [makeTeam('reader-active', 'reader'), makeTeam('owner-quiet', 'owner')]
    const activityLevels = activityFor([['id-reader-active', 'active']])
    expect(order(teams, {activityLevels, sortOrder: 'activity'})).toEqual([
      'reader-active',
      'owner-quiet',
    ])
    expect(order(teams, {activityLevels, sortOrder: 'role'})).toEqual(['owner-quiet', 'reader-active'])
  })

  test('filtering and sorting compose', () => {
    const teams = [makeTeam('keybase.core', 'reader'), makeTeam('keybase.ops', 'owner'), makeTeam('other')]
    expect(order(teams, {filter: 'keybase', sortOrder: 'role'})).toEqual(['keybase.ops', 'keybase.core'])
  })
})
