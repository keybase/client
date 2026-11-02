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
