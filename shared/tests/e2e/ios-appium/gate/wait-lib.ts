// waitFor's loop (helpers/lifecycle.ts), free of the session and attempt so jest can test it.
import {isAttemptOver} from './attempt-binding-lib'

// Thrown by a waitFor check to end the wait at once, for a state no later look can change (an app that
// must not be launched again exited, another system alert is up). Any other error a check throws is
// retried until the wait times out.
export class WaitStopped extends Error {}

// Retries `check` until it answers a value, or throws with its last error once `timeout` passes. A
// WaitStopped, or a refusal of an attempt that is over, is thrown at once. `before` runs ahead of each
// check (it throws to refuse one), `pause` between checks.
export const pollFor = async <R>(
  what: string,
  check: () => Promise<R | undefined> | R | undefined,
  {interval, timeout}: {interval: number; timeout: number},
  io: {before: () => void; now: () => number; pause: (ms: number) => Promise<void>}
): Promise<R> => {
  const end = io.now() + timeout
  let lastErr: unknown
  for (;;) {
    io.before()
    try {
      const r = await check()
      if (r !== undefined) return r
    } catch (e) {
      if (e instanceof WaitStopped || isAttemptOver(e)) throw e
      lastErr = e
    }
    if (io.now() > end) {
      const detail = lastErr instanceof Error ? `: ${lastErr.message}` : ''
      throw new Error(`timed out after ${timeout}ms waiting for ${what}${detail}`)
    }
    await io.pause(interval)
  }
}
