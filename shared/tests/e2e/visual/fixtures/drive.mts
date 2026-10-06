// What the CLI and both drivers share about running a fixture: its args resolved like nav params,
// one capture's fixture lifecycle, what in end()'s report fails the capture, and the hash a base
// records of its definition.
import {createHash} from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import {resolveValue, type CliRunner, runCli} from '../resolve.mts'
import type {EntryFixture} from '../tour-types.ts'
import {FIXTURE_RUNTIME_VERSION, FIXTURES, type FixtureName} from './names.ts'
import type {EndReport} from './runtime.ts'

export const fixtureArgs = async (f: EntryFixture, run: CliRunner = runCli) =>
  (await resolveValue(f.args ?? {}, run)) as Record<string, unknown>

// A fixture that refused a write, ended with replies still owed, or could not put a store back
// leaves the app in a state no live capture may follow; one whose follow-ups failed drew something
// other than what it describes.
export const leakProblems = (name: string, r: EndReport): Array<string> => [
  ...r.refusedWrites.map(m => `fixture ${name} refused the write ${m}`),
  ...r.cancelledReplies.map(m => `fixture ${name} ended before answering ${m}`),
  ...r.storesNotRestored.map(k => `fixture ${name} did not put store ${k} back`),
  ...r.failedFollowUps.map(f => `fixture ${name} failed a follow-up ${f}`),
]

// What a driver gives the fixture lifecycle.
export type FixtureHooks = {
  // runs a function body in the app (under the driver's deadline) and resolves to what it returns
  evalApp: <R>(body: string, what: string) => Promise<R>
  // polls until check holds, under the driver's ready deadline
  waitFor: (what: string, check: () => Promise<boolean>) => Promise<void>
  // end() asked for a reload: reload the app and put it back as prepare left it
  reload: () => Promise<void>
  // end() asked for a remount: the current tab at its root, then every screen remounted
  remount: () => Promise<void>
}

const FX = 'globalThis.__kbVisualFixtures'

// One capture's fixture lifecycle, run through __kbVisualFixtures (runtime.ts). For an entry
// without a fixture, every step but assertNoneActive does nothing.
export const fixtureCapture = (h: FixtureHooks, f: EntryFixture | undefined, run: CliRunner = runCli) => {
  let begun = false
  return {
    assertNoneActive: async () => {
      if (await h.evalApp<boolean>(`return ${FX}?.active() ?? false`, 'reading whether a fixture is active')) {
        throw new Error('a fixture is still active from an earlier entry')
      }
    },
    begin: async () => {
      if (!f) return
      const args = await fixtureArgs(f, run)
      // before the call: begin can run in the app and still fail here (a deadline), and end must
      // then take it out again
      begun = true
      await h.evalApp(
        `const fx = ${FX}
         if (!fx) throw new Error('the app has no visual fixtures runtime; is this a dev build of a tree that has one?')
         if (fx.version !== ${FIXTURE_RUNTIME_VERSION}) throw new Error('the app fixture runtime is version ' + fx.version + ', the driver wants ${FIXTURE_RUNTIME_VERSION}')
         fx.begin(${JSON.stringify(f.name)}, ${JSON.stringify(args)})`,
        `beginning fixture ${f.name}`
      )
    },
    // the entry's ready testID is up: wait for every required rule, then the fixture's afterReady
    ready: async () => {
      if (!f) return
      await h.waitFor(`fixture ${f.name} to answer every rule it needs`, async () =>
        h.evalApp<boolean>(`return ${FX}?.served() ?? false`, 'reading whether the fixture has answered')
      )
      await h.evalApp(`${FX}.afterReady()`, 'fixture afterReady')
    },
    // Ends the fixture begin installed and puts the app back as it says; never throws. Returns what
    // fails the capture. A begin that failed before the app ran it left nothing to end.
    end: async (): Promise<Array<string>> => {
      if (!f || !begun) return []
      begun = false
      try {
        const report = await h.evalApp<EndReport | null>(`const fx = ${FX}; return fx?.active() ? fx.end() : null`, 'fixture end')
        if (!report) return []
        if (report.teardown === 'reload') await h.reload()
        else await h.remount()
        return leakProblems(f.name, report)
      } catch (e) {
        return [`ending fixture ${f.name}: ${(e as Error).message}`]
      }
    },
  }
}

// A fixture's definition in a tree (`shared` is that tree's shared/): the runtime, the rule helpers
// and the fixture's own files. A base records it per fixture, and check refuses when it moved.
export const fixtureHash = (shared: string, name: FixtureName) => {
  const h = createHash('sha256')
  for (const file of ['runtime.ts', 'def.ts', ...FIXTURES[name].files]) {
    h.update(`${file}\0`)
    h.update(fs.readFileSync(path.join(shared, 'tests/e2e/visual/fixtures', file)))
  }
  return h.digest('hex')
}
