// @flow
/* eslint-env jest */
import {toStringForLog} from '../string'

describe('toStringForLog', () => {
  it('undefined', () => {
    expect(toStringForLog(undefined)).toBe('undefined')
  })
})
