import * as path from 'path'

// Playwright empties its outputDir when a run starts. The release gate's report and census are
// rebuilt from its test-results and report under tests/results, so only the gate writes there
// (release.mts sets KB_E2E_RELEASE for its children). Every other flows run writes under
// tests/results/targeted, which leaves the last gate's results in place to rebuild from.
export const RELEASE_ENV = 'KB_E2E_RELEASE'

export const flowResultsDir = (resultsRoot: string, release = process.env[RELEASE_ENV] === '1') =>
  release ? resultsRoot : path.join(resultsRoot, 'targeted')
