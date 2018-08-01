// @flow
/* eslint-env jest */
import {toStringForLog} from '../string'

describe('toStringForLog', () => {
  it('undefined', () => {
    expect(toStringForLog(undefined)).toBe('undefined')
  })

  it('boolean', () => {
    expect(toStringForLog(true)).toBe('true')
    expect(toStringForLog(false)).toBe('false')
  })

  it('number', () => {
    expect(toStringForLog(3.14)).toBe('3.14')
    expect(toStringForLog(1 / 0)).toBe('Infinity')
    expect(toStringForLog(-1 / 0)).toBe('-Infinity')
    expect(toStringForLog(0 / 0)).toBe('NaN')
  })
})
