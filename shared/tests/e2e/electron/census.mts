// yarn test:e2e:desktop:census [--results <results.json>] [--render <render dir> | --no-render] [--project <name>]
//
// Which routes, windows and write RPCs the last desktop flow run and visual render reached (see
// census-lib.ts), against the route inventory, the window list in census-windows.ts and the
// outgoing calls in protocol/bin/enabled-calls.json, less the reasoned exclusions in
// census-exclusions.ts. Reads:
//   the `coverage.json` attachment of each attempt in the Playwright json report (default
//     tests/results/report/results.json, project electron-flows); only passing attempts count
//   render.json of a `yarn visual:render` run (default the newest under tests/results/visual/render);
//     only entries that rendered ok count; --no-render counts no tour entry (a run whose render
//     wrote nothing), and census.md says so
// Writes tests/results/census.md and census.json. Exits 1 when a route or window is unclaimed, a
// write RPC is unsent, an exclusion or the window list is stale, or a passing test or rendered
// entry has no usable recording.
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {runCensusCli} from '../shared/gate/census-cli.mts'
import {EXCLUSIONS} from './census-exclusions.ts'
import {CENSUS_WINDOWS} from './census-windows.ts'
import {MANUAL_ONLY} from './manual-only.ts'
import {listRoutes} from '../visual/routes-inventory.mts'

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

// The app's remote window names, read from its source: the module itself only loads in the app.
const remoteWindowsFile = path.join(sharedDir, 'desktop/remote/remote-component.desktop.tsx')
const appWindows = () => {
  const m = /export const remoteComponentNames = \[([^\]]*)\] as const/.exec(fs.readFileSync(remoteWindowsFile, 'utf8'))
  const names = [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map(x => x[1] ?? '')
  if (!names.length) throw new Error(`no remoteComponentNames list in ${remoteWindowsFile}: update census.mts to read the app's windows`)
  return names
}

process.exitCode = runCensusCli({
  defaultResults: path.join(sharedDir, 'tests/results/report/results.json'),
  exclusions: EXCLUSIONS,
  flowsCommand: 'yarn test:e2e:desktop:flows',
  manualOnly: MANUAL_ONLY,
  outPrefix: '',
  platform: 'desktop',
  project: 'electron-flows',
  routes: listRoutes,
  surfaces: () => ({
    entryPrefix: 'window/',
    existing: appWindows(),
    listFile: 'census-windows.ts',
    listed: CENSUS_WINDOWS,
    noun: 'window',
  }),
})
