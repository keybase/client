import * as fs from 'fs'
import * as path from 'path'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
// pngjs is a transitive dep (via image-diff etc.) — intentionally not in package.json
const {PNG} = require('pngjs') as {PNG: {sync: {read: (buf: Buffer) => {data: Buffer; width: number; height: number}}}}

const debugDir = 'tests/results/ios-debug'
const prevDir = 'tests/results/ios-prev'
const outputPath = 'tests/results/ios-report.html'

type CommandStatus = string
type CommandEntry = {
  command: Record<string, unknown>
  metadata: {status: CommandStatus; timestamp: number; duration: number; sequenceNumber: number; error?: string}
}

type DiffResult = {pct: number; changed: number; total: number}

type ScreenshotResult = {
  name: string
  stem: string
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
      if (Math.abs(a.data[i]! - b.data[i]!) + Math.abs(a.data[i + 1]! - b.data[i + 1]!) + Math.abs(a.data[i + 2]! - b.data[i + 2]!) > 45) changed++
    }
    return {pct: (changed / total) * 100, changed, total}
  } catch {
    return null
  }
}

function parseFlow(name: string): ScreenshotResult[] {
  const commands = readCommandsFile(name)
  const failed = commands?.find(c => c.metadata.status === 'FAILED')
  const passed = commands != null && commands.length > 0 && !failed
  const durationMs = commands?.reduce((sum, c) => sum + c.metadata.duration, 0) ?? 0
  const errorMessage = failed
    ? (failed.metadata.error ?? `${Object.keys(failed.command)[0] ?? 'unknown'} failed`)
    : (commands == null || commands.length === 0 ? 'No command data found' : null)
  const failureScreenshotPath = passed ? null : findFailureScreenshot(name)

  const stepFiles = fs.readdirSync(debugDir)
    .filter(f => (f === `${name}.png` || (f.startsWith(`${name}-`) && f.endsWith('.png'))))
    .sort()

  if (stepFiles.length === 0) {
    return [{
      name,
      stem: name,
      passed,
      durationMs,
      screenshotPath: null,
      prevScreenshotPath: null,
      failureScreenshotPath,
      diff: null,
      errorMessage,
    }]
  }

  const results: ScreenshotResult[] = stepFiles.map((file, idx) => {
    const stem = file.replace('.png', '')
    const screenshotPath = path.join(debugDir, file)
    const prevPath = path.join(prevDir, file)
    const prevScreenshotPath = fs.existsSync(prevPath) ? prevPath : null
    const diff = prevScreenshotPath ? computeDiff(screenshotPath, prevScreenshotPath) : null
    const label = stem.startsWith(`${name}-`) ? stem.slice(name.length + 1) : stem
    return {
      name: `${name} · ${label}`,
      stem,
      passed,
      durationMs: idx === 0 ? durationMs : 0,
      screenshotPath,
      prevScreenshotPath,
      failureScreenshotPath: null,
      diff,
      errorMessage: idx === stepFiles.length - 1 ? errorMessage : null,
    }
  })

  // If the flow failed and there's a Maestro failure screenshot, append it as a separate card
  if (!passed && failureScreenshotPath) {
    results.push({
      name: `${name} · failure`,
      stem: `${name}-failure`,
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

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHtml(results: ScreenshotResult[], timestamp: string, title: string): string {
  const totalPassed = results.filter(r => r.passed).length
  const totalFailed = results.length - totalPassed
  const allPassed = totalFailed === 0
  const hasDiff = results.some(r => r.diff !== null)

  const cards = results.map((r, i) => {
    const badge = r.passed ? '<span class="badge pass">PASS</span>' : '<span class="badge fail">FAIL</span>'
    const error = r.errorMessage ? `<div class="error">${escapeHtml(r.errorMessage)}</div>` : ''
    const diff = r.diff
    const deltaBadge = diff
      ? `<span class="badge ${diff.pct < 1 ? 'diff-low' : diff.pct < 5 ? 'diff-mid' : 'diff-high'}" title="${diff.changed.toLocaleString()} of ${diff.total.toLocaleString()} pixels changed">Δ ${diff.pct.toFixed(1)}%</span>`
      : ''
    const durStr = r.durationMs > 0 ? formatDuration(r.durationMs) : ''

    const rel = (p: string) => path.relative(path.dirname(outputPath), p)
    let visual: string
    if (r.screenshotPath && r.prevScreenshotPath) {
      visual = `<div class="compare" id="cmp${i}">
        <img class="img-after" src="${rel(r.screenshotPath)}" alt="current" loading="lazy">
        <img class="img-before" src="${rel(r.prevScreenshotPath)}" alt="baseline" loading="lazy">
        <div class="handle"><div class="grip">⇔</div></div>
        <div class="lbl lbl-l">BASELINE</div>
        <div class="lbl lbl-r">NOW</div>
      </div>`
    } else if (r.screenshotPath) {
      visual = `<div class="solo-wrap"><img class="solo" src="${rel(r.screenshotPath)}" alt="${escapeHtml(r.name)}" loading="lazy"></div>`
    } else if (r.failureScreenshotPath) {
      visual = `<div class="solo-wrap"><img class="solo dim" src="${rel(r.failureScreenshotPath)}" alt="failure" loading="lazy"></div>`
    } else {
      visual = `<div class="empty">No screenshot</div>`
    }

    return `<div class="card ${r.passed ? 'ok' : 'fail'}">
  <div class="hdr">${badge}${deltaBadge}<span class="name">${escapeHtml(r.name.replace(/^(smoke|flow)-/, ''))}</span>${durStr ? `<span class="dur">${durStr}</span>` : ''}${error}</div>
  ${visual}
</div>`
  }).join('\n')

  return buildPage(title, allPassed, totalPassed, totalFailed, results.length, hasDiff, timestamp, cards)
}

function saveBaseline(results: ScreenshotResult[]) {
  fs.mkdirSync(prevDir, {recursive: true})
  let saved = 0
  for (const r of results) {
    if (!r.screenshotPath || !fs.existsSync(r.screenshotPath)) continue
    fs.copyFileSync(r.screenshotPath, path.join(prevDir, `${r.stem}.png`))
    saved++
  }
  console.log(`Baseline saved: ${saved} screenshots to ${prevDir}/`)
}

export function buildPage(title: string, allPassed: boolean, passed: number, failed: number, total: number, hasDiff: boolean, timestamp: string, cards: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
${sharedCss(allPassed)}
</style>
</head>
<body>
<header>
  <div class="hdr-top"><h1>${title}</h1><button id="slideshow-btn" title="Slideshow">▶</button></div>
  <div class="meta"><span>${passed} passed · ${failed} failed · ${total} total</span>${hasDiff ? ' <span>· vs baseline</span>' : ''}<span class="ts">${timestamp}</span></div>
  <div class="filter-wrap"><input id="filter-input" type="search" placeholder="Filter screenshots…" autocomplete="off" spellcheck="false"></div>
</header>
<div class="grid">${cards}</div>
${sliderScript()}
</body>
</html>`
}

export function sharedCss(allPassed: boolean): string {
  return `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f0f0;color:#222}
header{background:${allPassed ? '#1a7a3a' : '#c0392b'};color:#fff;padding:20px 28px}
.hdr-top{display:flex;align-items:center;gap:12px}
h1{font-size:20px;font-weight:600}
#slideshow-btn{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:5px;padding:4px 10px;font-size:14px;cursor:pointer;line-height:1}
#slideshow-btn:hover{background:rgba(255,255,255,.35)}
#slideshow-btn.active{background:rgba(255,255,255,.35)}
.meta{margin-top:6px;font-size:13px;opacity:.85;display:flex;gap:16px;align-items:center}
.ts{opacity:.7}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:20px 28px}
.card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12);border-top:4px solid #ccc}
.card.ok{border-top-color:#27ae60}.card.fail{border-top-color:#e74c3c}
.hdr{padding:12px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.name{font-weight:500;font-size:13px;flex:1;text-transform:capitalize}
.dur{font-size:12px;color:#999}
.badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap}
.badge.pass{background:#d4edda;color:#1a7a3a}.badge.fail{background:#fde8e8;color:#c0392b}
.badge.diff-low{background:#e8f4fd;color:#1a5fa8}.badge.diff-mid{background:#fff3cd;color:#856404}.badge.diff-high{background:#fde8e8;color:#842029}
.error{width:100%;font-size:11px;color:#c0392b;background:#fde8e8;padding:3px 8px;border-radius:4px;word-break:break-word}
.solo-wrap{position:relative;overflow:hidden;background:#000}
.solo{width:100%;display:block}.dim{opacity:.85}
.empty{padding:28px;text-align:center;color:#bbb;font-size:12px;background:#fafafa}
.compare{position:relative;overflow:hidden;cursor:ew-resize;--split:50%;user-select:none}
.compare img,.solo-wrap img{display:block;width:100%;-webkit-user-drag:none;user-drag:none}
.img-after{position:relative}
.img-before{position:absolute;top:0;left:0;width:100%;clip-path:inset(0 calc(100% - var(--split)) 0 0)}
.handle{position:absolute;top:0;bottom:0;left:var(--split);transform:translateX(-50%);width:3px;background:rgba(255,255,255,.9);pointer-events:none}
.grip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.lbl{position:absolute;bottom:8px;font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:3px;background:rgba(0,0,0,.55);color:#fff;pointer-events:none}
.lbl-l{left:8px}.lbl-r{right:8px}
.section-hdr{grid-column:1/-1;font-size:15px;font-weight:600;padding:10px 0 4px;border-bottom:2px solid #ddd;margin-top:8px;color:#444}
.expand-btn{position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:5px;padding:5px 8px;font-size:15px;line-height:1;cursor:pointer;opacity:0;transition:opacity .15s;z-index:5}
.compare:hover .expand-btn,.solo-wrap:hover .expand-btn{opacity:1}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:1000;align-items:center;justify-content:center}
.overlay.open{display:flex}
.ov-wrap{position:relative}
.ov-close{position:absolute;top:-38px;right:0;background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;opacity:.75;padding:4px 8px}
.ov-close:hover{opacity:1}
.ov-compare{position:relative;overflow:hidden;cursor:ew-resize;--split:50%;user-select:none}
.ov-compare .img-after{display:block;max-height:85vh;max-width:85vw;width:auto;height:auto;-webkit-user-drag:none}
.ov-compare .img-before{position:absolute;top:0;left:0;width:100%;height:100%;clip-path:inset(0 calc(100% - var(--split)) 0 0);-webkit-user-drag:none}
.ov-compare .handle{position:absolute;top:0;bottom:0;left:var(--split);transform:translateX(-50%);width:3px;background:rgba(255,255,255,.9);pointer-events:none}
.ov-compare .grip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 6px rgba(0,0,0,.5)}
.ov-compare .lbl{position:absolute;bottom:10px;font-size:11px;font-weight:700;letter-spacing:.05em;padding:3px 9px;border-radius:3px;background:rgba(0,0,0,.55);color:#fff;pointer-events:none}
.ov-compare .lbl-l{left:10px}.ov-compare .lbl-r{right:10px}
@keyframes ov-fadein{from{opacity:0}to{opacity:1}}
.ov-solo{display:block;max-height:90vh;max-width:90vw;width:auto;height:auto;animation:ov-fadein .25s ease}
.ov-controls{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:1002;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.55);border-radius:24px;padding:6px 14px}
.ov-controls button{background:none;border:none;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:4px;opacity:.85}
.ov-controls button:hover{opacity:1;background:rgba(255,255,255,.15)}
.ov-counter{color:rgba(255,255,255,.8);font-size:12px;font-weight:600;letter-spacing:.04em;min-width:52px;text-align:center}
.filter-wrap{padding:10px 28px 14px}
#filter-input{width:100%;max-width:480px;padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.15);color:#fff;font-size:13px;outline:none}
#filter-input::placeholder{color:rgba(255,255,255,.6)}
#filter-input:focus{background:rgba(255,255,255,.25);border-color:rgba(255,255,255,.6)}
.card.hidden{display:none}
.section-hdr.hidden{display:none}`
}

export function sliderScript(): string {
  return `<script>
// ── slider ──────────────────────────────────────────────────────────────────
function initSlider(el) {
  let dragging = false, rect = null
  el.querySelectorAll('img').forEach(img => img.addEventListener('dragstart', e => e.preventDefault()))
  function move(clientX) {
    const pct = Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100))
    el.style.setProperty('--split', pct.toFixed(2) + '%')
  }
  el.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; rect = el.getBoundingClientRect(); move(e.clientX) })
  window.addEventListener('mousemove', e => { if (dragging) move(e.clientX) })
  window.addEventListener('mouseup', () => { dragging = false })
}
document.querySelectorAll('.compare').forEach(initSlider)

// ── overlay ──────────────────────────────────────────────────────────────────
const overlay = document.createElement('div')
overlay.className = 'overlay'
overlay.innerHTML = '<div class="ov-wrap"><button class="ov-close" title="Close (Esc)">✕</button><div class="ov-inner"></div></div>'
document.body.appendChild(overlay)
const ovInner = overlay.querySelector('.ov-inner')
const ovClose = overlay.querySelector('.ov-close')

const ovControls = document.createElement('div')
ovControls.className = 'ov-controls'
ovControls.innerHTML = '<button class="ov-prev" title="Previous (←)">&#8592;</button><button class="ov-playpause" title="Pause/Play (Space)">⏸</button><button class="ov-next" title="Next (→)">&#8594;</button><span class="ov-counter"></span>'
ovControls.style.display = 'none'
document.body.appendChild(ovControls)
const ovPrev = ovControls.querySelector('.ov-prev')
const ovPlayPause = ovControls.querySelector('.ov-playpause')
const ovNext = ovControls.querySelector('.ov-next')
const ovCounter = ovControls.querySelector('.ov-counter')

function closeOverlay() { overlay.classList.remove('open'); stopSlideshow() }
ovClose.addEventListener('click', closeOverlay)
overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay() })

function openCompare(afterSrc, beforeSrc) {
  ovInner.innerHTML = \`<div class="ov-compare">
    <img class="img-after" src="\${afterSrc}">
    <img class="img-before" src="\${beforeSrc}">
    <div class="handle"><div class="grip">⇔</div></div>
    <div class="lbl lbl-l">BASELINE</div>
    <div class="lbl lbl-r">NOW</div>
  </div>\`
  const cmp = ovInner.querySelector('.ov-compare')
  cmp.style.setProperty('--split', '50%')
  initSlider(cmp)
  overlay.classList.add('open')
}

function openSolo(src) {
  ovInner.innerHTML = \`<img class="ov-solo" src="\${src}">\`
  overlay.classList.add('open')
}

// ── expand buttons ───────────────────────────────────────────────────────────
document.querySelectorAll('.compare').forEach(el => {
  const btn = document.createElement('button')
  btn.className = 'expand-btn'
  btn.textContent = '⤢'
  btn.title = 'Expand'
  el.appendChild(btn)
  btn.addEventListener('click', e => {
    e.stopPropagation()
    openCompare(el.querySelector('.img-after').src, el.querySelector('.img-before').src)
  })
})

document.querySelectorAll('.solo-wrap').forEach(el => {
  const btn = document.createElement('button')
  btn.className = 'expand-btn'
  btn.textContent = '⤢'
  btn.title = 'Expand'
  el.appendChild(btn)
  btn.addEventListener('click', e => {
    e.stopPropagation()
    openSolo(el.querySelector('img').src)
  })
})

// ── slideshow ────────────────────────────────────────────────────────────────
let slideshowTimer = null
let slideshowPlaying = false
let slideshowIdx = 0
let slideshowImgs = []
const slideshowBtn = document.getElementById('slideshow-btn')

function slideshowImages() {
  return Array.from(document.querySelectorAll('.grid .card:not(.hidden)')).flatMap(card => {
    const img = card.querySelector('.img-after') ?? card.querySelector('img.solo')
    return img ? [img.src] : []
  })
}

function showSlide(idx) {
  if (!slideshowImgs.length) return
  slideshowIdx = ((idx % slideshowImgs.length) + slideshowImgs.length) % slideshowImgs.length
  openSolo(slideshowImgs[slideshowIdx])
  ovCounter.textContent = \`\${slideshowIdx + 1}/\${slideshowImgs.length}\`
}

function scheduleNext() {
  clearTimeout(slideshowTimer)
  if (slideshowPlaying) slideshowTimer = setTimeout(() => { showSlide(slideshowIdx + 1); scheduleNext() }, 750)
}

function setSlideshowPlaying(playing) {
  slideshowPlaying = playing
  ovPlayPause.textContent = playing ? '⏸' : '▶'
  slideshowBtn.textContent = playing ? '⏸' : '▶'
  slideshowBtn.classList.toggle('active', playing)
  if (playing) scheduleNext()
  else clearTimeout(slideshowTimer)
}

function stopSlideshow() {
  setSlideshowPlaying(false)
  ovControls.style.display = 'none'
}

ovPrev.addEventListener('click', e => { e.stopPropagation(); showSlide(slideshowIdx - 1); scheduleNext() })
ovNext.addEventListener('click', e => { e.stopPropagation(); showSlide(slideshowIdx + 1); scheduleNext() })
ovPlayPause.addEventListener('click', e => { e.stopPropagation(); setSlideshowPlaying(!slideshowPlaying) })
document.addEventListener('keydown', e => {
  if (!overlay.classList.contains('open') || !ovControls.style.display || ovControls.style.display === 'none') return
  if (e.key === 'ArrowLeft') { e.preventDefault(); showSlide(slideshowIdx - 1); scheduleNext() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); showSlide(slideshowIdx + 1); scheduleNext() }
  else if (e.key === ' ') { e.preventDefault(); setSlideshowPlaying(!slideshowPlaying) }
})

slideshowBtn.addEventListener('click', () => {
  if (ovControls.style.display !== 'none') {
    stopSlideshow()
    closeOverlay()
  } else {
    slideshowImgs = slideshowImages()
    if (!slideshowImgs.length) return
    ovControls.style.display = 'flex'
    showSlide(0)
    setSlideshowPlaying(true)
  }
})

// ── filter ───────────────────────────────────────────────────────────────────
const filterInput = document.getElementById('filter-input')

function applyFilter(q) {
  const lq = q.toLowerCase()
  document.querySelectorAll('.grid .card').forEach(card => {
    const name = card.querySelector('.name')?.textContent?.toLowerCase() ?? ''
    card.classList.toggle('hidden', lq.length > 0 && !name.includes(lq))
  })
  document.querySelectorAll('.section-hdr').forEach(hdr => {
    let el = hdr.nextElementSibling
    let anyVisible = false
    while (el && !el.classList.contains('section-hdr')) {
      if (el.classList.contains('card') && !el.classList.contains('hidden')) { anyVisible = true; break }
      el = el.nextElementSibling
    }
    hdr.classList.toggle('hidden', lq.length > 0 && !anyVisible)
  })
}

function syncUrl(q) {
  const url = new URL(location.href)
  if (q) url.searchParams.set('q', q)
  else url.searchParams.delete('q')
  history.replaceState(null, '', url)
}

filterInput.addEventListener('input', () => {
  applyFilter(filterInput.value)
  syncUrl(filterInput.value)
})

const initQ = new URL(location.href).searchParams.get('q') ?? ''
if (initQ) { filterInput.value = initQ; applyFilter(initQ) }
</script>`
}

function main() {
  const isSaveBaseline = process.argv.includes('--save-baseline')

  if (!fs.existsSync(debugDir)) { console.error(`Debug dir not found: ${debugDir}`); process.exit(1) }
  const testNames = fs.readdirSync(debugDir)
    .filter(f => f.startsWith('commands-(') && f.endsWith(').json'))
    .map(f => f.replace('commands-(', '').replace(').json', ''))
    .filter(name => name !== 'setup')
    .sort()
  if (testNames.length === 0) { console.error('No test results found in', debugDir); process.exit(1) }
  const results = testNames.flatMap(parseFlow)

  if (isSaveBaseline) {
    saveBaseline(results)
    return
  }

  const timestamp = new Date().toLocaleString()
  const html = buildHtml(results, timestamp, 'Keybase iOS E2E Tests')
  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})
  fs.writeFileSync(outputPath, html)
  const withDiff = results.filter(r => r.diff !== null).length
  const diffNote = withDiff > 0 ? `, ${withDiff} vs baseline` : ''
  console.log(`Report written to ${outputPath} (${results.filter(r => r.passed).length}/${results.length} passed${diffNote})`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
