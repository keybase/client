/* eslint-env jest */
import {validTeamname} from '../teamname'

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
})
