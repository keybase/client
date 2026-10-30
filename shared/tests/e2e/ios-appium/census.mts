// yarn test:e2e:ios:census [--results <results.json>] [--render <render dir> | --no-render] [--project <name>]
//
// Which routes, write RPCs and native surfaces the last iOS gate flow run and visual render reached (see
// ../shared/gate/census-lib.ts), less the reasoned exclusions in gate/lists/census-exclusions.ts. Reads the
// `coverage.json` attachment of each passing attempt in the wdio json report (default
// tests/results/ios-report/results.json, project ios-flows) and render.json of a
// `yarn visual:render --ios` run. Writes tests/results/ios-census.md and ios-census.json; exits 1 on
// anything unclaimed, unsent or stale (see ../electron/census.mts).
import {runCensusCli} from '../shared/gate/census-cli.mts'
import {iosCensusPlatform} from './census-platform.mts'

process.exitCode = runCensusCli(iosCensusPlatform)
