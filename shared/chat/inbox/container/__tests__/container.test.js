// @noflow
/* eslint-env jest */
import {_testing} from '../filtered'

jest.unmock('immutable')

describe('inbox container tests', () => {
  it('searching for yourself only', () => {
    expect(_testing.score('myname', 'myname', ['myname'])).toBe(1)
  })
  it('ignore yourself otherwise', () => {
    const withYou = _testing.score('name', 'myname', ['myname', 'othername'])
    const withoutYou = _testing.score('name', 'myname', ['othername'])
    expect(withYou).toBe(withoutYou)
  })
  it('searching for nothing', () => {
    expect(_testing.score('nothing', 'myname', ['a', 'b', 'c'])).toBe(0)
  })
  it('searching for exact', () => {
    const oneExactScore = 1 / 3
    expect(_testing.score('exact', 'myname', ['exact', 'b', 'c'])).toBeCloseTo(oneExactScore)
    expect(_testing.score('exact', 'myname', ['a', 'exact', 'c'])).toBeCloseTo(oneExactScore)
    expect(_testing.score('exact', 'myname', ['a', 'b', 'exact'])).toBeCloseTo(oneExactScore)
  })
  it('exact > prefix > substr > nothing', () => {
    const exact = _testing.score('exact', 'myname', ['exact', 'b', 'c'])
    const prefix = _testing.score('prefix', 'myname', ['prefix12345', 'b', 'c'])
    const substr = _testing.score('substr', 'myname', ['123substr456', 'b', 'c'])
    const nothing = _testing.score('nothign', 'myname', ['a', 'b', 'c'])
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(substr)
    expect(substr).toBeGreaterThan(nothing)
  })
  it('matches of more names better', () => {
    const onePrefix = _testing.score('prefix', 'myname', ['prefix1', 'b', 'c'])
    const twoPrefix = _testing.score('prefix', 'myname', ['prefix1', 'prefix2', 'c'])
    expect(twoPrefix).toBeGreaterThan(onePrefix)
  })
  it('matches ratio better', () => {
    const oneOfThree = _testing.score('prefix', 'myname', ['prefix1', 'b', 'c'])
    const oneOfSix = _testing.score('prefix', 'myname', ['prefix1', 'b', 'c', 'd', 'e', 'f'])
    expect(oneOfThree).toBeGreaterThan(oneOfSix)
  })
})
