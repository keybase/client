import * as fs from 'fs'
import * as path from 'path'
import {buildReport} from './generate-report-shared.mts'
import type {CardData, Section} from './generate-report-shared.mts'

// Builds the unified HTML report from the artifacts the wdio afterTest hook
// writes (one <slug>.json + <slug>.png per test) into the debug dir(s).
//
// Single device: KB_IOS_APPIUM_DEBUG_DIR (one section).
// Multi device:  KB_IOS_APPIUM_DEBUG_DIRS = "iPhoneTest=dir1,iPadTest=dir2"
//                (one titled section per device, set by run-ios-appium.sh).
const outputPath = process.env['KB_IOS_APPIUM_REPORT'] ?? 'tests/results/ios-appium-report.html'

function deviceDirs(): Array<{label: string; dir: string}> {
  const multi = process.env['KB_IOS_APPIUM_DEBUG_DIRS']
  if (multi) {
    return multi.split(',').map(part => {
      const eq = part.indexOf('=')
      return eq === -1 ? {label: '', dir: part.trim()} : {label: part.slice(0, eq).trim(), dir: part.slice(eq + 1).trim()}
    })
  }
  const single = process.env['KB_IOS_APPIUM_DEBUG_DIR']
  if (single) return [{label: '', dir: single}]
  // No env (e.g. `yarn test:e2e:ios:report` run standalone): auto-discover the
  // per-device debug dirs the device runners leave behind so the report covers
  // every device, not just the last single run. Fall back to the lone default
  // dir only when no per-device dirs exist.
  const results = 'tests/results'
  const perDevice = fs.existsSync(results)
    ? fs
        .readdirSync(results)
        .filter(d => d.startsWith('ios-appium-debug-'))
        .sort()
        .map(d => {
          const slug = d.slice('ios-appium-debug-'.length)
          return {label: slug.charAt(0).toUpperCase() + slug.slice(1), dir: path.join(results, d)}
        })
    : []
  if (perDevice.length) return perDevice
  return [{label: '', dir: 'tests/results/ios-appium-debug'}]
}

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

const dirs = deviceDirs()
const sections: Section[] = dirs.map(({label, dir}) => ({header: label || undefined, cards: readCards(dir)}))
const timestamp = new Date().toLocaleString()
const html = buildReport('Keybase iOS E2E Tests (Appium)', sections, timestamp, outputPath)
fs.mkdirSync(path.dirname(outputPath), {recursive: true})
fs.writeFileSync(outputPath, html)

const allCards = sections.flatMap(s => s.cards)
const passed = allCards.filter(c => c.passed).length
console.log(`Report written to ${outputPath} (${passed}/${allCards.length} passed across ${dirs.length} device(s))`)
