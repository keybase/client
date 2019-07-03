/* eslint-env jest */
import {getLoopInterval} from '../exploding-meta'

const oneMinInMs = 60 * 1000
const oneHrInMs = oneMinInMs * 60
const oneDayInMs = oneHrInMs * 24

describe('getLoopInterval', () => {
  it('handles minutes correctly', () => {
    // comments here apply to all, they all follow this pattern

    // 1:32 should check in 2s
    const diff1 = oneMinInMs + 32000
    const e1 = 2000
    // 1:28 should check in 28s
    const diff2 = oneMinInMs + 28000
    const e2 = 28000
    // 2:12 should check in 42s (=> 1:30)
    const diff3 = oneMinInMs * 2 + 12000
    const e3 = oneMinInMs / 2 + 12000
    // ~2:38 should check in ~8s
    const diff4 = oneMinInMs * 2 + 38950
    const e4 = 8950
    // 3:00 should check in 30s (=> 2:30)
    const diff5 = oneMinInMs * 3
    const e5 = oneMinInMs / 2
    // 1:30 should check in 30s (=> 60s)
    const diff6 = oneMinInMs + oneMinInMs / 2
    const e6 = oneMinInMs / 2
    // 1:30 + 1ms should check in 1ms (=> 1:30)
    const diff7 = diff6 + 1
    const e7 = 1

    expect(getLoopInterval(diff1)).toBe(e1)
    expect(getLoopInterval(diff2)).toBe(e2)
    expect(getLoopInterval(diff3)).toBe(e3)
    expect(getLoopInterval(diff4)).toBe(e4)
    expect(getLoopInterval(diff5)).toBe(e5)
    expect(getLoopInterval(diff6)).toBe(e6)
    expect(getLoopInterval(diff7)).toBe(e7)
  })
  it('handles hours correctly', () => {
    const diff1 = oneHrInMs + 32 * oneMinInMs
    const e1 = 2 * oneMinInMs
    const diff2 = oneHrInMs + 28 * oneMinInMs
    const e2 = 28 * oneMinInMs
    const diff3 = oneHrInMs * 2 + 17 * oneMinInMs
    const e3 = oneHrInMs / 2 + 17 * oneMinInMs
    const diff4 = oneHrInMs * 2 + 38 * oneMinInMs + 4261
    const e4 = 8 * oneMinInMs + 4261
    const diff5 = oneHrInMs * 3
    const e5 = oneHrInMs / 2
    const diff6 = oneHrInMs + oneHrInMs / 2
    const e6 = oneHrInMs / 2
    const diff7 = diff6 + 1
    const e7 = 1

    expect(getLoopInterval(diff1)).toBe(e1)
    expect(getLoopInterval(diff2)).toBe(e2)
    expect(getLoopInterval(diff3)).toBe(e3)
    expect(getLoopInterval(diff4)).toBe(e4)
    expect(getLoopInterval(diff5)).toBe(e5)
    expect(getLoopInterval(diff6)).toBe(e6)
    expect(getLoopInterval(diff7)).toBe(e7)
  })
  it('handles days correctly', () => {
    const diff1 = oneDayInMs + 15 * oneHrInMs
    const e1 = 3 * oneHrInMs
    const diff2 = oneDayInMs + 11.5 * oneHrInMs
    const e2 = 11.5 * oneHrInMs
    const diff3 = oneDayInMs * 2 + 7 * oneHrInMs
    const e3 = oneDayInMs / 2 + 7 * oneHrInMs
    const diff4 = oneDayInMs * 2 + 15 * oneHrInMs + 33 * oneMinInMs + 14565
    const e4 = 3 * oneHrInMs + 33 * oneMinInMs + 14565
    const diff5 = oneDayInMs * 3
    const e5 = oneDayInMs / 2
    const diff6 = oneDayInMs + oneDayInMs / 2
    const e6 = oneDayInMs / 2
    const diff7 = diff6 + 1
    const e7 = 1

    expect(getLoopInterval(diff1)).toBe(e1)
    expect(getLoopInterval(diff2)).toBe(e2)
    expect(getLoopInterval(diff3)).toBe(e3)
    expect(getLoopInterval(diff4)).toBe(e4)
    expect(getLoopInterval(diff5)).toBe(e5)
    expect(getLoopInterval(diff6)).toBe(e6)
    expect(getLoopInterval(diff7)).toBe(e7)
  })
})
