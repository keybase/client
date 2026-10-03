import {setImmediate} from 'node:timers'
import {act} from '@testing-library/react'

// A setState that lands outside act() - every load settling on its own - is
// scheduled on React's MessageChannel, i.e. a macrotask. A flush built only from
// awaited microtasks never lets the event loop reach it, so the commit lands (or
// not) depending on how the runtime happens to interleave: it needs a real
// macrotask turn.
//
// setImmediate is that macrotask (the check phase, which runs after the pending
// MessageChannel callbacks) without the clamp setTimeout(0) accrues once it is
// nested a few levels deep - the difference is roughly 1.25ms per turn versus
// nothing, which dominates any test that flushes in a loop. It comes from
// node:timers because the jsdom environment does not put it on globalThis.
//
// tick is one such turn on its own, for tests that render nothing.
export const tick = async () => new Promise<void>(resolve => setImmediate(resolve))

// Turns inside act(), so React commits what each one scheduled
export const flush = async (turns = 4) => {
  for (let i = 0; i < turns; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(tick)
  }
}

// One pass of the engine's timers for tests that render nothing: the listener hands incoming calls
// to their handlers on a 0ms timer, and a dialog ends its events on another once its RPC settles.
// Both are armed by microtasks a reply or push sets off, so those drain first: Node fires
// equal-delay timers in creation order, so ours has to be created after theirs. Armed earlier, ours
// can come due a millisecond before theirs and let the caller's check run ahead of them.
export const settle = async () => {
  await tick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await tick()
}
