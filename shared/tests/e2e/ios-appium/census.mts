// yarn test:e2e:ios:census [--results <results.json>] [--render <render dir> | --no-render] [--project <name>]
//
// Which routes, write RPCs and native surfaces the last iOS gate flow run and visual render reached (see
// ../shared/gate/census-lib.ts), less the reasoned exclusions in gate/lists/census-exclusions.ts. Reads the
// `coverage.json` attachment of each passing attempt in the wdio json report (default
// tests/results/ios-report/results.json, project ios-flows) and render.json of a
// `yarn visual:render --ios` run. Writes tests/results/ios-census.md and ios-census.json; exits 1 on
// anything unclaimed, unsent or stale (see ../electron/census.mts).
import * as path from 'path'
import {fileURLToPath} from 'url'
import {runCensusCli, type CensusPlatform} from '../shared/gate/census-cli.mts'
import {IOS_EXCLUSIONS} from './gate/lists/census-exclusions.ts'
import {IOS_MANUAL_ONLY} from './gate/lists/manual-only.ts'
import {IOS_SURFACES, iosSurfacesExisting} from './gate/lists/surfaces.ts'
import {listRoutes} from '../visual/routes-inventory.mts'

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export const iosCensusPlatform: CensusPlatform = {
  defaultResults: path.join(sharedDir, 'tests/results/ios-report/results.json'),
  exclusions: IOS_EXCLUSIONS,
  flowsCommand: 'yarn test:e2e:ios:flows',
  manualOnly: IOS_MANUAL_ONLY,
  outPrefix: 'ios-',
  platform: 'iOS',
  project: 'ios-flows',
  renderPlatform: 'ios',
  routes: listRoutes,
  surfaces: () => ({
    entryPrefix: 'surface/',
    existing: iosSurfacesExisting(sharedDir),
    listFile: 'gate/lists/surfaces.ts',
    listed: IOS_SURFACES,
    noun: 'surface',
  }),
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = runCensusCli(iosCensusPlatform)
