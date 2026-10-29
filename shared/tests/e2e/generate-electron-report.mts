import * as fs from 'fs'
import * as path from 'path'
import {computeDiff} from './generate-report-shared.mts'
import {MANUAL_ONLY} from './electron/manual-only.ts'
import {KNOWN_FAILURES, KNOWN_FAILURES_FILE} from './electron/known-failures.ts'
import {runFlowReport} from './shared/gate/flow-report.mts'
import type {CardData} from './generate-report-shared.mts'

const storybookDir = 'tests/results/storybook-desktop'
const storybookPrevDir = 'tests/results/storybook-prev'

const parseStorybookScreenshots = (): Array<CardData> => {
  if (!fs.existsSync(storybookDir)) return []
  const cases: CardData[] = []
  function walk(dir: string, rel: string) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const fullPath = path.join(dir, entry.name)
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(fullPath, relPath)
      } else if (entry.name.endsWith('.png')) {
        const label = relPath.replace(/\.png$/, '').replaceAll('/', ' / ').replace(/-/g, ' ')
        const prevPath = path.join(storybookPrevDir, relPath)
        const prevScreenshotPath = fs.existsSync(prevPath) ? prevPath : null
        const diff = prevScreenshotPath ? computeDiff(fullPath, prevScreenshotPath) : null
        cases.push({label, passed: true, durationMs: 0, screenshotPath: fullPath, prevScreenshotPath, diff, errorMessage: null})
      }
    }
  }
  walk(storybookDir, '')
  return cases.sort((a, b) => a.label.localeCompare(b.label))
}

function saveStorybookBaseline(cards: CardData[]) {
  fs.mkdirSync(storybookPrevDir, {recursive: true})
  let saved = 0
  for (const card of cards) {
    if (!card.screenshotPath || !fs.existsSync(card.screenshotPath)) continue
    const relPath = path.relative(storybookDir, card.screenshotPath)
    const destDir = path.dirname(path.join(storybookPrevDir, relPath))
    fs.mkdirSync(destDir, {recursive: true})
    fs.copyFileSync(card.screenshotPath, path.join(storybookPrevDir, relPath))
    saved++
  }
  console.log(`Storybook baseline saved: ${saved} screenshots to ${storybookPrevDir}/`)
}

process.exit(
  runFlowReport({
    checklistPath: 'tests/results/manual-checklist.md',
    debugDir: 'tests/results/electron-debug',
    extraLabel: 'storybook stories',
    extraSections: () => {
      const cards = parseStorybookScreenshots()
      return cards.length > 0 ? [{header: `Storybook · ${cards.length} stories`, cards, excludeFromStats: true}] : []
    },
    known: KNOWN_FAILURES,
    knownListFile: KNOWN_FAILURES_FILE,
    manualOnly: MANUAL_ONLY,
    outputPath: 'tests/results/electron-report.html',
    prevDir: 'tests/results/electron-prev',
    resultsPath: 'tests/results/report/results.json',
    runHint: 'yarn test:e2e:desktop',
    saveExtraBaseline: saveStorybookBaseline,
    skipKnownFor: projectName => projectName.endsWith('-dark'),
    title: 'Keybase Electron E2E Tests',
  })
)
