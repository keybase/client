/* eslint-env jest */
import {toStringForLog} from '../string'

describe('toStringForLog', () => {
  it('undefined', () => {
    expect(toStringForLog(undefined)).toBe('undefined')
  })

  it('null', () => {
    expect(toStringForLog(null)).toBe('null')
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

  it('string', () => {
    expect(toStringForLog('')).toBe('')
    expect(toStringForLog('some string')).toBe('some string')
  })

  it('symbol', () => {
    expect(toStringForLog(Symbol('foo'))).toBe('Symbol(foo)')
    expect(toStringForLog(Symbol(3))).toBe('Symbol(3)')
  })

  it('function', () => {
    const fn = x => x + x
    expect(toStringForLog(fn)).toBe(fn.toString())
  })

  it('error', () => {
    const err = new Error('my error')
    expect(toStringForLog(err)).toBe(err.stack)
  })

  it('object', () => {
    expect(toStringForLog({x: 3, y: true, z: null})).toBe('{"x":3,"y":true,"z":null}')
  })
})
