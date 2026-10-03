// The HTML report of a check, gate or aa run: one card per entry and theme, failing cards first,
// with a base/change slider, a diff overlay toggle and hatched mask boxes.
import * as fs from 'fs'
import * as path from 'path'
import {escapeHtml, sharedCss} from '../generate-report-shared.mts'
import type {CompareResult, Rect} from './compare.mts'

export type RowStatus = 'same' | 'differs' | 'unstable' | 'failed'
export type ReportRow = {
  id: string
  platform: string
  theme: string
  basePng: string | null
  changePng: string | null
  diffPng: string | null
  result: CompareResult | null
  status: RowStatus
  masks: ReadonlyArray<Rect>
  error?: string
}

export const verdict = (r: Pick<ReportRow, 'status' | 'result' | 'error'>): string => {
  switch (r.status) {
    case 'same':
      return '0 px'
    case 'failed':
      return `failed: ${r.error ?? 'unknown error'}`
    case 'unstable':
      return 'unstable: the screen kept changing'
    case 'differs': {
      const res = r.result
      if (!res) return 'differs'
      if (res.sizeMismatch) return `size differs: change is ${res.width}×${res.height}`
      const b = res.bbox
      return `${res.changed.toLocaleString('en-US')} px${b ? ` in ${b.width}×${b.height} at (${b.x},${b.y})` : ''}`
    }
  }
}

const CSS = `
.vcmp{position:relative;overflow:hidden;cursor:ew-resize;--split:50%;user-select:none;background:#000}
.vcmp img{display:block;width:100%;-webkit-user-drag:none}
.vcmp .img-before{position:absolute;top:0;left:0;clip-path:inset(0 calc(100% - var(--split)) 0 0)}
.vcmp .img-diff{position:absolute;top:0;left:0;display:none}
.card.show-diff .img-diff{display:block}
.vcmp .handle{position:absolute;top:0;bottom:0;left:var(--split);transform:translateX(-50%);width:3px;background:rgba(255,255,255,.9);pointer-events:none}
.mask{position:absolute;border:1px solid #c0c;background:repeating-linear-gradient(45deg,rgba(204,0,204,.35) 0 4px,transparent 4px 9px);pointer-events:none}
.tools{padding:0 14px 10px;font-size:12px;display:flex;gap:12px;align-items:center}
.verdict{font-size:12px;font-family:ui-monospace,monospace;width:100%;color:#555}
.badge.same{background:#d4edda;color:#1a7a3a}`

const SCRIPT = `<script>
document.querySelectorAll('.vcmp').forEach(el => {
  let dragging = false
  const move = x => { const r = el.getBoundingClientRect(); el.style.setProperty('--split', Math.max(0, Math.min(100, (x - r.left) / r.width * 100)) + '%') }
  el.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; move(e.clientX) })
  window.addEventListener('mousemove', e => { if (dragging) move(e.clientX) })
  window.addEventListener('mouseup', () => { dragging = false })
})
document.querySelectorAll('.diff-toggle').forEach(cb => cb.addEventListener('change', () => cb.closest('.card').classList.toggle('show-diff', cb.checked)))
</script>`

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`

const card = (r: ReportRow, rel: (p: string) => string) => {
  const ok = r.status === 'same'
  const label = `${r.id} ${r.platform} ${r.theme}`
  const size = r.result && !r.result.sizeMismatch ? r.result : null
  const masks = size
    ? r.masks
        .map(
          m =>
            `<div class="mask" style="left:${pct(m.x, size.width)};top:${pct(m.y, size.height)};width:${pct(m.width, size.width)};height:${pct(m.height, size.height)}"></div>`
        )
        .join('')
    : ''
  let visual: string
  if (r.basePng && r.changePng) {
    visual = `<div class="vcmp">
  <img class="img-after" src="${rel(r.changePng)}" alt="change" loading="lazy">
  <img class="img-before" src="${rel(r.basePng)}" alt="base" loading="lazy">
  ${r.diffPng ? `<img class="img-diff" src="${rel(r.diffPng)}" alt="diff" loading="lazy">` : ''}
  ${masks}
  <div class="handle"></div>
  <div class="lbl lbl-l">BASE</div><div class="lbl lbl-r">CHANGE</div>
</div>`
  } else if (r.changePng || r.basePng) {
    visual = `<div class="vcmp"><img src="${rel((r.changePng ?? r.basePng)!)}" alt="${escapeHtml(label)}" loading="lazy">${masks}</div>`
  } else {
    visual = '<div class="empty">No screenshot</div>'
  }
  const tools = r.diffPng ? `<div class="tools"><label><input type="checkbox" class="diff-toggle"> diff overlay</label></div>` : ''
  return `<div class="card ${ok ? 'ok' : 'fail'}">
  <div class="hdr"><span class="badge ${ok ? 'same' : 'fail'}">${ok ? 'SAME' : r.status.toUpperCase()}</span><span class="name">${escapeHtml(label)}</span>
  <div class="verdict">${escapeHtml(verdict(r))}</div></div>
  ${visual}
  ${tools}
</div>`
}

export const writeReport = (dir: string, rows: ReadonlyArray<ReportRow>, title = 'Visual gate'): string => {
  fs.mkdirSync(dir, {recursive: true})
  const out = path.join(dir, 'report.html')
  const rel = (p: string) => path.relative(dir, p).split(path.sep).map(encodeURIComponent).join('/')
  const sorted = [...rows].sort((a, b) => Number(a.status === 'same') - Number(b.status === 'same'))
  const bad = rows.filter(r => r.status !== 'same').length
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${sharedCss(bad === 0)}${CSS}</style></head>
<body>
<header><div class="hdr-top"><h1>${escapeHtml(title)}</h1></div>
<div class="meta"><span>${rows.length - bad} same · ${bad} not · ${rows.length} total</span><span class="ts">${new Date().toISOString()}</span></div></header>
<div class="grid">${sorted.map(r => card(r, rel)).join('\n')}</div>
${SCRIPT}
</body></html>`
  fs.writeFileSync(out, html)
  return out
}
