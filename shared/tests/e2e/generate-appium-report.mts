import * as fs from 'fs'
import * as path from 'path'
import {buildReport} from './generate-report-shared.mts'
import type {CardData, Section} from './generate-report-shared.mts'

// Builds the unified HTML report from the artifacts the wdio afterTest hook
// writes (one <slug>.json + <slug>.png per test) into the debug dir.
const debugDir = process.env['KB_IOS_APPIUM_DEBUG_DIR'] ?? 'tests/results/ios-appium-debug'
const outputPath = process.env['KB_IOS_APPIUM_REPORT'] ?? 'tests/results/ios-appium-report.html'

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
      return {
        label: data.label,
        passed: data.passed,
        durationMs: data.durationMs,
        screenshotPath: data.passed ? screenshotPath : null,
        prevScreenshotPath: null,
        failureScreenshotPath: data.passed ? null : screenshotPath,
        diff: null,
        errorMessage: data.error,
      }
    })
}

const cards = readCards(debugDir)
const sections: Section[] = [{cards}]
const timestamp = new Date().toLocaleString()
const html = buildReport('Keybase iOS E2E Tests (Appium)', sections, timestamp, outputPath)
fs.mkdirSync(path.dirname(outputPath), {recursive: true})
fs.writeFileSync(outputPath, html)

const passed = cards.filter(c => c.passed).length
console.log(`Report written to ${outputPath} (${passed}/${cards.length} passed)`)
