// Secrets a flow hands to the app that no env file or record holds (a computer's one-time
// provisioning phrase): kept in the worker's memory for the run and never written anywhere, so the
// worker's own scan at its end (scanHeldSecrets, wdio.gate.conf.ts `after`) can look for them in
// what the run wrote. They go with the worker: a worker killed before its `after` hook scans
// nothing, which is accepted, as the phrase dies with its one kex session.
import * as path from 'path'
import {scanAndPurge} from '../../shared/gate/secret-scan'
import {iosReportDir, recordRunError} from './attempt'

const held = new Set<string>()

export const holdRunSecret = (secret: string) => {
  if (secret) held.add(secret)
}

// Every folder a flow run's artifacts land in: its report, the release's child logs (metro.log holds
// the app's dev console, flows.log wdio's own output) and the visual gate's render root.
export const heldSecretDirs = () => {
  const results = path.resolve(__dirname, '../../../results')
  return [iosReportDir(), path.join(results, 'ios-logs'), path.join(process.env['KB_VISUAL_RESULTS'] ?? path.join(results, 'visual'), 'render')]
}

// Deletes every file of the run's that holds a held secret, records a run error naming the count,
// which fails the report, and returns the files.
export const scanHeldSecrets = (dirs: ReadonlyArray<string> = heldSecretDirs()) => {
  if (!held.size) return []
  const {hits} = scanAndPurge(dirs, [...held])
  if (hits.length) recordRunError(`the worker's secret scan deleted ${hits.length} file(s) that held a one-time secret a flow handled`)
  return hits
}
