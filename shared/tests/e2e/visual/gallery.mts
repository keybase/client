// Writes a review page of a base's captures: every tour id with its desktop, iPhone and iPhone Duo
// (per form factor) shots side by side, a checkbox per column to hide it, a notes box per id (kept in the browser's localStorage, keyed by the desktop base), a "Copy notes"
// button that puts the noted ids on the clipboard as a list, and a "Clear notes" button.
//   yarn visual:gallery [--base <sha>] [--desktop <sha>] [--ios <sha>] [--ios-duo-folded <sha>] …(one per Store.IOS_TARGETS and Store.ANDROID_TARGETS)
// Without a sha it shows each platform's last base. KB_VISUAL_NO_OPEN=1 only prints the path.
import {existsSync, readdirSync, writeFileSync} from 'fs'
import path from 'path'
import {spawn} from 'child_process'
import {parseArgs} from 'util'
import {fileURLToPath} from 'url'
import * as Store from './store.mts'
import {SUITE_NAMES, SUITES} from './suites.ts'
import {idMatches} from './tour-types.ts'

// `platform`: the store target the column shows (desktop, ios, ios-duo-folded, …), from a base (`sha`)
// or from a render run (`render`, its dir)
export type GalleryColumn = {platform: Store.StoreTarget} & ({sha: string} | {render: string})

const columnDir = (c: GalleryColumn) => ('render' in c ? c.render : Store.baseThemeDir(c.sha, c.platform, 'light'))
const columnName = (c: GalleryColumn) => `${Store.targetLabel(c.platform)} ${'render' in c ? `render ${path.basename(c.render)}` : c.sha.slice(0, 10)}`
export type GalleryRow = {id: string; shots: Array<string | undefined>}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, c => ({'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'})[c] ?? c)

export const galleryRows = (columns: ReadonlyArray<GalleryColumn>): Array<GalleryRow> => {
  const ids = new Set<string>()
  for (const c of columns) {
    const dir = columnDir(c)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) if (f.endsWith('.png')) ids.add(f.slice(0, -4).replaceAll('__', '/'))
  }
  return [...ids].sort().map(id => ({
    id,
    shots: columns.map(c => {
      const png = path.join(columnDir(c), `${Store.idFile(id)}.png`)
      return existsSync(png) ? path.relative(Store.resultsDir(), png) : undefined
    }),
  }))
}

export const galleryHtml = (columns: ReadonlyArray<GalleryColumn>, rows: ReadonlyArray<GalleryRow>) => {
  const title = columns.map(columnName).join(', ')
  // keyed by the first column's base, so notes survive regenerating the page for the same base
  const first = columns[0]
  const notesKey = `notes-${first ? ('render' in first ? path.basename(first.render) : first.sha) : ''}`
  const sections = rows
    .map(r => {
      const cells = r.shots
        .map((src, i) => {
          const {platform} = columns[i]!
          const img = src
            ? `<a href="${escape(src)}" target="_blank"><img loading="lazy" src="${escape(src)}"></a>`
            : '<div class="none">not captured</div>'
          return `<figure class="${platform}" data-col="${platform}">${img}<figcaption>${escape(Store.targetLabel(platform))}</figcaption></figure>`
        })
        .join('')
      const id = escape(r.id)
      const suites = SUITE_NAMES.filter(n => SUITES[n].some(p => idMatches(r.id, p))).join(' ')
      return `<section data-id="${id}" data-suites="${suites}"><h2>${id}</h2><div class="shots">${cells}</div><textarea placeholder="What's wrong on ${id}?"></textarea></section>`
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
figure.ios img,figure.ios-duo-folded img{width:200px}
figure.ios-duo-unfolded img{width:400px}
figure.ios-duo-split-left img,figure.ios-duo-split-right img{width:400px}
figure.ios-ipad img,figure.android-tablet img{width:480px}
figure.android img{width:200px}
img{display:block;border:1px solid var(--line)}
figcaption{font-size:12px;opacity:.7;margin-top:4px}
.none{width:200px;height:120px;display:grid;place-items:center;opacity:.5;border:1px dashed var(--line)}
textarea{width:100%;box-sizing:border-box;margin-top:8px;min-height:40px;font:inherit;background:var(--bg);color:var(--fg);border:1px solid var(--line)}
</style>
<header><strong>Visual gate captures</strong><span>${escape(title)} · ${rows.length} screens</span>
<input type="search" id="q" placeholder="filter by id (e.g. modal, chat/)"><label><input type="checkbox" id="only"> only noted</label>
${SUITE_NAMES.map(n => `<label><input type="checkbox" class="suite" data-suite="${n}"> only ${n} suite</label>`).join('')}
${columns.map(c => `<label><input type="checkbox" class="col" data-col="${c.platform}" checked> ${escape(Store.targetLabel(c.platform))}</label>`).join('')}
<button id="copy">Copy notes</button><button id="clear">Clear notes</button><span id="msg"></span></header>
${sections}
<script>
const key = ${JSON.stringify(notesKey)}
let notes = {}
try { notes = JSON.parse(localStorage.getItem(key) || '{}') } catch {}
const secs = [...document.querySelectorAll('section')]
const apply = () => {
  const q = document.getElementById('q').value.trim().toLowerCase()
  const only = document.getElementById('only').checked
  const suites = [...document.querySelectorAll('input.suite:checked')].map(c => c.dataset.suite)
  for (const s of secs) {
    const noted = !!notes[s.dataset.id]
    const inSuites = suites.every(n => s.dataset.suites.split(' ').includes(n))
    s.classList.toggle('noted', noted)
    s.style.display = (!q || s.dataset.id.toLowerCase().includes(q)) && (!only || noted) && inSuites ? '' : 'none'
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
for (const c of document.querySelectorAll('input.suite')) c.addEventListener('change', apply)
for (const c of document.querySelectorAll('input.col')) {
  c.addEventListener('change', () => {
    for (const f of document.querySelectorAll('figure[data-col="' + c.dataset.col + '"]')) f.style.display = c.checked ? '' : 'none'
  })
}
// notes live only in this browser's storage, so clearing asks first
document.getElementById('clear').addEventListener('click', () => {
  const n = Object.keys(notes).length
  if (!n || !confirm('Clear all ' + n + ' notes?')) return
  notes = {}
  try { localStorage.removeItem(key) } catch {}
  for (const s of secs) s.querySelector('textarea').value = ''
  document.getElementById('msg').textContent = 'cleared ' + n + ' notes'
  apply()
})
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
  const targets: ReadonlyArray<Store.StoreTarget> = ['desktop', ...Store.IOS_TARGETS, ...Store.ANDROID_TARGETS]
  const {values} = parseArgs({options: {base: {type: 'string'}, ...Object.fromEntries(targets.map(t => [t, {type: 'string' as const}]))}})
  const pick = (platform: Store.StoreTarget) => (values as Record<string, string | undefined>)[platform] ?? values.base ?? Store.readLastBase(platform)
  const columns: Array<GalleryColumn> = []
  // a target with no base shows its newest render run (an iPhone Duo's tour is rendered, not based)
  for (const platform of targets) {
    const sha = pick(platform)
    const render = Store.newestRender(platform)
    if (sha && existsSync(Store.basePlatformDir(sha, platform))) columns.push({platform, sha})
    else if (render && platform !== 'desktop') columns.push({platform, render})
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
