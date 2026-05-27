import * as fs from 'fs'
import * as path from 'path'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const {PNG} = require('pngjs') as {PNG: {sync: {read: (buf: Buffer) => {data: Buffer; width: number; height: number}}}}

const debugDir = 'tests/results/ios-debug'
const prevDir = 'tests/results/ios-prev'
const outputPath = 'tests/results/ios-report.html'

type CommandStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED' | string
type CommandEntry = {
  command: Record<string, unknown>
  metadata: {status: CommandStatus; timestamp: number; duration: number; sequenceNumber: number; error?: string}
}

type DiffResult = {pct: number; changed: number; total: number}

type TestResult = {
  name: string
  passed: boolean
  durationMs: number
  screenshotPath: string | null
  prevScreenshotPath: string | null
  failureScreenshotPath: string | null
  diff: DiffResult | null
  errorMessage: string | null
}

function readCommandsFile(name: string): CommandEntry[] | null {
  const filePath = path.join(debugDir, `commands-(${name}).json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CommandEntry[]
}

function findFailureScreenshot(name: string): string | null {
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

function computeDiff(pathA: string, pathB: string): DiffResult | null {
  try {
    const a = PNG.sync.read(fs.readFileSync(pathA))
    const b = PNG.sync.read(fs.readFileSync(pathB))
    if (a.width !== b.width || a.height !== b.height) return null
    const total = a.width * a.height
    let changed = 0
    for (let i = 0; i < a.data.length; i += 4) {
      const dr = Math.abs(a.data[i]! - b.data[i]!)
      const dg = Math.abs(a.data[i + 1]! - b.data[i + 1]!)
      const db = Math.abs(a.data[i + 2]! - b.data[i + 2]!)
      // threshold of 15 per channel to ignore minor rendering diffs
      if (dr + dg + db > 45) changed++
    }
    return {pct: (changed / total) * 100, changed, total}
  } catch {
    return null
  }
}

function imageToDataUrl(filePath: string): string {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`
}

function parseTest(name: string): TestResult {
  const commands = readCommandsFile(name)
  if (!commands || commands.length === 0) {
    return {name, passed: false, durationMs: 0, screenshotPath: null, prevScreenshotPath: null, failureScreenshotPath: null, diff: null, errorMessage: 'No command data found'}
  }

  const failed = commands.find(c => c.metadata.status === 'FAILED')
  const screenshotCaptured = commands.some(c => 'takeScreenshotCommand' in c.command && c.metadata.status === 'COMPLETED')
  const passed = screenshotCaptured && !failed
  const durationMs = commands.reduce((sum, c) => sum + (c.metadata.duration ?? 0), 0)
  const errorMessage = failed
    ? (failed.metadata.error ?? `${Object.keys(failed.command)[0] ?? 'unknown'} failed`)
    : !screenshotCaptured ? 'Test did not complete' : null

  const screenshotPath = (() => {
    const p = path.join(debugDir, `${name}.png`)
    return fs.existsSync(p) ? p : null
  })()

  const prevScreenshotPath = (() => {
    const p = path.join(prevDir, `${name}.png`)
    return fs.existsSync(p) ? p : null
  })()

  const failureScreenshotPath = passed ? null : findFailureScreenshot(name)

  const diff = screenshotPath && prevScreenshotPath ? computeDiff(prevScreenshotPath, screenshotPath) : null

  return {name, passed, durationMs, screenshotPath, prevScreenshotPath, failureScreenshotPath, diff, errorMessage}
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function diffBadge(diff: DiffResult): string {
  const pct = diff.pct.toFixed(1)
  const cls = diff.pct < 1 ? 'diff-low' : diff.pct < 5 ? 'diff-mid' : 'diff-high'
  return `<span class="badge ${cls}" title="${diff.changed.toLocaleString()} of ${diff.total.toLocaleString()} pixels changed">Δ ${pct}%</span>`
}

function buildHtml(results: TestResult[], timestamp: string): string {
  const totalPassed = results.filter(r => r.passed).length
  const totalFailed = results.length - totalPassed
  const allPassed = totalFailed === 0
  const hasDiff = results.some(r => r.diff !== null)

  const cards = results
    .map((r, i) => {
      const badge = r.passed ? '<span class="badge pass">PASS</span>' : '<span class="badge fail">FAIL</span>'
      const error = r.errorMessage ? `<div class="error">${r.errorMessage}</div>` : ''
      const delta = r.diff ? diffBadge(r.diff) : ''

      let visual: string
      if (r.screenshotPath && r.prevScreenshotPath) {
        const curUrl = imageToDataUrl(r.screenshotPath)
        const prevUrl = imageToDataUrl(r.prevScreenshotPath)
        visual = `
        <div class="compare" id="cmp${i}">
          <img class="img-after" src="${curUrl}" alt="current">
          <img class="img-before" src="${prevUrl}" alt="previous">
          <div class="handle"><div class="handle-grip">⇔</div></div>
          <div class="compare-label label-before">BEFORE</div>
          <div class="compare-label label-after">AFTER</div>
        </div>`
      } else if (r.screenshotPath) {
        visual = `<div class="single-shot"><img src="${imageToDataUrl(r.screenshotPath)}" alt="${r.name}"></div>`
      } else if (r.failureScreenshotPath) {
        visual = `<div class="single-shot failed-shot"><img src="${imageToDataUrl(r.failureScreenshotPath)}" alt="failure"></div>`
      } else {
        visual = `<div class="no-screenshot">No screenshot</div>`
      }

      return `
    <div class="card ${r.passed ? 'passed' : 'failed'}">
      <div class="card-header">
        ${badge}${delta}
        <span class="test-name">${r.name.replace('smoke-', '')}</span>
        <span class="duration">${formatDuration(r.durationMs)}</span>
        ${error}
      </div>
      ${visual}
    </div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Keybase iOS E2E</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f0f0;color:#222}
header{background:${allPassed ? '#1a7a3a' : '#c0392b'};color:#fff;padding:20px 28px}
header h1{font-size:20px;font-weight:600}
.meta{margin-top:6px;font-size:14px;opacity:.85}
.meta span{margin-right:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:20px 28px}
.card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12);border-top:4px solid #ccc}
.card.passed{border-top-color:#27ae60}
.card.failed{border-top-color:#e74c3c}
.card-header{padding:12px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.test-name{font-weight:500;font-size:13px;flex:1;text-transform:capitalize}
.duration{font-size:12px;color:#999}
.badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap}
.badge.pass{background:#d4edda;color:#1a7a3a}
.badge.fail{background:#fde8e8;color:#c0392b}
.badge.diff-low{background:#e8f4fd;color:#1a5fa8}
.badge.diff-mid{background:#fff3cd;color:#856404}
.badge.diff-high{background:#fde8e8;color:#842029}
.error{width:100%;font-size:11px;color:#c0392b;background:#fde8e8;padding:3px 8px;border-radius:4px;word-break:break-word}
/* screenshot */
.single-shot img{width:100%;display:block}
.failed-shot img{opacity:.85}
.no-screenshot{padding:28px;text-align:center;color:#bbb;font-size:12px;background:#fafafa}
/* compare slider */
.compare{position:relative;overflow:hidden;cursor:ew-resize;user-select:none}
.compare img{display:block;width:100%}
.img-before{position:absolute;top:0;left:0;width:100%;clip-path:inset(0 50% 0 0)}
.handle{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:3px;background:rgba(255,255,255,.9);pointer-events:none}
.handle-grip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.compare-label{position:absolute;bottom:8px;font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:3px;background:rgba(0,0,0,.55);color:#fff;pointer-events:none}
.label-before{left:8px}
.label-after{right:8px}
</style>
</head>
<body>
<header>
  <h1>Keybase iOS E2E Smoke Tests</h1>
  <div class="meta">
    <span>${totalPassed} passed · ${totalFailed} failed · ${results.length} total</span>
    ${hasDiff ? '<span>· visual diff vs previous run</span>' : ''}
    <span style="opacity:.7">${timestamp}</span>
  </div>
</header>
<div class="grid">
${cards}
</div>
<script>
document.querySelectorAll('.compare').forEach(el => {
  const before = el.querySelector('.img-before')
  const handle = el.querySelector('.handle')
  let active = false

  function setPos(clientX) {
    const r = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100))
    const right = (100 - pct).toFixed(2)
    before.style.clipPath = 'inset(0 ' + right + '% 0 0)'
    handle.style.left = pct + '%'
  }

  el.addEventListener('mousedown', e => { active = true; setPos(e.clientX) })
  window.addEventListener('mouseup', () => active = false)
  el.addEventListener('mousemove', e => { if (active) setPos(e.clientX) })
  el.addEventListener('touchstart', e => { active = true; setPos(e.touches[0].clientX) }, {passive: true})
  window.addEventListener('touchend', () => active = false)
  el.addEventListener('touchmove', e => { if (active) { e.preventDefault(); setPos(e.touches[0].clientX) } }, {passive: false})
})
</script>
</body>
</html>`
}

function main() {
  if (!fs.existsSync(debugDir)) {
    console.error(`Debug dir not found: ${debugDir}`)
    process.exit(1)
  }

  const testNames = fs
    .readdirSync(debugDir)
    .filter(f => f.startsWith('commands-(smoke-') && f.endsWith(').json'))
    .map(f => f.replace('commands-(', '').replace(').json', ''))
    .sort()

  if (testNames.length === 0) {
    console.error('No test results found in', debugDir)
    process.exit(1)
  }

  const results = testNames.map(parseTest)
  const timestamp = new Date().toLocaleString()
  const html = buildHtml(results, timestamp)

  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})
  fs.writeFileSync(outputPath, html)

  const passed = results.filter(r => r.passed).length
  const withDiff = results.filter(r => r.diff !== null).length
  const diffNote = withDiff > 0 ? `, ${withDiff} with visual diff` : ''
  console.log(`Report written to ${outputPath} (${passed}/${results.length} passed${diffNote})`)
}

main()
