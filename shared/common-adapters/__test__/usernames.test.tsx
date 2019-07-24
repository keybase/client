/* eslint-env jest */
import {assertionToDisplay} from '../usernames'

describe('assertionToDisplay', () => {
  it('parses phone numbers', () => {
    const testCases = [
      '15550123456@phone', // valid
      '1234@phone', // invalid
    ]
    const expected = ['+1 (555) 012-3456', '+1 234']
    for (let i = 0; i < testCases.length; i++) {
      expect(assertionToDisplay(testCases[i])).toEqual(expected[i])
    }
  })

  it('parses email addresses', () => {})
})
