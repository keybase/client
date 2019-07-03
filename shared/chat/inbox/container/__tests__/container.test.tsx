/* eslint-env jest */
import {_testing} from '../filtered'

jest.unmock('immutable')

describe('inbox container tests', () => {
  it('searching for yourself only', () => {
    expect(_testing.score('myname', 'myname', ['myname'])).toBe(100000)
  })
  it('ignore yourself otherwise', () => {
    const withYou = _testing.score('name', 'myname', ['myname', 'othername'])
    const withoutYou = _testing.score('name', 'myname', ['othername'])
    expect(withYou).toBe(withoutYou)
  })
  it('searching for nothing', () => {
    expect(_testing.score('nothing', 'myname', ['a', 'b', 'c'])).toBeLessThanOrEqual(0)
  })
  it('searching for exact', () => {
    const s1 = _testing.score('exact', 'myname', ['exact', 'b', 'c'])
    const s2 = _testing.score('exact', 'myname', ['a', 'exact', 'c'])
    const s3 = _testing.score('exact', 'myname', ['a', 'b', 'exact'])
    expect(s1).toBe(s2)
    expect(s2).toBe(s3)
  })
  it('exact beats exact + more', () => {
    const s1 = _testing.score('chris', 'cjb', ['chris'])
    const s2 = _testing.score('chris', 'cjb', ['chris', 'chrisnojima'])
    expect(s1).toBeGreaterThan(s2)
  })
  // This isn't strictly true as there's some points per number of participants
  it('exact > prefix > substr > nothing', () => {
    const exact = _testing.score('exact', 'myname', ['exact', 'b', 'c'])
    const prefix = _testing.score('prefix', 'myname', ['prefix12345', 'b', 'c'])
    const substr = _testing.score('substr', 'myname', ['123substr456', 'b', 'c'])
    const nothing = _testing.score('nothign', 'myname', ['a', 'b', 'c', 'd', 'e'])
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(substr)
    expect(substr).toBeGreaterThan(nothing)
  })
  it('matches of more names worse', () => {
    const onePrefix = _testing.score('prefix', 'myname', ['prefix1', 'b', 'c'])
    const twoPrefix = _testing.score('prefix', 'myname', ['prefix1', 'prefix2', 'c'])
    expect(onePrefix).toBeGreaterThan(twoPrefix)
  })
  it('matches ratio better', () => {
    const oneOfThree = _testing.score('prefix', 'myname', ['prefix1', 'b', 'c'])
    const oneOfSix = _testing.score('prefix', 'myname', ['prefix1', 'b', 'c', 'd', 'e', 'f'])
    expect(oneOfThree).toBeGreaterThan(oneOfSix)
  })
})
