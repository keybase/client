// The last reporter of the flows run: once every other reporter has written its files, it scans the
// results for the env file's secrets, deletes any file that holds one, and fails the run naming
// the files (never the secret).
import * as path from 'path'
import type {FullConfig, FullResult, Reporter} from '@playwright/test/reporter'
import {scanAndPurge, watchEnvSecrets, type SecretWatch} from '../shared/gate/secret-scan.ts'

export default class SecretScanReporter implements Reporter {
  private resultsDir = ''
  // every second-account password the env file held during the run, not only the last one
  private watch: SecretWatch | undefined

  onBegin(config: FullConfig) {
    // playwright.config.ts writes its results and report under tests/results
    this.resultsDir = path.resolve(path.dirname(config.configFile ?? config.rootDir), '../../results')
    this.watch = watchEnvSecrets()
  }

  onStepEnd() {
    this.watch?.sample()
  }

  onTestEnd() {
    this.watch?.sample()
  }

  async onEnd(result: FullResult): Promise<{status: FullResult['status']}> {
    const watch = this.watch ?? watchEnvSecrets()
    try {
      const scan = scanAndPurge([path.join(this.resultsDir, 'test-results'), path.join(this.resultsDir, 'report')], watch.secrets())
      console.log(`[secret-scan] ${scan.line}`)
      return Promise.resolve({status: scan.hits.length ? 'failed' : result.status})
    } finally {
      watch.stop()
    }
  }
}
