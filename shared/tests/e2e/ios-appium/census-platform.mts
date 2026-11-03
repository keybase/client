// The iOS census's configuration (census.mts runs it).
import * as path from 'path'
import {fileURLToPath} from 'url'
import type {CensusPlatform} from '../shared/gate/census-cli.mts'
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
  routes: listRoutes,
  surfaces: () => ({
    entryPrefix: 'surface/',
    existing: iosSurfacesExisting(sharedDir),
    listFile: 'gate/lists/surfaces.ts',
    listed: IOS_SURFACES,
    noun: 'surface',
  }),
}
