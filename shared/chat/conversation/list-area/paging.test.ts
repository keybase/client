/// <reference types="jest" />
import * as T from '@/constants/types'
import {nativePageDistances, withinPageLoad} from './paging'

const ords = (from: number, to: number) => {
  const out: Array<T.Chat.Ordinal> = []
  for (let i = to; i >= from; i--) out.push(T.Chat.numberToOrdinal(i))
  return out
}

describe('withinPageLoad', () => {
  test('two screens away or nearer is within reach of the next page', () => {
    expect(withinPageLoad(1600, 800)).toBe(true)
    expect(withinPageLoad(1601, 800)).toBe(false)
  })
})

describe('nativePageDistances', () => {
  const base = {content: 4000, offset: 1000, resting: 0, viewport: 800}
  test('with every row laid out, the older end is where the content ends', () => {
    const d = nativePageDistances({...base, oldestLaidOut: T.Chat.numberToOrdinal(1), ordinals: ords(1, 40)})
    expect(d).toEqual({newer: 1000, older: 4000 - 1000 - 800})
  })
  test('rows loaded past the oldest laid out count at the average height of those laid out', () => {
    // 40 rows laid out over 4000 points; 20 more loaded past them add 2000.
    const d = nativePageDistances({...base, oldestLaidOut: T.Chat.numberToOrdinal(21), ordinals: ords(1, 60)})
    expect(d.older).toBe(4000 - 1000 - 800 + 2000)
  })
  test('the newer end is the distance from the resting offset', () => {
    const d = nativePageDistances({
      ...base,
      offset: -100,
      oldestLaidOut: T.Chat.numberToOrdinal(1),
      ordinals: ords(1, 40),
      resting: -300,
    })
    expect(d.newer).toBe(200)
  })
  test('an oldest laid out row no longer loaded counts the rows newer than it as laid out', () => {
    const d = nativePageDistances({...base, oldestLaidOut: T.Chat.numberToOrdinal(20), ordinals: ords(21, 60)})
    expect(d.older).toBe(4000 - 1000 - 800)
  })
})
