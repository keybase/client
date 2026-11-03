// The gate-wide stop for a phone a flow could not put back: a setting that breaks the app for every
// later flow (a proxy, lockdown, the theme) whose restore failed poisons the gate, and the root
// beforeEach (hooks.ts) refuses every later test of every file, before it drives the app, naming what
// to put back by hand; every flow file's before and beforeEach hooks refuse first too
// (poisonCheckedFirst, which hooks.ts wraps each in), as they set the phone up for their file. Its
// afterEach and after hooks still run: they put things back, and a later restore of the same setting
// that reads back clears it.
import {isAttemptOver} from './attempt-binding-lib.ts'

const poisons = new Map<string, string>()

// The key for an app the gate could not bring back (crash.ts): every later test is refused until
// something brings it back and clears it.
export const APP_POISON = 'the Keybase app'

// `what` could not be put back; `byHand` says how the owner puts it back.
export const poisonGate = (what: string, byHand: string) => {
  poisons.set(what, byHand)
}

export const clearGatePoison = (what: string) => {
  poisons.delete(what)
}

// Runs `restore`: a failure poisons the gate under `what` (the phone or the account is left changed
// for every later flow), a success clears that poison. An attempt that is over poisons nothing: its
// late work must not undo what a later restore of the same thing cleared. `byHand` may be read only
// once the restore has failed, when it depends on how far the restore got.
export const guarded = async (what: string, byHand: string | (() => string), restore: () => unknown) => {
  try {
    await restore()
  } catch (e) {
    if (isAttemptOver(e)) throw e
    poisonGate(what, typeof byHand === 'string' ? byHand : byHand())
    throw e
  }
  clearGatePoison(what)
}

export const isGatePoisonedBy = (what: string) => poisons.has(what)

// Why the gate refuses to run a test, or undefined when it may.
export const gatePoisoned = () =>
  poisons.size
    ? `refusing to run: an earlier flow could not put back ${[...poisons].map(([what, byHand]) => `${what} (${byHand})`).join('; ')}, so the phone may be broken for every later flow; put it back by hand and run the gate again`
    : undefined

export const requireGateNotPoisoned = () => {
  const why = gatePoisoned()
  if (why) throw new Error(why)
}

// `fn`, refused before it runs while the gate is poisoned.
export const poisonCheckedFirst = <T, R>(fn: (this: T) => R | PromiseLike<R>) =>
  async function (this: T): Promise<R> {
    requireGateNotPoisoned()
    return fn.call(this)
  }
