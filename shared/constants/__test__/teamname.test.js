// @noflow
/* eslint-env jest */
import * as I from 'immutable'
import {validTeamname, baseTeamname, ancestorTeamnames, isAdmin} from '../teamname'

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

  it('isAdmin', () => {
    const rootMemberInfo = I.Set([
      {username: 'alice', type: 'owner'},
      {username: 'bob', type: 'admin'},
      {username: 'charlie', type: 'writer'},
    ])
    const subInfo = I.Set([{username: 'charlie', type: 'admin'}])
    const subSubInfo = I.Set([])

    expect(isAdmin(rootMemberInfo, I.Map(), 'alice')).toBe(true)
    expect(isAdmin(rootMemberInfo, I.Map(), 'bob')).toBe(true)
    expect(isAdmin(rootMemberInfo, I.Map(), 'charlie')).toBe(false)
    expect(isAdmin(rootMemberInfo, I.Map(), 'david')).toBe(false)

    const subAncestorMemberInfo = I.Map([['root', rootMemberInfo]])

    expect(isAdmin(subInfo, subAncestorMemberInfo, 'alice')).toBe(true)
    expect(isAdmin(subInfo, subAncestorMemberInfo, 'bob')).toBe(true)
    expect(isAdmin(subInfo, subAncestorMemberInfo, 'charlie')).toBe(true)
    expect(isAdmin(subInfo, subAncestorMemberInfo, 'david')).toBe(false)

    const subSubAncestorMemberInfo = I.Map([['root', rootMemberInfo], ['root.sub', subInfo]])

    expect(isAdmin(subSubInfo, subSubAncestorMemberInfo, 'alice')).toBe(true)
    expect(isAdmin(subSubInfo, subSubAncestorMemberInfo, 'bob')).toBe(true)
    expect(isAdmin(subSubInfo, subSubAncestorMemberInfo, 'charlie')).toBe(true)
    expect(isAdmin(subSubInfo, subSubAncestorMemberInfo, 'david')).toBe(false)
  })
})
