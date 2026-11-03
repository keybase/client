// Runs a step that makes the app send RPCs itself (an eval calling one) with the phone's recorder
// paused, so the census credits only what the UI sent.
type RecorderPause = {
  pause: () => Promise<string>
  resume: (token: string) => Promise<void>
}

// Pauses, runs f and resumes, also when f throws. A failed resume after f answered is thrown, naming
// `what`; after f threw, f's error is the one thrown (a pause left open ends at the next start()).
export const pausedAround = async <R>(p: RecorderPause, what: string, f: () => Promise<R>): Promise<R> => {
  const token = await p.pause()
  let out: R
  try {
    out = await f()
  } catch (e) {
    await p.resume(token).catch(() => {})
    throw e
  }
  try {
    await p.resume(token)
  } catch (e) {
    throw new Error(`resuming the recorder after ${what} failed: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
  return out
}
