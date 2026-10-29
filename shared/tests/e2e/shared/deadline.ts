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
