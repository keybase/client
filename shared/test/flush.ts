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
export const flush = async (turns = 4) => {
  for (let i = 0; i < turns; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve))
    })
  }
}
