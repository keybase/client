// What runs between the body and the first cleanup step: nothing, unless a gate sets it. The iOS gate
// waits there for a hung app's relaunch still running (ios-appium/gate/hooks.ts), so no cleanup
// drives an app that is restarting.
let beforeSteps: () => Promise<void> = async () => {}
export const setBeforeCleanupSteps = (f: () => Promise<void>) => {
  beforeSteps = f
}

// Where a withCleanup puts the steps it has not run yet: nowhere, unless a gate sets it. The iOS
// gate keeps them with the test body (ios-appium/gate/attempt.ts): once the gate ends a body that is
// still running (a hung app it relaunched, or mocha timing it out), the body's own app commands are
// refused, so the gate takes the steps left and runs them itself after the relaunch. `take` hands
// them over and the body starts no step after that. The step the body is running then comes first,
// as a step that waits for the body's run of it to end (up to RUNNING_STEP_WAIT_MS) and runs it again
// only if that run threw (a restore cut off may not have finished), so one step never runs twice at
// once or after it passed. The returned function is called once the withCleanup is done.
export type TakeSteps = () => Array<() => unknown>
let keepSteps: (take: TakeSteps) => () => void = () => () => {}
export const setCleanupStepKeeper = (f: (take: TakeSteps) => () => void) => {
  keepSteps = f
}

export const RUNNING_STEP_WAIT_MS = 60_000

const afterRunEnds = (step: () => unknown, passed: Promise<boolean>) => async () => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), RUNNING_STEP_WAIT_MS)
  })
  try {
    const ran = await Promise.race([passed, timedOut])
    if (ran === 'timeout') throw new Error(`a cleanup step the body was running: still running after ${RUNNING_STEP_WAIT_MS / 1000}s`)
    if (ran) return
  } finally {
    clearTimeout(timer)
  }
  await step()
}

// Runs a test's body, then every cleanup step in order, each one whether the body or an earlier step
// threw. Restores and deletes go before UI cleanup, so a UI step that fails cannot skip them. Throws
// the body's error first and every cleanup error with it.
export const withCleanup = async (body: () => Promise<void>, steps: ReadonlyArray<() => unknown>): Promise<void> => {
  const errors: Array<unknown> = []
  const left = [...steps]
  let running: (() => unknown) | undefined
  const release = keepSteps(() => {
    const out = running ? [running, ...left] : [...left]
    running = undefined
    left.length = 0
    return out
  })
  try {
    try {
      await body()
    } catch (e) {
      errors.push(e)
    }
    try {
      await beforeSteps()
    } catch (e) {
      errors.push(e)
    }
    while (left.length) {
      const step = left.shift()
      if (!step) break
      const run = (async () => {
        await step()
      })()
      running = afterRunEnds(
        step,
        run.then(
          () => true,
          () => false
        )
      )
      try {
        await run
      } catch (e) {
        errors.push(e)
      } finally {
        running = undefined
      }
    }
  } finally {
    release()
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, errors.map(String).join('; '), {cause: errors[0]})
}
