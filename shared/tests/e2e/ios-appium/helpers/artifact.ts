// Lets a test declare that it captured nothing worth a report card.
//
// Some flows enumerate a fixed upper bound of states (e.g. one test per
// screenful of a long page) and only discover at runtime that a given index is
// past the end. Mocha's this.skip() is no good here: wdio's afterTest hook
// doesn't see the pending flag, so the run still writes a screenshot + json and
// the report gains a duplicate card marked failed. Instead the test sets this
// flag and returns; wdio.conf's afterTest consumes it and writes nothing.
let pending = false

export function skipArtifact(): void {
  pending = true
}

// Reads AND clears the flag — afterTest calls this exactly once per test, so a
// stale flag can never suppress the next test's artifacts.
export function consumeArtifactSkip(): boolean {
  const was = pending
  pending = false
  return was
}
