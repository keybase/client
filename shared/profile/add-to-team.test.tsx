/// <reference types="jest" />
import type * as T from '@/constants/types'
import {getOwnerDisabledReason, makeAddUserToTeamsResult} from './add-to-team'

type Roles = Map<string, T.Teams.MaybeTeamRoleType>

const roles = (entries: Array<[string, T.Teams.MaybeTeamRoleType]>): Roles => new Map(entries)

describe('getOwnerDisabledReason', () => {
  test('no selection means no reason', () => {
    expect(getOwnerDisabledReason(new Set(), roles([]))).toBeUndefined()
  })

  test('a root team you own gives no reason', () => {
    expect(getOwnerDisabledReason(new Set(['keybase']), roles([['keybase', 'owner']]))).toBeUndefined()
  })

  test('every selected root team must be owned for there to be no reason', () => {
    expect(
      getOwnerDisabledReason(
        new Set(['keybase', 'kbtest']),
        roles([
          ['keybase', 'owner'],
          ['kbtest', 'owner'],
        ])
      )
    ).toBeUndefined()
  })

  test('a subteam can never have owners', () => {
    expect(getOwnerDisabledReason(new Set(['keybase.core']), roles([['keybase.core', 'owner']]))).toBe(
      'keybase.core is a subteam which cannot have owners.'
    )
  })

  test('the subteam check wins over the role check for a deep subteam', () => {
    expect(getOwnerDisabledReason(new Set(['a.b.c']), roles([['a.b.c', 'admin']]))).toBe(
      'a.b.c is a subteam which cannot have owners.'
    )
  })

  test('a root team you only admin reports that you are not an owner', () => {
    expect(getOwnerDisabledReason(new Set(['keybase']), roles([['keybase', 'admin']]))).toBe(
      'You are not an owner of keybase.'
    )
  })

  test('a team missing from the role map reports that you are not an owner', () => {
    expect(getOwnerDisabledReason(new Set(['keybase']), roles([]))).toBe('You are not an owner of keybase.')
  })

  test('a team with role none reports that you are not an owner', () => {
    expect(getOwnerDisabledReason(new Set(['keybase']), roles([['keybase', 'none']]))).toBe(
      'You are not an owner of keybase.'
    )
  })

  test('only the first offending team in selection order is reported', () => {
    const teamRoles = roles([
      ['keybase', 'owner'],
      ['kbtest', 'reader'],
      ['other', 'reader'],
    ])
    expect(getOwnerDisabledReason(new Set(['keybase', 'kbtest', 'other']), teamRoles)).toBe(
      'You are not an owner of kbtest.'
    )
    expect(getOwnerDisabledReason(new Set(['other', 'kbtest', 'keybase']), teamRoles)).toBe(
      'You are not an owner of other.'
    )
  })

  test('an owned root team earlier in the set does not mask a later subteam', () => {
    expect(
      getOwnerDisabledReason(
        new Set(['keybase', 'keybase.core']),
        roles([
          ['keybase', 'owner'],
          ['keybase.core', 'owner'],
        ])
      )
    ).toBe('keybase.core is a subteam which cannot have owners.')
  })
})

describe('makeAddUserToTeamsResult', () => {
  test('no teams and no errors is an empty string', () => {
    expect(makeAddUserToTeamsResult('testuser', [], [])).toBe('')
  })

  test('one team added', () => {
    expect(makeAddUserToTeamsResult('testuser', ['keybase'], [])).toBe('testuser was added to keybase.')
  })

  test('two teams added are joined with and', () => {
    expect(makeAddUserToTeamsResult('testuser', ['keybase', 'kbtest'], [])).toBe(
      'testuser was added to keybase and kbtest.'
    )
  })

  test('three teams added are listed in full', () => {
    expect(makeAddUserToTeamsResult('testuser', ['keybase', 'kbtest', 'other'], [])).toBe(
      'testuser was added to keybase, kbtest, and other.'
    )
  })

  test('four or more teams collapse into a count of the remainder', () => {
    expect(makeAddUserToTeamsResult('testuser', ['a', 'b', 'c', 'd'], [])).toBe(
      'testuser was added to a, b, and 2 teams.'
    )
    expect(makeAddUserToTeamsResult('testuser', ['a', 'b', 'c', 'd', 'e', 'f'], [])).toBe(
      'testuser was added to a, b, and 4 teams.'
    )
  })

  test('errors alone start the sentence with We', () => {
    expect(makeAddUserToTeamsResult('testuser', [], ['keybase'])).toBe(
      'We were unable to add testuser to keybase.'
    )
  })

  test('several errors alone are comma joined', () => {
    expect(makeAddUserToTeamsResult('testuser', [], ['keybase', 'kbtest'])).toBe(
      'We were unable to add testuser to keybase, kbtest.'
    )
  })

  test('successes and errors together are joined with But we', () => {
    expect(makeAddUserToTeamsResult('testuser-mac', ['keybase'], ['kbtest', 'other'])).toBe(
      'testuser-mac was added to keybase. But we were unable to add testuser-mac to kbtest, other.'
    )
  })

  test('the collapsed success form still gets the error clause appended', () => {
    expect(makeAddUserToTeamsResult('testuser', ['a', 'b', 'c', 'd'], ['e'])).toBe(
      'testuser was added to a, b, and 2 teams. But we were unable to add testuser to e.'
    )
  })
})
