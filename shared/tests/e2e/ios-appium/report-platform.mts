// The iOS release report's configuration (report.mts runs it).
import {darkVariantOf, type FlowReportPlatform} from '../shared/gate/flow-report.mts'
import {IOS_KNOWN_FAILURES, IOS_KNOWN_FAILURES_FILE} from './gate/lists/known-failures.ts'
import {IOS_MANUAL_ONLY} from './gate/lists/manual-only.ts'

export const iosReportPlatform: FlowReportPlatform = {
  checklistPath: 'tests/results/ios-manual-checklist.md',
  debugDir: 'tests/results/ios-debug',
  known: IOS_KNOWN_FAILURES,
  knownListFile: IOS_KNOWN_FAILURES_FILE,
  manualOnly: IOS_MANUAL_ONLY,
  outputPath: 'tests/results/ios-report.html',
  prevDir: 'tests/results/ios-prev',
  resultsPath: 'tests/results/ios-report/results.json',
  runHint: 'yarn test:e2e:ios:release',
  title: 'Keybase iOS release gate',
  variantOf: darkVariantOf,
}
