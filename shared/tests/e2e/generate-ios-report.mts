import * as fs from 'fs'
import * as path from 'path'

const debugDir = 'tests/results/ios-debug'
const outputPath = 'tests/results/ios-report.html'

type CommandStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED' | string
type CommandEntry = {
  command: Record<string, unknown>
  metadata: {
    status: CommandStatus
    timestamp: number
    duration: number
    sequenceNumber: number
    error?: string
  }
}

type TestResult = {
  name: string
  passed: boolean
  durationMs: number
  screenshotPath: string | null
  failureScreenshotPath: string | null
  errorMessage: string | null
}

function readCommandsFile(name: string): CommandEntry[] | null {
  const filePath = path.join(debugDir, `commands-(${name}).json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CommandEntry[]
}

function findScreenshot(name: string, kind: 'named' | 'failure'): string | null {
  if (kind === 'named') {
    const p = path.join(debugDir, `${name}.png`)
    return fs.existsSync(p) ? p : null
  }
  // Failure screenshots are in subdirs like .maestro/tests/<timestamp>/
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

function imageToDataUrl(filePath: string): string {
  const data = fs.readFileSync(filePath)
  return `data:image/png;base64,${data.toString('base64')}`
}

function parseTest(name: string): TestResult {
  const commands = readCommandsFile(name)
  if (!commands || commands.length === 0) {
    return {name, passed: false, durationMs: 0, screenshotPath: null, failureScreenshotPath: null, errorMessage: 'No command data found'}
  }

  const failed = commands.find(c => c.metadata.status === 'FAILED')
  const screenshotCaptured = commands.some(
    c => 'takeScreenshotCommand' in c.command && c.metadata.status === 'COMPLETED'
  )
  const passed = screenshotCaptured && !failed
  const durationMs = commands.reduce((sum, c) => sum + (c.metadata.duration ?? 0), 0)
  const errorMessage = failed
    ? (failed.metadata.error ?? `${Object.keys(failed.command)[0] ?? 'unknown'} failed`)
    : !screenshotCaptured
      ? 'Test did not complete'
      : null

  const screenshotPath = findScreenshot(name, 'named')
  const failureScreenshotPath = passed ? null : findScreenshot(name, 'failure')

  return {name, passed, durationMs, screenshotPath, failureScreenshotPath, errorMessage}
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function buildHtml(results: TestResult[], timestamp: string): string {
  const totalPassed = results.filter(r => r.passed).length
  const totalFailed = results.length - totalPassed
  const allPassed = totalFailed === 0

  const rows = results
    .map(r => {
      const img = r.screenshotPath
        ? `<img src="${imageToDataUrl(r.screenshotPath)}" alt="${r.name}" class="screenshot">`
        : r.failureScreenshotPath
          ? `<img src="${imageToDataUrl(r.failureScreenshotPath)}" alt="${r.name} failure" class="screenshot failure-img">`
          : '<div class="no-screenshot">No screenshot</div>'

      const badge = r.passed
        ? '<span class="badge pass">PASS</span>'
        : '<span class="badge fail">FAIL</span>'

      const error = r.errorMessage ? `<div class="error">${r.errorMessage}</div>` : ''

      return `
      <div class="test-card ${r.passed ? 'passed' : 'failed'}">
        <div class="test-info">
          ${badge}
          <span class="test-name">${r.name}</span>
          <span class="duration">${formatDuration(r.durationMs)}</span>
          ${error}
        </div>
        <div class="screenshot-wrap">${img}</div>
      </div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Keybase iOS E2E Smoke Tests</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #222; }
  header { background: ${allPassed ? '#1a7a3a' : '#c0392b'}; color: white; padding: 24px 32px; }
  header h1 { font-size: 22px; font-weight: 600; }
  header .summary { margin-top: 8px; font-size: 15px; opacity: 0.9; }
  header .timestamp { margin-top: 4px; font-size: 13px; opacity: 0.7; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 24px 32px; }
  .test-card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); border-top: 4px solid #ccc; }
  .test-card.passed { border-top-color: #27ae60; }
  .test-card.failed { border-top-color: #e74c3c; }
  .test-info { padding: 14px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .test-name { font-weight: 500; font-size: 14px; flex: 1; }
  .duration { font-size: 12px; color: #888; }
  .badge { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 3px; text-transform: uppercase; }
  .badge.pass { background: #d4edda; color: #1a7a3a; }
  .badge.fail { background: #fde8e8; color: #c0392b; }
  .error { width: 100%; font-size: 12px; color: #c0392b; background: #fde8e8; padding: 4px 8px; border-radius: 4px; word-break: break-word; }
  .screenshot-wrap { background: #000; }
  .screenshot { width: 100%; display: block; }
  .failure-img { opacity: 0.85; }
  .no-screenshot { padding: 32px; text-align: center; color: #aaa; font-size: 13px; background: #fafafa; }
</style>
</head>
<body>
<header>
  <h1>Keybase iOS E2E Smoke Tests</h1>
  <div class="summary">${totalPassed} passed &nbsp;·&nbsp; ${totalFailed} failed &nbsp;·&nbsp; ${results.length} total</div>
  <div class="timestamp">${timestamp}</div>
</header>
<div class="grid">
${rows}
</div>
</body>
</html>`
}

function main() {
  if (!fs.existsSync(debugDir)) {
    console.error(`Debug dir not found: ${debugDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(debugDir)
  const testNames = files
    .filter(f => f.startsWith('commands-(smoke-') && f.endsWith(').json'))
    .map(f => f.replace('commands-(', '').replace(').json', ''))
    .sort()

  if (testNames.length === 0) {
    console.error('No test results found in', debugDir)
    process.exit(1)
  }

  const results = testNames.map(name => parseTest(name))
  const timestamp = new Date().toLocaleString()
  const html = buildHtml(results, timestamp)

  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})
  fs.writeFileSync(outputPath, html)

  const passed = results.filter(r => r.passed).length
  console.log(`Report written to ${outputPath} (${passed}/${results.length} passed)`)
}

main()
