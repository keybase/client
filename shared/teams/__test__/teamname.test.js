// @noflow
/* eslint-env jest */
import {validTeamname, baseTeamname, ancestorTeamnames} from '../teamname'

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
})
