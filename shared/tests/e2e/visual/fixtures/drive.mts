// What the CLI and both drivers share about running a fixture: its args resolved like nav params,
// what in end()'s report fails the capture, and the hash a base records of its definition.
import {createHash} from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import {resolveValue, type CliRunner, runCli} from '../resolve.mts'
import type {EntryFixture} from '../tour-types.ts'
import {FIXTURES, type FixtureName} from './names.ts'
import type {EndReport} from './runtime.ts'

export const fixtureArgs = async (f: EntryFixture, run: CliRunner = runCli) =>
  (await resolveValue(f.args ?? {}, run)) as Record<string, unknown>

// A fixture that refused a write, ended with replies still owed, or could not put a store back
// leaves the app in a state no live capture may follow.
export const leakProblems = (name: string, r: EndReport): Array<string> => [
  ...r.refusedWrites.map(m => `fixture ${name} refused the write ${m}`),
  ...r.cancelledReplies.map(m => `fixture ${name} ended before answering ${m}`),
  ...r.storesNotRestored.map(k => `fixture ${name} did not put store ${k} back`),
]

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
