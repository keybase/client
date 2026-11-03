import {attemptOverMessage} from './attempt-binding-lib'
import {pollFor, WaitStopped} from './wait-lib'

// a clock that moves only when the loop pauses
const clock = () => {
  let t = 0
  return {
    before: () => {},
    now: () => t,
    pause: async (ms: number) => {
      t += ms
      return Promise.resolve()
    },
  }
}

test('a check is retried through its errors until it answers', async () => {
  let n = 0
  const got = await pollFor(
    'the thing',
    () => {
      if (++n < 3) throw new Error('not yet')
      return n
    },
    {interval: 100, timeout: 1_000},
    clock()
  )
  expect(got).toBe(3)
})

test('running out of time names the wait and the last error', async () => {
  await expect(
    pollFor(
      'the thing',
      () => {
        throw new Error('still not')
      },
      {interval: 100, timeout: 300},
      clock()
    )
  ).rejects.toThrow('timed out after 300ms waiting for the thing: still not')
})

test('a WaitStopped from the check ends the wait at once, unwrapped', async () => {
  let n = 0
  const stop = new WaitStopped('the app exited')
  await expect(
    pollFor(
      'the thing',
      () => {
        n++
        throw stop
      },
      {interval: 100, timeout: 10_000},
      clock()
    )
  ).rejects.toBe(stop)
  expect(n).toBe(1)
})

test('an attempt that is over ends the wait at once', async () => {
  let n = 0
  await expect(
    pollFor(
      'the thing',
      () => {
        n++
        throw new Error(attemptOverMessage('a test'))
      },
      {interval: 100, timeout: 10_000},
      clock()
    )
  ).rejects.toThrow(/^attempt over: a test$/)
  expect(n).toBe(1)
})
