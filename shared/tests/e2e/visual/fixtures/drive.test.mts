/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/require-await -- node:test registers top-level tests; they are not awaited. Fakes stand in for async hooks */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {fixtureCapture, type FixtureHooks} from './drive.mts'
import {FIXTURE_RUNTIME_VERSION} from './names.ts'
import type {EndReport} from './runtime.ts'

type FakeApp = {active: boolean; ended: number; begins: number; report: EndReport}

// Runs each body the way the app does, against a fake __kbVisualFixtures. `failAfter` makes the
// eval named by `what` reject after its body ran, as a call whose deadline passed does.
const harness = (opts: {failAfter?: string; teardown?: EndReport['teardown']; version?: number} = {}) => {
  const app: FakeApp = {
    active: false,
    begins: 0,
    ended: 0,
    report: {cancelledReplies: [], refusedWrites: [], storesNotRestored: [], teardown: opts.teardown ?? 'remount'},
  }
  const fx = {
    active: () => app.active,
    afterReady: () => {},
    begin: () => {
      app.begins++
      app.active = true
    },
    end: () => {
      if (!app.active) throw new Error('end with no fixture active')
      app.active = false
      app.ended++
      return app.report
    },
    served: () => true,
    version: opts.version ?? FIXTURE_RUNTIME_VERSION,
  }
  const teardowns: Array<string> = []
  const hooks: FixtureHooks = {
    evalApp: async <R,>(body: string, what: string) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const run = new Function('globalThis', body) as (g: object) => R
      const r = run({__kbVisualFixtures: fx})
      if (what === opts.failAfter) throw new Error(`${what} timed out`)
      return r
    },
    reload: async () => {
      teardowns.push('reload')
    },
    remount: async () => {
      teardowns.push('remount')
    },
    waitFor: async (_what, check) => {
      if (!(await check())) throw new Error('never served')
    },
  }
  return {app, hooks, teardowns}
}

const f = {name: 'featured-bots'}

test('a begin whose call fails after the app ran it is still ended and torn down', async () => {
  const h = harness({failAfter: 'beginning fixture featured-bots'})
  const fixture = fixtureCapture(h.hooks, f)
  await assert.rejects(fixture.begin(), /timed out/)
  assert.equal(h.app.active, true)
  assert.deepEqual(await fixture.end(), [])
  assert.equal(h.app.active, false)
  assert.deepEqual(h.teardowns, ['remount'])
})

test('a begin the app refused leaves nothing to end, and end does not fail on it', async () => {
  const h = harness({version: FIXTURE_RUNTIME_VERSION + 1})
  const fixture = fixtureCapture(h.hooks, f)
  await assert.rejects(fixture.begin(), /fixture runtime is version/)
  assert.deepEqual(await fixture.end(), [])
  assert.equal(h.app.begins, 0)
  assert.deepEqual(h.teardowns, [])
})

test('end runs once, tears down as the report says and fails the capture on what leaked', async () => {
  const h = harness({teardown: 'reload'})
  h.app.report.refusedWrites.push('keybase.1.teams.teamAddMember')
  const fixture = fixtureCapture(h.hooks, f)
  await fixture.begin()
  await fixture.ready()
  assert.deepEqual(await fixture.end(), ['fixture featured-bots refused the write keybase.1.teams.teamAddMember'])
  assert.deepEqual(await fixture.end(), [])
  assert.equal(h.app.ended, 1)
  assert.deepEqual(h.teardowns, ['reload'])
})

test('an entry without a fixture runs none, and a fixture left active refuses the next capture', async () => {
  const h = harness()
  const none = fixtureCapture(h.hooks, undefined)
  await none.begin()
  await none.ready()
  assert.deepEqual(await none.end(), [])
  assert.equal(h.app.begins, 0)
  h.app.active = true
  await assert.rejects(none.assertNoneActive(), /a fixture is still active from an earlier entry/)
})
