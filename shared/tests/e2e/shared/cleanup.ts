// What runs between the body and the first cleanup step: nothing, unless a gate sets it. The iOS gate
// waits there for a hung app's relaunch still running (ios-appium/gate/hooks.ts), so no cleanup
// drives an app that is restarting.
let beforeSteps: () => Promise<void> = async () => {}
export const setBeforeCleanupSteps = (f: () => Promise<void>) => {
  beforeSteps = f
}

// Runs a test's body, then every cleanup step in order, each one whether the body or an earlier step
// threw. Restores and deletes go before UI cleanup, so a UI step that fails cannot skip them. Throws
// the body's error first and every cleanup error with it.
export const withCleanup = async (body: () => Promise<void>, steps: ReadonlyArray<() => unknown>): Promise<void> => {
  const errors: Array<unknown> = []
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
  for (const step of steps) {
    try {
      await step()
    } catch (e) {
      errors.push(e)
    }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, errors.map(String).join('; '), {cause: errors[0]})
}
