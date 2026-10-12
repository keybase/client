// Writes a review page of a base's captures: every tour id with its desktop and iOS shot side by
// side, a notes box per id (kept in the browser's localStorage, keyed by the desktop base) and a "Copy notes"
// button that puts the noted ids on the clipboard as a list.
//   yarn visual:gallery [--base <sha>] [--desktop <sha>] [--ios <sha>]
// Without a sha it shows each platform's last base. KB_VISUAL_NO_OPEN=1 only prints the path.
import {existsSync, readdirSync, writeFileSync} from 'fs'
import path from 'path'
import {spawn} from 'child_process'
import {parseArgs} from 'util'
import {fileURLToPath} from 'url'
import * as Store from './store.mts'

export type GalleryColumn = {platform: Store.RunPlatform; sha: string}
export type GalleryRow = {id: string; shots: Array<string | undefined>}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, c => ({'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'})[c] ?? c)

export const galleryRows = (columns: ReadonlyArray<GalleryColumn>): Array<GalleryRow> => {
  const ids = new Set<string>()
  for (const {platform, sha} of columns) {
    const dir = Store.baseThemeDir(sha, platform, 'light')
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) if (f.endsWith('.png')) ids.add(f.slice(0, -4).replaceAll('__', '/'))
  }
  return [...ids].sort().map(id => ({
    id,
    shots: columns.map(({platform, sha}) => {
      const png = Store.basePng(sha, platform, 'light', id)
      return existsSync(png) ? path.relative(Store.resultsDir(), png) : undefined
    }),
  }))
}

export const galleryHtml = (columns: ReadonlyArray<GalleryColumn>, rows: ReadonlyArray<GalleryRow>) => {
  const title = columns.map(c => `${c.platform} ${c.sha.slice(0, 10)}`).join(', ')
  // keyed by the first column's base, so notes survive regenerating the page for the same base
  const notesKey = `notes-${columns[0]?.sha ?? ""}`
  const sections = rows
    .map(r => {
      const cells = r.shots
        .map((src, i) => {
          const {platform} = columns[i]!
          const img = src
            ? `<a href="${escape(src)}" target="_blank"><img loading="lazy" src="${escape(src)}"></a>`
            : '<div class="none">not captured</div>'
          return `<figure class="${platform}">${img}<figcaption>${platform}</figcaption></figure>`
        })
        .join('')
      const id = escape(r.id)
      return `<section data-id="${id}"><h2>${id}</h2><div class="shots">${cells}</div><textarea placeholder="What's wrong on ${id}?"></textarea></section>`
    })
    .join('\n')
  return `<!doctype html><meta charset="utf-8"><title>Visual gate captures</title>
<style>
:root{--bg:#f6f6f6;--fg:#222;--card:#fff;--line:#ddd}
@media (prefers-color-scheme:dark){:root{--bg:#161616;--fg:#eee;--card:#222;--line:#333}}
body{margin:0;padding:16px;font:14px -apple-system,system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{position:sticky;top:0;background:var(--bg);padding:8px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:1;border-bottom:1px solid var(--line)}
input[type=search]{padding:6px;min-width:240px}
section{background:var(--card);border:1px solid var(--line);border-radius:8px;margin:12px 0;padding:12px}
section.noted{border-color:#e0a800}
h2{font-size:15px;margin:0 0 8px}
.shots{display:flex;gap:12px;align-items:flex-start;overflow-x:auto}
figure{margin:0}
figure.desktop img{width:480px}
figure.ios img{width:200px}
img{display:block;border:1px solid var(--line)}
figcaption{font-size:12px;opacity:.7;margin-top:4px}
.none{width:200px;height:120px;display:grid;place-items:center;opacity:.5;border:1px dashed var(--line)}
textarea{width:100%;box-sizing:border-box;margin-top:8px;min-height:40px;font:inherit;background:var(--bg);color:var(--fg);border:1px solid var(--line)}
</style>
<header><strong>Visual gate captures</strong><span>${escape(title)} · ${rows.length} screens</span>
<input type="search" id="q" placeholder="filter by id (e.g. modal, chat/)"><label><input type="checkbox" id="only"> only noted</label>
<button id="copy">Copy notes</button><span id="msg"></span></header>
${sections}
<script>
const key = ${JSON.stringify(notesKey)}
let notes = {}
try { notes = JSON.parse(localStorage.getItem(key) || '{}') } catch {}
const secs = [...document.querySelectorAll('section')]
const apply = () => {
  const q = document.getElementById('q').value.trim().toLowerCase()
  const only = document.getElementById('only').checked
  for (const s of secs) {
    const noted = !!notes[s.dataset.id]
    s.classList.toggle('noted', noted)
    s.style.display = (!q || s.dataset.id.toLowerCase().includes(q)) && (!only || noted) ? '' : 'none'
  }
}
for (const s of secs) {
  const ta = s.querySelector('textarea')
  ta.value = notes[s.dataset.id] || ''
  ta.addEventListener('input', () => {
    if (ta.value.trim()) notes[s.dataset.id] = ta.value
    else delete notes[s.dataset.id]
    try { localStorage.setItem(key, JSON.stringify(notes)) } catch {}
    apply()
  })
}
document.getElementById('q').addEventListener('input', apply)
document.getElementById('only').addEventListener('change', apply)
document.getElementById('copy').addEventListener('click', async () => {
  const text = Object.entries(notes).map(([id, n]) => '- ' + id + ': ' + n.replace(/\\n/g, ' ')).join('\\n')
  try {
    await navigator.clipboard.writeText(text)
    document.getElementById('msg').textContent = 'copied ' + Object.keys(notes).length + ' notes'
  } catch {
    prompt('Copy these notes', text)
  }
})
apply()
</script>`
}

const main = () => {
  const {values} = parseArgs({options: {base: {type: 'string'}, desktop: {type: 'string'}, ios: {type: 'string'}}})
  const pick = (platform: Store.RunPlatform) => values[platform] ?? values.base ?? Store.readLastBase(platform)
  const columns: Array<GalleryColumn> = []
  for (const platform of ['desktop', 'ios'] as const) {
    const sha = pick(platform)
    if (sha && existsSync(Store.basePlatformDir(sha, platform))) columns.push({platform, sha})
  }
  if (!columns.length) throw new Error('no base to show: take one with yarn visual:base, or pass --base <sha>')
  const out = path.join(Store.resultsDir(), 'gallery.html')
  const rows = galleryRows(columns)
  writeFileSync(out, galleryHtml(columns, rows))
  console.log(`gallery (${rows.length} screens): ${out}`)
  if (!process.env['KB_VISUAL_NO_OPEN']) spawn('open', [out], {detached: true, stdio: 'ignore'}).unref()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (e) {
    console.error(`✗ visual:gallery: ${(e as Error).message}`)
    process.exit(1)
  }
}
