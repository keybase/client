// The phone's chat outbox as its service logs it (ios.log), kept free of I/O so jest can test it. No
// RPC lists the outbox; the service's deliverer pulls every pending record each interval and logs one
// "flushing N items" line per conversation that has any, and one "failed to send msg" line, with the
// record's outbox id, per record it could not send. A pending record keeps the app background active
// (AppDidEnterBackground: "active deliveries in progress") for as long as it retries (up to an hour),
// so a background wait in any later flow would fail.

const STARTED = /Deliverer: deliverLoop: starting non blocking sender deliver loop: uid: \S+ duration: (\d+(?:\.\d+)?)(ms|s|m)\b/
const FLUSHING = /Deliverer: deliverLoop: flushing (\d+) items from the outbox: uid: \S+, convID ([0-9a-f]+)/
const FAILED = /Deliverer: deliverLoop: failed to send msg: uid: \S+ convID: ([0-9a-f]+) obid: ([0-9a-f]+) /
const CANCELLED = /- (?:Server: )?CancelPost\(([0-9a-f]+)\) -> ok/

// The deliverer's interval, from the line it logs as it starts, or undefined before it has.
export const delivererInterval = (lines: ReadonlyArray<string>): number | undefined => {
  for (const l of lines) {
    const m = STARTED.exec(l)
    if (m) return Number(m[1]) * {m: 60_000, ms: 1, s: 1_000}[m[2] as 'm' | 'ms' | 's']
  }
  return undefined
}

// The pending records per conversation, as the last flush of each logged them.
export const outboxFlushes = (lines: ReadonlyArray<string>) => {
  const out = new Map<string, number>()
  for (const l of lines) {
    const m = FLUSHING.exec(l)
    if (m) out.set(m[2] ?? '', Number(m[1]))
  }
  return out
}

// The outbox ids of the records the deliverer failed to send in `convIDs`, never another
// conversation's.
export const failedOutboxIDs = (lines: ReadonlyArray<string>, convIDs: ReadonlySet<string>) => {
  const out = new Set<string>()
  for (const l of lines) {
    const m = FAILED.exec(l)
    if (m && convIDs.has(m[1] ?? '')) out.add(m[2] ?? '')
  }
  return [...out]
}

// The outbox ids the service logged a CancelPost of as done.
export const cancelledOutboxIDs = (lines: ReadonlyArray<string>) => {
  const out = new Set<string>()
  for (const l of lines) {
    const m = CANCELLED.exec(l)
    if (m) out.add(m[1] ?? '')
  }
  return out
}

// Why a run may not start on this outbox: it names the count only, never a conversation or a body.
export const pendingOutboxProblem = (flushes: ReadonlyMap<string, number>, device: string): string | undefined => {
  if (flushes.size === 0) return undefined
  const items = [...flushes.values()].reduce((a, b) => a + b, 0)
  return (
    `the Keybase app on ${device} has ${items} chat message${items === 1 ? '' : 's'} pending in its outbox ` +
    `(${flushes.size} conversation${flushes.size === 1 ? '' : 's'}), which keeps it background active and fails ` +
    'every background wait; it retries them for up to an hour (a run left them: the location flow cleans its own), ' +
    'so wait for them to expire or delete them from their conversations in the app, then rerun'
  )
}

const STAMP = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) /

// The log lines from the first stamped at or after `at` (ms) on.
export const linesFrom = (lines: ReadonlyArray<string>, at: number) => {
  const i = lines.findIndex(l => {
    const m = STAMP.exec(l)
    return !!m && Date.parse(m[1] ?? '') >= at
  })
  return i < 0 ? [] : lines.slice(i)
}
