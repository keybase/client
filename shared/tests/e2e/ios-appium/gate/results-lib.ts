// The gate's attempt records as a Playwright json report, the shape the release summary, the census
// and the flow report read (tests/e2e/shared/gate). Free of I/O so it can be tested.
import type {AttemptRecord} from './attempt.ts'

type Annotation = AttemptRecord['annotations'][number]
type GateResult = {
  status: AttemptRecord['status']
  duration: number
  retry: number
  errors: Array<{message: string}>
  attachments: AttemptRecord['attachments']
}
export type GateTest = {
  projectName: string
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped'
  annotations: Array<Annotation>
  results: Array<GateResult>
}
type GateSpec = {file: string; title: string; tests: Array<GateTest>}
// a SuiteOf<GateTest> (release-lib.ts) whose specs and suites are always present
type GateSuite = {title: string; file?: string; specs: Array<GateSpec>; suites: Array<GateSuite>}
export type GateReport = {suites: Array<GateSuite>; errors: Array<string>}

const testStatus = (attempts: ReadonlyArray<AttemptRecord>): GateTest['status'] => {
  if (attempts.every(a => a.status === 'skipped')) return 'skipped'
  if (attempts.at(-1)?.status !== 'passed') return 'unexpected'
  return attempts.some(a => a.status === 'failed') ? 'flaky' : 'expected'
}

const uniqueAnnotations = (attempts: ReadonlyArray<AttemptRecord>) => {
  const seen = new Set<string>()
  return attempts
    .flatMap(a => a.annotations)
    .filter(n => {
      const key = JSON.stringify([n.type, n.description])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const suite = (title: string, file?: string): GateSuite => ({...(file ? {file} : {}), specs: [], suites: [], title})

// One suite per spec file, a suite per describe inside it, and one spec per test whose results are
// its attempts in the order they ran.
export const buildPwReport = (attempts: ReadonlyArray<AttemptRecord>, project: string): GateReport => {
  const byTest = new Map<string, Array<AttemptRecord>>()
  for (const a of attempts) {
    const key = JSON.stringify([a.file, a.titlePath])
    const got = byTest.get(key)
    if (got) got.push(a)
    else byTest.set(key, [a])
  }
  const files = new Map<string, GateSuite>()
  for (const runs of byTest.values()) {
    const [first] = runs
    if (!first) continue
    let parent = files.get(first.file)
    if (!parent) {
      parent = suite(first.file.replace(/^.*\//, ''), first.file)
      files.set(first.file, parent)
    }
    const describes = first.titlePath.slice(0, -1)
    for (const d of describes) {
      const p: GateSuite = parent
      let child: GateSuite | undefined = p.suites.find(s => s.title === d)
      if (!child) {
        child = suite(d)
        p.suites.push(child)
      }
      parent = child
    }
    parent.specs.push({
      file: first.file,
      tests: [
        {
          annotations: uniqueAnnotations(runs),
          projectName: project,
          results: runs.map(a => ({
            attachments: a.attachments,
            duration: a.durationMs,
            errors: a.error ? [{message: a.error}] : [],
            retry: a.attempt,
            status: a.status,
          })),
          status: testStatus(runs),
        },
      ],
      title: first.titlePath.at(-1) ?? '',
    })
  }
  return {errors: [], suites: [...files.values()]}
}

// The .test.ts file of the first stack frame in one, as an absolute path. A flow file imported by the
// gate's aggregator registers its tests while mocha still names the aggregator as their file.
export const testFileFromStack = (stack: string): string | undefined => {
  for (const line of stack.split('\n')) {
    const m = /(?:\(|\s)((?:file:\/\/)?\/[^\s()]*\.test\.ts):\d+:\d+\)?$/.exec(line)
    if (m?.[1]) return m[1].startsWith('file://') ? decodeURIComponent(new URL(m[1]).pathname) : m[1]
  }
  return undefined
}

type TreeSuite<T> = {tests: ReadonlyArray<T>; suites: ReadonlyArray<TreeSuite<T>>}
type TreeTest = {isPending: () => boolean; fullTitle: () => string}

// mocha's grep option as mocha compiles a string: "/re/flags" or a plain pattern.
export const mochaGrep = (grep: string | undefined): RegExp | undefined => {
  if (!grep) return undefined
  const m = /^\/(.*)\/([a-z]*)$|.*/.exec(grep)
  return new RegExp(m?.[1] || m?.[0] || grep, m?.[2])
}

// The tests of a run that began no attempt, among those its grep selected: pending ones (mocha runs
// no hooks for it.skip, describe.skip, xit; a test skipped from its own body did begin one) and
// ones that never ran (a hook failed first, or the run stopped), each with its suites innermost first.
export const unranTests = <T extends TreeTest>(
  root: TreeSuite<T>,
  ran: (t: T) => boolean,
  grep: RegExp | undefined
): {pending: Array<T>; neverRan: Array<{test: T; suites: Array<TreeSuite<T>>}>} => {
  const pending: Array<T> = []
  const neverRan: Array<{test: T; suites: Array<TreeSuite<T>>}> = []
  const walk = (s: TreeSuite<T>, outer: Array<TreeSuite<T>>) => {
    const suites = [s, ...outer]
    for (const t of s.tests) {
      if (ran(t) || (grep && !grep.test(t.fullTitle()))) continue
      if (t.isPending()) pending.push(t)
      else neverRan.push({suites, test: t})
    }
    for (const c of s.suites) walk(c, suites)
  }
  walk(root, [])
  return {neverRan, pending}
}

export const timeoutMessage = (ms: number) => `Timeout of ${ms}ms exceeded`

export type HookState = {title: string; state?: string; timedOut?: boolean; timeout: () => number}

// What a failed mocha hook says: the error the gate's hook wrapper kept, or mocha's timeout.
export const hookFailure = (hook: HookState, error: string | undefined): string | undefined => {
  if (hook.state !== 'failed') return undefined
  return `${hook.title} failed: ${error ?? (hook.timedOut ? timeoutMessage(hook.timeout()) : 'no error was recorded')}`
}
