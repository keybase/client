import {backOutUntil, thenRestoring} from './restore'

const fail = (m: string) => async () => Promise.reject(new Error(m))

test('the restore runs after a pass, and its failure is the error', async () => {
  const order: Array<string> = []
  const f = async () => {
    order.push('f')
    return Promise.resolve(1)
  }
  const restore = async () => {
    order.push('restore')
    return Promise.resolve()
  }
  await expect(thenRestoring(f, restore, 'x')).resolves.toBe(1)
  expect(order).toEqual(['f', 'restore'])
  await expect(thenRestoring(async () => Promise.resolve(1), fail('restore broke'), 'x')).rejects.toThrow('restore broke')
})

test('the restore runs after a failure, which stays the error', async () => {
  let restored = false
  const restore = async () => {
    restored = true
    return Promise.resolve()
  }
  await expect(thenRestoring(fail('f broke'), restore, 'x')).rejects.toThrow(/^f broke$/)
  expect(restored).toBe(true)
})

test('a failed restore after a failure keeps both errors', async () => {
  const got = await thenRestoring(fail('f broke'), fail('restore broke'), 'switching back').catch((e: unknown) => e)
  expect(got).toBeInstanceOf(AggregateError)
  const agg = got as AggregateError
  expect(agg.message).toBe('Error: f broke; and then switching back failed: Error: restore broke')
  expect(agg.errors.map((e: Error) => e.message)).toEqual(['f broke', 'restore broke'])
})

describe('backOutUntil', () => {
  const clock = () => {
    let t = 0
    return {now: () => t, pause: async () => Promise.resolve(void (t += 500))}
  }
  test('taps back until the target shows, waiting out a screen with no back yet', async () => {
    const c = clock()
    const screens = ['sub2', 'sub1', 'sliding', 'list']
    let at = 0
    const tapBack = async () => {
      if (screens[at] === 'sliding') {
        at++
        return Promise.resolve(false)
      }
      at++
      return Promise.resolve(true)
    }
    const taps = await backOutUntil(
      {atTarget: async () => Promise.resolve(screens[at] === 'list'), tapBack, what: 'the list'},
      {maxTaps: 6, now: c.now, pause: c.pause, timeoutMs: 10_000}
    )
    expect(taps).toBe(2)
  })
  const counted = () => {
    const t = {
      n: 0,
      tapBack: async () => {
        t.n++
        return Promise.resolve(true)
      },
    }
    return t
  }
  test('is done at once on the target, with no tap', async () => {
    const t = counted()
    const c = clock()
    await expect(backOutUntil({atTarget: async () => Promise.resolve(true), tapBack: t.tapBack, what: 'x'}, {maxTaps: 6, ...c, timeoutMs: 1})).resolves.toBe(0)
    expect(t.n).toBe(0)
  })
  test('stops tapping at maxTaps and fails at the deadline', async () => {
    const t = counted()
    const c = clock()
    await expect(
      backOutUntil({atTarget: async () => Promise.resolve(false), tapBack: t.tapBack, what: 'the list'}, {maxTaps: 3, ...c, timeoutMs: 5_000})
    ).rejects.toThrow('the list never showed, after 3 backs in 5000ms')
    expect(t.n).toBe(3)
  })
})
