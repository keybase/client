// Where an e2e run spends its time: every WebDriver command and every eval in the app is written, with
// its start, end and the harness line that issued it, to KB_E2E_TIMING_FILE (one JSON object a line).
// A gap with nothing in flight is the harness waiting (a sleep, a poll interval, a timeout running
// out); timing-report.mts charges each gap to the call that ended it. Without the variable nothing is
// written.
import * as fs from 'fs'

export type TimingEvent =
  | {kind: 'command' | 'eval' | 'expect' | 'fixture'; name: string; start: number; end: number; site: string}
  | {kind: 'test'; name: string; start: number; end: number; status: string}

const file = () => process.env['KB_E2E_TIMING_FILE']

export const timingOn = () => !!file()

export const writeTiming = (e: TimingEvent) => {
  const f = file()
  if (!f) return
  try {
    fs.appendFileSync(f, `${JSON.stringify(e)}\n`)
  } catch {
    // timing is a diagnostic: a failed write never fails the run
  }
}

const deepStack = () => {
  // the default 10 frames are all the WebDriver client's own before they reach the harness
  const limit = Error.stackTraceLimit
  Error.stackTraceLimit = 80
  try {
    return new Error().stack ?? ''
  } finally {
    Error.stackTraceLimit = limit
  }
}

// The first harness frames of the current stack (file:line, under tests/e2e, outside this module and
// the wdio config's hooks): the code that issued the command, which is the code that waited before it.
export const harnessSite = (stack = deepStack()) =>
  stack
    .split('\n')
    .map(l => /\/tests\/e2e\/(.+?):(\d+):\d+\)?$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map(m => `${m[1]}:${m[2]}`)
    .filter(s => !/^shared\/gate\/timing\.ts|^ios-appium\/wdio\.gate\.conf\.ts|^shared\/metro-eval\.ts/.test(s))
    .slice(0, 3)
    .join(' < ')

// Runs `f`, written as an eval event named `name`.
export const timedEval = async <R,>(name: string, f: () => Promise<R>): Promise<R> => {
  if (!timingOn()) return f()
  const site = harnessSite()
  const start = Date.now()
  try {
    return await f()
  } finally {
    writeTiming({end: Date.now(), kind: 'eval', name, site, start})
  }
}
