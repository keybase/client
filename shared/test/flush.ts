import {setImmediate} from 'node:timers'
import {act} from '@testing-library/react'

// Under jest's jsdom environment neither MessageChannel nor setImmediate is a global, so React's
// scheduler (scheduler 0.28) falls back to setTimeout(0), clamped to at least 1ms. A setState that
// lands outside act() therefore commits on a timer, which neither awaited microtasks nor a single
// setImmediate turn reliably waits for: setImmediate runs in the check phase of the current loop
// turn, usually before that timer is due. Measured: a state set from a settling promise had
// committed after one tick 0 of 20 times, and after flush() 20 of 20.
//
// flush() runs its turns inside act(): what settles during them is queued on act's own queue and
// committed as each act() ends, so it does not depend on the scheduler's timer at all. Use it for
// anything that renders.
//
// tick is one setImmediate turn on its own, for tests that render nothing: it lets pending promise
// chains and the check phase run without the clamp setTimeout(0) accrues once nested a few levels
// deep (about 1.25ms per turn), which dominates a test that waits in a loop. It comes from
// node:timers because the jsdom environment does not put setImmediate on globalThis.
export const tick = async () => new Promise<void>(resolve => setImmediate(resolve))

// `n` microtask turns and nothing else: for promise chains that never touch a timer or the engine
export const microtasks = async (n = 5) => {
  for (let i = 0; i < n; i++) {
    await Promise.resolve()
  }
}

// Turns inside act(), so React commits what each one scheduled
export const flush = async (turns = 4) => {
  for (let i = 0; i < turns; i++) {
    await act(tick)
  }
}

// One pass of the engine's timers for tests that render nothing: the listener hands incoming calls
// to their handlers on a 0ms timer, and a dialog ends its events on another once its RPC settles.
// Both are armed by microtasks a reply or push sets off, so those drain first: Node fires
// equal-delay timers in creation order, so ours has to be created after theirs. Armed earlier, ours
// can come due a millisecond before theirs and let the caller's check run ahead of them.
// `passes` runs it that many times over, for a chain of hops that each arm the next.
export const settle = async (passes = 1) => {
  for (let i = 0; i < passes; i++) {
    await tick()
    await new Promise(resolve => setTimeout(resolve, 0))
    await tick()
  }
}
