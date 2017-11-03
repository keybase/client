// @noflow
/* eslint-env jest */
import {validTeamname} from '../teamname'

describe('validTeamname', () => {
  it('valid names', () => {
    const validNames = ['someteam', 'team.sub', 'team.sub.sub']
    for (let i = 0; i < validNames.length; ++i) {
      const validName = validNames[i]
      expect(validTeamname(validName)).toBe(true)
    }
  })
})
