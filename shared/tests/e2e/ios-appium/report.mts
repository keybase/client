// yarn test:e2e:ios:gate-report [--render <render dir>]
//
// The iOS release gate's HTML report (tests/results/ios-report.html) and manual checklist, from the
// last gate flow run and visual render (see ../shared/gate/flow-report.mts). It refuses results whose
// flow run did not scan them for secrets (wdio.gate.conf.ts) and pass.
import * as path from 'path'
import {runFlowReport} from '../shared/gate/flow-report.mts'
import {unscannedProblem} from '../shared/gate/secret-scan.ts'
import {iosReportPlatform} from './report-platform.mts'

const unscanned = unscannedProblem(path.dirname(iosReportPlatform.resultsPath))
if (unscanned) {
  console.error(`ios report: refusing to build it: ${unscanned}`)
  process.exitCode = 1
} else {
  process.exitCode = runFlowReport(iosReportPlatform)
}
