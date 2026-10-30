// Runs `f`, then `restore` whether `f` passed or threw; a failed restore after a failed `f` keeps
// both errors.
export const thenRestoring = async <R,>(f: () => Promise<R>, restore: () => Promise<void>, what: string): Promise<R> => {
  let result: R
  try {
    result = await f()
  } catch (e) {
    try {
      await restore()
    } catch (r) {
      throw new AggregateError([e, r], `${String(e)}; and then ${what} failed: ${String(r)}`, {cause: r})
    }
    throw e
  }
  await restore()
  return result
}

// Taps back (`tapBack`, false when the screen shows no back affordance yet) until `atTarget`, at most
// `maxTaps` times and until `timeoutMs`; a screen still sliding in shows none for a moment, so that
// waits rather than giving up. Throws naming how many backs it took.
export const backOutUntil = async (
  p: {atTarget: () => Promise<boolean>; tapBack: () => Promise<boolean>; what: string},
  opts: {maxTaps: number; now?: () => number; pause: () => Promise<void>; timeoutMs: number}
): Promise<number> => {
  const now = opts.now ?? Date.now
  const deadline = now() + opts.timeoutMs
  let taps = 0
  for (;;) {
    if (await p.atTarget()) return taps
    if (now() > deadline) throw new Error(`${p.what} never showed, after ${taps} backs in ${opts.timeoutMs}ms`)
    if (taps < opts.maxTaps && (await p.tapBack())) taps++
    await opts.pause()
  }
}
