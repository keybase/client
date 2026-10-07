/// <reference types="jest" />
import {RPCError} from '@/util/errors'
import {makeWaitingTracker} from './waiting-tracker'
import type {WaitingChange} from './types'
import {testWaitingKey} from '@/test/waiting-key'

const key = testWaitingKey('tracker-test')

const make = (opts?: {noKey: true}) => {
  const changes: Array<WaitingChange> = []
  const logged: Array<boolean> = []
  const tracker = makeWaitingTracker(
    opts?.noKey ? undefined : key,
    c => changes.push(c),
    w => logged.push(w)
  )
  // The key's count as the store would hold it
  const count = () => changes.reduce((n, c) => n + (c.increment === undefined ? 0 : c.increment ? 1 : -1), 0)
  return {changes, count, logged, tracker}
}

const boom = new RPCError('boom', 7)

test('starts waiting on the service', () => {
  const {changes, logged} = make()
  expect(changes).toEqual([{increment: true, key}])
  expect(logged).toEqual([true])
})

test('a held prompt stops waiting until it is released', () => {
  const {changes, count, tracker} = make()
  const release = tracker.holdPrompt()
  expect(count()).toBe(0)
  release()
  expect(count()).toBe(1)
  expect(changes).toEqual([
    {increment: true, key},
    {error: undefined, increment: false, key},
    {increment: true, key},
  ])
})

test('with two prompts held, it waits again only once both are released', () => {
  const {count, tracker} = make()
  const a = tracker.holdPrompt()
  const b = tracker.holdPrompt()
  a()
  expect(count()).toBe(0)
  b()
  expect(count()).toBe(1)
})

test('a release runs once', () => {
  const {changes, count, tracker} = make()
  const a = tracker.holdPrompt()
  const b = tracker.holdPrompt()
  a()
  a()
  expect(count()).toBe(0)
  b()
  b()
  expect(count()).toBe(1)
  expect(changes).toHaveLength(3)
})

test('server work held while a prompt is held keeps waiting on', () => {
  const {changes, count, tracker} = make()
  const prompt = tracker.holdPrompt()
  expect(count()).toBe(0)
  const work = tracker.holdServerWork()
  expect(count()).toBe(1)
  work()
  work()
  expect(count()).toBe(0)
  prompt()
  expect(count()).toBe(1)
  expect(changes).toHaveLength(5)
})

test('server work held with no prompt changes nothing', () => {
  const {changes, tracker} = make()
  const work = tracker.holdServerWork()
  const prompt = tracker.holdPrompt()
  prompt()
  work()
  expect(changes).toEqual([{increment: true, key}])
})

test('settle stops waiting with its error, once', () => {
  const {changes, count, logged, tracker} = make()
  expect(tracker.settle(boom)).toBe(true)
  expect(count()).toBe(0)
  expect(changes.at(-1)).toEqual({error: boom, increment: false, key})
  expect(tracker.settle(boom)).toBe(false)
  expect(tracker.settle()).toBe(false)
  expect(changes).toHaveLength(2)
  expect(logged).toEqual([true, false])
})

test('settle while a prompt is held records only its error', () => {
  const {changes, count, tracker} = make()
  tracker.holdPrompt()
  tracker.settle(boom)
  expect(count()).toBe(0)
  expect(changes.at(-1)).toEqual({error: boom, key})
})

test('settle while a prompt is held, with no error, changes nothing', () => {
  const {changes, tracker} = make()
  tracker.holdPrompt()
  const before = changes.length
  tracker.settle()
  expect(changes).toHaveLength(before)
})

test('settle ends held server work and prompts; their releases change nothing', () => {
  const {changes, count, tracker} = make()
  const prompt = tracker.holdPrompt()
  const work = tracker.holdServerWork()
  tracker.settle()
  expect(count()).toBe(0)
  const before = changes.length
  work()
  prompt()
  expect(changes).toHaveLength(before)
})

test('nothing can be held after settle', () => {
  const {changes, tracker} = make()
  tracker.settle()
  const before = changes.length
  tracker.holdPrompt()()
  tracker.holdServerWork()()
  expect(changes).toHaveLength(before)
})

test('with no key it emits nothing but still logs', () => {
  const {changes, logged, tracker} = make({noKey: true})
  const release = tracker.holdPrompt()
  release()
  tracker.settle(boom)
  expect(changes).toEqual([])
  expect(logged).toEqual([true, false, true, false])
})

// Small seeded generator, so a failure replays
const makeRandom = (seed: number) => {
  let s = seed
  return (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s % n
  }
}

test('any interleaving keeps the count 0 or 1, matching the model, and settles once', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const random = makeRandom(seed)
    const {changes, count, tracker} = make()
    const prompts: Array<() => void> = []
    const work: Array<() => void> = []
    let livePrompts = 0
    let liveWork = 0
    const releasedPrompts = new Set<() => void>()
    const releasedWork = new Set<() => void>()
    let settledWith: {error?: RPCError} | undefined
    for (let step = 0; step < 30; step++) {
      const before = changes.length
      const op = random(7)
      if (op === 0) {
        prompts.push(tracker.holdPrompt())
        if (!settledWith) livePrompts++
      } else if (op === 1) {
        work.push(tracker.holdServerWork())
        if (!settledWith) liveWork++
      } else if (op === 2 && prompts.length) {
        const r = prompts[random(prompts.length)]!
        if (!releasedPrompts.has(r) && !settledWith) livePrompts--
        releasedPrompts.add(r)
        r()
      } else if (op === 3 && work.length) {
        const r = work[random(work.length)]!
        if (!releasedWork.has(r) && !settledWith) liveWork--
        releasedWork.add(r)
        r()
      } else if (op === 4 && random(4) === 0) {
        const wasWaiting = count() === 1
        const error = random(2) ? boom : undefined
        const first = tracker.settle(error)
        expect(first).toBe(!settledWith)
        if (first) {
          settledWith = {error}
          const emitted = changes.slice(before)
          if (wasWaiting) {
            expect(emitted).toEqual([{error, increment: false, key}])
          } else {
            expect(emitted).toEqual(error ? [{error, key}] : [])
          }
        } else {
          expect(changes).toHaveLength(before)
        }
      }
      const expected = !settledWith && (livePrompts === 0 || liveWork > 0)
      expect(count()).toBe(expected ? 1 : 0)
      if (settledWith && step > 0) {
        // Nothing but the settle itself is emitted once settled
        expect(changes.slice(before).every(c => c.increment !== true)).toBe(true)
      }
    }
    // Never two changes in a row in the same direction
    const steps = changes.filter(c => c.increment !== undefined).map(c => c.increment)
    steps.forEach((s, i) => expect(s).toBe(i % 2 === 0))
  }
})

test.each([
  ['a cancel by the client', new RPCError('c', 237, null, undefined, undefined, {reason: 'caller', type: 'cancelled'})],
  ['a cancel by the service', new RPCError('Input canceled', 239)],
  ['a local failure', new RPCError('write failed', 101, null, 'EOF', undefined, {type: 'local'})],
])('settle with %s records nothing', (_, error) => {
  const {changes, tracker} = make()
  tracker.settle(error)
  expect(changes.at(-1)).toEqual({error: undefined, increment: false, key})
})

test('settle with a lost link records it', () => {
  const {changes, tracker} = make()
  const lost = new RPCError('lost', 101, null, 'EOF', undefined, {reason: 'disconnect', type: 'cancelled'})
  tracker.settle(lost)
  expect(changes.at(-1)).toEqual({error: lost, increment: false, key})
})
