// Playwright's half of the run timing (shared/gate/timing.ts): each test, and each action, expect and
// fixture or hook step in it, with its start, end and the line that ran it. Writes nothing unless
// KB_E2E_TIMING_FILE is set.
import * as path from 'path'
import type {Reporter, TestCase, TestResult, TestStep} from '@playwright/test/reporter'
import {timingOn, writeTiming} from '../shared/gate/timing.ts'

const e2eDir = path.resolve(__dirname, '..')

const kindOf = (category: string) =>
  category === 'pw:api' ? 'command' : category === 'expect' ? 'expect' : category === 'hook' || category === 'fixture' ? 'fixture' : undefined

export default class TimingReporter implements Reporter {
  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep) {
    const kind = timingOn() ? kindOf(step.category) : undefined
    if (!kind) return
    const start = step.startTime.getTime()
    const site = step.location ? `${path.relative(e2eDir, step.location.file)}:${step.location.line}` : ''
    // an action's title can quote what it typed or filled: only its verb is kept
    const name = kind === 'command' ? step.title.split(/[\s(]/, 1)[0] ?? '' : kind === 'expect' ? step.title.split(/\s/, 2).join(' ') : step.title
    writeTiming({end: start + step.duration, kind, name, site, start})
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (!timingOn()) return
    const start = result.startTime.getTime()
    writeTiming({end: start + result.duration, kind: 'test', name: test.titlePath().slice(2).join(' > '), start, status: result.status})
  }
}
