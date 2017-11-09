// @noflow
/* eslint-env jest */
import * as I from 'immutable'
import {validTeamname, baseTeamname, ancestorTeamnames, isExplicitAdmin, isImplicitAdmin} from '../teamname'

describe('teamname', () => {
  describe('validTeamname', () => {
    it('valid names', () => {
      const validNames = ['someteam', 'team.sub', 'team.sub.sub']
      for (let i = 0; i < validNames.length; ++i) {
        const validName = validNames[i]
        expect(validTeamname(validName)).toBe(true)
      }
    })

    it('invalid names', () => {
      const validNames = ['some team', 'team.some sub', 'team.sub.some sub', '$ometeam', 'someteam-']
      for (let i = 0; i < validNames.length; ++i) {
        const validName = validNames[i]
        expect(validTeamname(validName)).toBe(false)
      }
    })
  })

  it('baseTeamname', () => {
    expect(baseTeamname('team')).toBe(null)
    expect(baseTeamname('team.sub')).toBe('team')
    expect(baseTeamname('team.sub.sub')).toBe('team.sub')
  })

  it('ancestorTeamnames', () => {
    expect(ancestorTeamnames('team.sub.sub')).toEqual(['team.sub', 'team'])
    expect(ancestorTeamnames('team')).toEqual([])
  })

  it('isExplicitAdmin', () => {
    const memberInfo = I.Set([
      {username: 'alice', type: 'owner'},
      {username: 'bob', type: 'admin'},
      {username: 'charlie', type: 'writer'},
    ])

    expect(isExplicitAdmin(memberInfo, 'alice')).toBe(true)
    expect(isExplicitAdmin(memberInfo, 'bob')).toBe(true)
    expect(isExplicitAdmin(memberInfo, 'charlie')).toBe(false)
    expect(isExplicitAdmin(memberInfo, 'david')).toBe(false)
  })

  it('isImplicitAdmin', () => {
    const rootMemberInfo = I.Set([{username: 'alice', type: 'owner'}])

    const subMemberInfo = I.Set([{username: 'bob', type: 'admin'}])

    const ancestorMemberInfo = I.Map([['root', rootMemberInfo], ['root.sub', subMemberInfo]])

    expect(isImplicitAdmin(ancestorMemberInfo, 'alice')).toBe(true)
    expect(isImplicitAdmin(ancestorMemberInfo, 'bob')).toBe(true)
    expect(isImplicitAdmin(ancestorMemberInfo, 'charlie')).toBe(false)
    expect(isImplicitAdmin(ancestorMemberInfo, 'david')).toBe(false)
  })
})
