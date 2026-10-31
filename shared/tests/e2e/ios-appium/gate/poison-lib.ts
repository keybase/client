// The gate-wide stop for a phone a flow could not put back: a setting that breaks the app for every
// later flow (a proxy, lockdown, the theme) whose restore failed poisons the gate, and the root
// beforeEach (hooks.ts) refuses every later test of every file, before it drives the app, naming what
// to put back by hand. A later restore of the same setting that reads back clears it.
const poisons = new Map<string, string>()

// `what` could not be put back; `byHand` says how the owner puts it back.
export const poisonGate = (what: string, byHand: string) => {
  poisons.set(what, byHand)
}

export const clearGatePoison = (what: string) => {
  poisons.delete(what)
}

// Why the gate refuses to run a test, or undefined when it may.
export const gatePoisoned = () =>
  poisons.size
    ? `refusing to run: an earlier flow could not put back ${[...poisons].map(([what, byHand]) => `${what} (${byHand})`).join('; ')}, so the phone may be broken for every later flow; put it back by hand and run the gate again`
    : undefined

export const requireGateNotPoisoned = () => {
  const why = gatePoisoned()
  if (why) throw new Error(why)
}
