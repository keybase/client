import * as fs from 'fs'
import * as path from 'path'
import {computeDiff, buildReport} from './generate-report-shared.mts'
import type {CardData, Section} from './generate-report-shared.mts'

const prevDir = process.env['KB_IOS_PREV_DIR'] ?? 'tests/results/ios-prev'
const outputPath = process.env['KB_IOS_REPORT'] ?? 'tests/results/ios-report.html'

// One report can aggregate several device runs. KB_IOS_DEBUG_DIRS is a comma
// separated list of `label=dir` pairs (one per simulator); each becomes its own
// titled section. Falls back to the single KB_IOS_DEBUG_DIR for one-device runs.
function deviceDirs(): Array<{label: string; dir: string}> {
  const multi = process.env['KB_IOS_DEBUG_DIRS']
  if (multi) {
    return multi.split(',').map(part => {
      const eq = part.indexOf('=')
      return eq === -1
        ? {label: '', dir: part.trim()}
        : {label: part.slice(0, eq).trim(), dir: part.slice(eq + 1).trim()}
    })
  }
  return [{label: '', dir: process.env['KB_IOS_DEBUG_DIR'] ?? 'tests/results/ios-debug'}]
}

type CommandStatus = string
type CommandEntry = {
  command: Record<string, unknown>
  metadata: {status: CommandStatus; timestamp: number; duration: number; sequenceNumber: number; error?: string}
}

function readCommandsFile(debugDir: string, name: string): CommandEntry[] | null {
  const filePath = path.join(debugDir, `commands-(${name}).json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CommandEntry[]
}

function findFailureScreenshot(debugDir: string, name: string): string | null {
  const pattern = `-(${name}).png`
  function searchDir(dir: string): string | null {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.isDirectory()) {
        const found = searchDir(path.join(dir, entry.name))
        if (found) return found
      } else if (entry.name.startsWith('screenshot-❌') && entry.name.endsWith(pattern)) {
        return path.join(dir, entry.name)
      }
    }
    return null
  }
  return searchDir(debugDir)
}

function parseFlow(debugDir: string, name: string): CardData[] {
  const commands = readCommandsFile(debugDir, name)
  const failed = commands?.find(c => c.metadata.status === 'FAILED')
  const passed = commands != null && commands.length > 0 && !failed
  const durationMs = commands?.reduce((sum, c) => sum + c.metadata.duration, 0) ?? 0
  const errorMessage = failed
    ? (failed.metadata.error ?? `${Object.keys(failed.command)[0] ?? 'unknown'} failed`)
    : (commands == null || commands.length === 0 ? 'No command data found' : null)
  const failureScreenshotPath = passed ? null : findFailureScreenshot(debugDir, name)

  const displayName = name.replace(/^(smoke|flow)-/, '')

  const stepFiles = fs.readdirSync(debugDir)
    .filter(f => (f === `${name}.png` || (f.startsWith(`${name}-`) && f.endsWith('.png'))))
    .sort()

  if (stepFiles.length === 0) {
    return [{
      label: displayName,
      passed,
      durationMs,
      screenshotPath: null,
      prevScreenshotPath: null,
      failureScreenshotPath,
      diff: null,
      errorMessage,
    }]
  }

  const results: CardData[] = stepFiles.map((file, idx) => {
    const stem = file.replace('.png', '')
    const screenshotPath = path.join(debugDir, file)
    const prevPath = path.join(prevDir, file)
    const prevScreenshotPath = fs.existsSync(prevPath) ? prevPath : null
    const diff = prevScreenshotPath ? computeDiff(screenshotPath, prevScreenshotPath) : null
    const stepLabel = stem.startsWith(`${name}-`) ? stem.slice(name.length + 1) : stem
    return {
      label: `${displayName} · ${stepLabel}`,
      passed,
      durationMs: idx === 0 ? durationMs : 0,
      screenshotPath,
      prevScreenshotPath,
      failureScreenshotPath: null,
      diff,
      errorMessage: idx === stepFiles.length - 1 ? errorMessage : null,
    }
  })

  if (!passed && failureScreenshotPath) {
    results.push({
      label: `${displayName} · failure`,
      passed: false,
      durationMs: 0,
      screenshotPath: null,
      prevScreenshotPath: null,
      failureScreenshotPath,
      diff: null,
      errorMessage,
    })
  }

  return results
}

function cardsForDir(debugDir: string): CardData[] {
  if (!fs.existsSync(debugDir)) { console.error(`Debug dir not found: ${debugDir}`); return [] }
  const testNames = fs.readdirSync(debugDir)
    .filter(f => f.startsWith('commands-(') && f.endsWith(').json'))
    .map(f => f.replace('commands-(', '').replace(').json', ''))
    .filter(name => name !== 'setup')
    .sort()
  return testNames.flatMap(name => parseFlow(debugDir, name))
}

function saveBaseline(cards: CardData[]) {
  fs.mkdirSync(prevDir, {recursive: true})
  let saved = 0
  for (const card of cards) {
    if (!card.screenshotPath || !fs.existsSync(card.screenshotPath)) continue
    const stem = path.basename(card.screenshotPath, '.png')
    fs.copyFileSync(card.screenshotPath, path.join(prevDir, `${stem}.png`))
    saved++
  }
  console.log(`Baseline saved: ${saved} screenshots to ${prevDir}/`)
}

function main() {
  const isSaveBaseline = process.argv.includes('--save-baseline')

  const dirs = deviceDirs()
  const sections: Section[] = dirs.map(({label, dir}) => ({
    header: label || undefined,
    cards: cardsForDir(dir),
  }))
  const allCards = sections.flatMap(s => s.cards)
  if (allCards.length === 0) { console.error('No test results found in', dirs.map(d => d.dir).join(', ')); process.exit(1) }

  if (isSaveBaseline) {
    saveBaseline(allCards)
    return
  }

  const timestamp = new Date().toLocaleString()
  const html = buildReport('Keybase iOS E2E Tests', sections, timestamp, outputPath)
  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})
  fs.writeFileSync(outputPath, html)
  const withDiff = allCards.filter(c => c.diff !== null).length
  const diffNote = withDiff > 0 ? `, ${withDiff} vs baseline` : ''
  console.log(`Report written to ${outputPath} (${allCards.filter(c => c.passed).length}/${allCards.length} passed${diffNote})`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
