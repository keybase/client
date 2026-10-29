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
