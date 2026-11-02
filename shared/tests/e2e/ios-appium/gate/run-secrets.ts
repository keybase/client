// Secrets a flow hands to the app that no env file or record holds (a computer's one-time
// provisioning phrase): kept in the worker's memory for the run and never written anywhere, so the
// worker's own scan at its end (scanHeldSecrets, wdio.gate.conf.ts `after`) can look for them in
// what the run wrote. They go with the worker.
import {scanAndPurge} from '../../shared/gate/secret-scan'
import {iosReportDir, recordRunError} from './attempt'

const held = new Set<string>()

export const holdRunSecret = (secret: string) => {
  if (secret) held.add(secret)
}

// Deletes every file of the run's that holds a held secret, records a run error naming the count,
// which fails the report, and returns the files.
export const scanHeldSecrets = (dirs: ReadonlyArray<string> = [iosReportDir()]) => {
  if (!held.size) return []
  const {hits} = scanAndPurge(dirs, [...held])
  if (hits.length) recordRunError(`the worker's secret scan deleted ${hits.length} file(s) that held a one-time secret a flow handled`)
  return hits
}
