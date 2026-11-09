// Where a run's time went, from the KB_E2E_TIMING_FILE it wrote (timing.ts):
//
//   node tests/e2e/shared/gate/timing-report.mts <timing.jsonl> [top N, default 20]
//
// Idle is test time with nothing in flight (no command, eval or expect): the harness sleeping, or a
// poll waiting out its interval or timeout. Each idle gap is charged to the call that ended it, the
// code that resumed after the wait. Expect time is Playwright waiting for the app inside an expect
// (its own polling), so a long one is a wait too. Sums by site can overlap where calls nest.
import * as fs from 'fs'
import type {TimingEvent} from './timing.ts'

type Span = Extract<TimingEvent, {site: string}>
type TestSpan = Extract<TimingEvent, {kind: 'test'}>

export type TimingSummary = {
  tests: number
  testMs: number
  idleMs: number
  expectMs: number
  idleBySite: Array<[string, number, number]>
  expectBySite: Array<[string, number, number]>
  commandBySite: Array<[string, number, number]>
  slowestTests: Array<[string, number, number]>
}

const add = (m: Map<string, [number, number]>, k: string, ms: number) => {
  const v = m.get(k) ?? [0, 0]
  m.set(k, [v[0] + ms, v[1] + 1])
}
const top = (m: Map<string, [number, number]>, n: number): Array<[string, number, number]> =>
  [...m].map(([k, [ms, count]]): [string, number, number] => [k, ms, count]).sort((a, b) => b[1] - a[1]).slice(0, n)

export const summarize = (events: ReadonlyArray<TimingEvent>, n = 20): TimingSummary => {
  const tests = events.filter((e): e is TestSpan => e.kind === 'test')
  const spans = events.filter((e): e is Span => e.kind !== 'test').sort((a, b) => a.start - b.start)
  const idle = new Map<string, [number, number]>()
  const expects = new Map<string, [number, number]>()
  const commands = new Map<string, [number, number]>()
  let idleMs = 0
  let expectMs = 0
  for (const t of tests) {
    const inside = spans.filter(s => s.start >= t.start && s.end <= t.end)
    let covered = t.start
    for (const s of inside) {
      if (s.start > covered) {
        const gap = s.start - covered
        idleMs += gap
        add(idle, `${s.site} (before ${s.kind} ${s.name})`, gap)
      }
      covered = Math.max(covered, s.end)
    }
    if (t.end > covered) {
      idleMs += t.end - covered
      add(idle, '(after the last call, to the test end)', t.end - covered)
    }
    for (const s of inside) {
      const ms = s.end - s.start
      if (s.kind === 'expect') {
        expectMs += ms
        add(expects, `${s.site} ${s.name}`, ms)
      } else {
        add(commands, `${s.site} ${s.kind} ${s.name}`, ms)
      }
    }
  }
  const byTest = new Map<string, [number, number]>()
  for (const t of tests) add(byTest, t.name, t.end - t.start)
  return {
    commandBySite: top(commands, n),
    expectBySite: top(expects, n),
    expectMs,
    idleBySite: top(idle, n),
    idleMs,
    slowestTests: top(byTest, n),
    testMs: tests.reduce((sum, t) => sum + t.end - t.start, 0),
    tests: tests.length,
  }
}

const s = (ms: number) => `${(ms / 1000).toFixed(1)}s`
const table = (title: string, rows: Array<[string, number, number]>) =>
  [`## ${title}`, '', '| time | calls | where |', '| ---: | ---: | --- |', ...rows.map(([k, ms, c]) => `| ${s(ms)} | ${c} | ${k} |`), ''].join('\n')

export const render = (r: TimingSummary) =>
  [
    `# Run timing`,
    '',
    `${r.tests} tests, ${s(r.testMs)} in tests: ${s(r.idleMs)} idle (${Math.round((100 * r.idleMs) / Math.max(1, r.testMs))}%), ${s(r.expectMs)} inside expects`,
    '',
    table('Idle, charged to the call that ended the wait', r.idleBySite),
    table('Inside expects (waiting for the app)', r.expectBySite),
    table('Commands and evals', r.commandBySite),
    table('Slowest tests', r.slowestTests),
  ].join('\n')

export const readTiming = (file: string): Array<TimingEvent> =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l) as TimingEvent)

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, n] = process.argv.slice(2)
  if (!file) {
    console.error('usage: timing-report.mts <timing.jsonl> [top N]')
    process.exit(2)
  }
  console.log(render(summarize(readTiming(file), n ? Number(n) : 20)))
}
