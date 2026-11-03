// Deadlines for the e2e harness's waits: each names what it waited for.

export const withDeadline = async <T,>(p: Promise<T>, ms: number, what: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${what}: no answer in ${ms / 1000}s`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(timer)
  }
}

// Runs `work` under a hard deadline of `ms`: past it the call rejects, and the `alive` check `work`
// is handed throws, so a step it starts after then never runs (a call already sent finishes on its
// own). For work that taps or types, which must not go on under a caller that has moved on.
export const underDeadline = async <T,>(what: string, ms: number, work: (alive: () => void) => Promise<T>): Promise<T> => {
  const end = Date.now() + ms
  const alive = () => {
    if (Date.now() > end) throw new Error(`${what}: past its ${ms / 1000}s deadline`)
  }
  const running = work(alive)
  // its own rejection after the deadline has no one waiting on it
  running.catch(() => {})
  return withDeadline(running, ms, what)
}

export type AbortableResult<T> = {ok: true; value: T} | {ok: false; settled: boolean; message: string}

// Runs `work` with a signal that aborts at `ms`. A timed-out run waits up to `settleMs` for the work
// to stop, so nothing it started is still going when this returns, unless `settled` is false.
export const runAbortable = async <T,>(
  what: string,
  ms: number,
  settleMs: number,
  work: (signal: AbortSignal) => Promise<T>
): Promise<AbortableResult<T>> => {
  const controller = new AbortController()
  const running = work(controller.signal)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), ms)
  })
  try {
    const first = await Promise.race([running.then(value => ({value})), timedOut])
    if (first !== 'timeout') return {ok: true, value: first.value}
  } finally {
    clearTimeout(timer)
  }
  controller.abort(new Error(`${what}: not done in ${ms / 1000}s`))
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const settled = await Promise.race([
    running.then(
      () => true,
      () => true
    ),
    new Promise<boolean>(resolve => {
      settleTimer = setTimeout(() => resolve(false), settleMs)
    }),
  ])
  clearTimeout(settleTimer)
  return settled
    ? {message: `${what}: not done in ${ms / 1000}s; stopped it`, ok: false, settled}
    : {message: `${what}: not done in ${ms / 1000}s, and still running ${settleMs / 1000}s after it was told to stop`, ok: false, settled}
}

// Asks `check` every `interval` ms until it answers something other than undefined, and returns that.
// Past `timeout` it throws naming `what`, with the last error `check` threw. Framework-free: the host
// read-backs the desktop and iOS flows share poll through it.
export const waitFor = async <R,>(
  what: string,
  check: () => Promise<R | undefined>,
  {interval = 1_000, timeout}: {interval?: number; timeout: number}
): Promise<R> => {
  const end = Date.now() + timeout
  let lastErr: unknown
  for (;;) {
    try {
      const r = await check()
      if (r !== undefined) return r
    } catch (e) {
      lastErr = e
    }
    if (Date.now() > end) {
      const detail = lastErr instanceof Error ? `: ${lastErr.message}` : ''
      throw new Error(`timed out after ${timeout / 1000}s waiting for ${what}${detail}`)
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}
