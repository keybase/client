// yarn test:e2e:ios:gate-report [--render <render dir>]
//
// The iOS release gate's HTML report (tests/results/ios-report.html) and manual checklist, from the
// last gate flow run and visual render (see ../shared/gate/flow-report.mts).
import {runFlowReport} from '../shared/gate/flow-report.mts'
import {iosReportPlatform} from './report-platform.mts'

process.exitCode = runFlowReport(iosReportPlatform)
