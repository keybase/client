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
// them over, the one running included (a restore it cut off may not have finished), and the body
// runs no step after that. The returned function is called once the withCleanup is done.
export type TakeSteps = () => Array<() => unknown>
let keepSteps: (take: TakeSteps) => () => void = () => () => {}
export const setCleanupStepKeeper = (f: (take: TakeSteps) => () => void) => {
  keepSteps = f
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
      running = left.shift()
      try {
        await running?.()
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
