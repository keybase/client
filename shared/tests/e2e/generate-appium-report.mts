import * as fs from 'fs'
import * as path from 'path'
import {buildReport} from './generate-report-shared.mts'
import type {CardData, Section} from './generate-report-shared.mts'

// Builds the unified HTML report from the artifacts the wdio afterTest hook
// writes (one <slug>.json + <slug>.png per test) into the four fixed per-device
// dirs the runners (run-ios-appium*.sh) populate. Each device run overwrites
// its own dir, so the report always shows the latest run per device — the
// per-image timestamps reveal when each device last ran.
const outputPath = 'tests/results/ios-appium-report.html'

const deviceDirs = [
  {label: 'iPhone', dir: 'tests/results/ios-appium-debug-iphone'},
  {label: 'iPhone (Old)', dir: 'tests/results/ios-appium-debug-iphone-old'},
  {label: 'iPad', dir: 'tests/results/ios-appium-debug-ipad'},
  {label: 'iPad (Old)', dir: 'tests/results/ios-appium-debug-ipad-old'},
]

type TestArtifact = {label: string; passed: boolean; durationMs: number; error: string | null}

function readCards(dir: string): CardData[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as TestArtifact
      const shot = path.join(dir, f.replace(/\.json$/, '.png'))
      const screenshotPath = fs.existsSync(shot) ? path.resolve(shot) : null
      // mtime of the artifact = when the test actually ran. Sections can mix
      // runs from different days (per-device dirs persist), so stamp each shot.
      const timestamp = fs
        .statSync(screenshotPath ?? path.join(dir, f))
        .mtime.toLocaleString(undefined, {day: 'numeric', hour: 'numeric', minute: '2-digit', month: 'numeric'})
      return {
        label: data.label,
        passed: data.passed,
        durationMs: data.durationMs,
        screenshotPath: data.passed ? screenshotPath : null,
        prevScreenshotPath: null,
        failureScreenshotPath: data.passed ? null : screenshotPath,
        diff: null,
        errorMessage: data.error,
        timestamp,
      }
    })
}

// A section is stale when its newest artifact (i.e. the run time) is over an
// hour old — flags e.g. an iPhone-only run sitting next to yesterday's iPad run.
const STALE_MS = 60 * 60 * 1000
function newestMtimeMs(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  return Math.max(0, ...fs.readdirSync(dir).map(f => fs.statSync(path.join(dir, f)).mtimeMs))
}

const sections: Section[] = deviceDirs
  .map(({label, dir}) => {
    const stale = Date.now() - newestMtimeMs(dir) > STALE_MS
    return {header: stale ? `${label} (stale)` : label, cards: readCards(dir)}
  })
  .filter(s => s.cards.length > 0)
const timestamp = new Date().toLocaleString()
const html = buildReport('Keybase iOS E2E Tests (Appium)', sections, timestamp, outputPath)
fs.mkdirSync(path.dirname(outputPath), {recursive: true})
fs.writeFileSync(outputPath, html)

const allCards = sections.flatMap(s => s.cards)
const passed = allCards.filter(c => c.passed).length
console.log(`Report written to ${outputPath} (${passed}/${allCards.length} passed across ${sections.length} device(s))`)
