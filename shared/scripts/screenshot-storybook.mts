/**
 * Builds storybook statically, serves it, screenshots every story, saves PNGs
 * to tests/results/storybook-desktop/. Self-contained — no running dev server needed.
 *
 *   --only <titlePrefix>  screenshot only the stories whose title starts with the prefix
 *   --compare <dir>       compare every PNG against the same path under <dir>, exactly; print the
 *                         differing ones and exit 1 on any difference
 */
import {chromium} from '@playwright/test'
import {execSync} from 'child_process'
import fs from 'fs'
import http from 'http'
import path from 'path'
import {fileURLToPath, URL as NodeURL} from 'url'
import {parseArgs} from 'util'
import {comparePng} from '../tests/e2e/visual/compare.mts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sharedDir = path.resolve(__dirname, '..')
const buildDir = '/tmp/storybook-static'
const outputDir = path.resolve(__dirname, '../tests/results/storybook-desktop')
const PORT = 6007
const CONCURRENCY = 6

const {values: args} = parseArgs({
  options: {compare: {type: 'string'}, only: {type: 'string'}},
})
const compareDir = args.compare ? path.resolve(args.compare) : undefined
if (compareDir && (compareDir === outputDir || compareDir.startsWith(outputDir + path.sep))) {
  throw new Error(`--compare ${compareDir} is inside ${outputDir}, which every run deletes`)
}
if (compareDir && !fs.existsSync(compareDir)) throw new Error(`--compare ${compareDir} does not exist`)

// Build storybook to a static directory
console.log('Building storybook (this compiles everything upfront)...')
execSync(`node_modules/.bin/storybook build --output-dir ${buildDir} --config-dir .storybook`, {
  cwd: sharedDir,
  stdio: 'inherit',
})
console.log('Build complete.')

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
}
const server = http.createServer((req, res) => {
  let urlPath = new NodeURL(req.url ?? '/', `http://localhost`).pathname
  if (urlPath === '/') urlPath = '/index.html'
  const filePath = path.join(buildDir, urlPath)
  if (!filePath.startsWith(buildDir + path.sep)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  try {
    const data = fs.readFileSync(filePath)
    const ext = path.extname(filePath)
    res.writeHead(200, {'Content-Type': MIME[ext] ?? 'application/octet-stream'})
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})
await new Promise<void>(resolve => server.listen(PORT, '127.0.0.1', resolve))
const storybookUrl = `http://localhost:${PORT}`
console.log(`Serving static build at ${storybookUrl}`)

const {entries} = (await (await fetch(`${storybookUrl}/index.json`)).json()) as {
  entries: Record<string, {type: string; title: string; name: string}>
}
const {only} = args
const stories = Object.entries(entries).filter(
  ([, e]) => e.type === 'story' && (only === undefined || e.title.startsWith(only))
)
if (only !== undefined && !stories.length) throw new Error(`no story title starts with ${only}`)
console.log(`Found ${stories.length} stories — concurrency ${CONCURRENCY}`)

fs.rmSync(outputDir, {recursive: true, force: true})
fs.mkdirSync(outputDir, {recursive: true})

const executablePath = process.env['CHROME_PATH']
// Without a fixed color profile chromium converts every pixel to the display's profile.
const launchOpts = {args: ['--force-color-profile=srgb'], ...(executablePath ? {executablePath} : {})}
// Playwright bundles a browser keyed to its exact version. Our install path uses
// `--ignore-scripts`, so the browser is never auto-downloaded and a `@playwright/test`
// bump silently leaves the old revision behind. Self-heal: install on first launch failure.
let browser
try {
  browser = await chromium.launch(launchOpts)
} catch (err) {
  if (executablePath || !/Executable doesn't exist|playwright install/.test((err as Error).message)) throw err
  console.log('Chromium not installed for this Playwright version — installing...')
  execSync('node_modules/.bin/playwright install chromium-headless-shell', {cwd: sharedDir, stdio: 'inherit'})
  browser = await chromium.launch(launchOpts)
}

// The page side of the evaluations below; this script is typed without the DOM lib.
type PageWindow = {
  document: {
    body: {classList: {contains: (c: string) => boolean}}
    fonts: {ready: Promise<unknown>}
    querySelector: (s: string) => {childElementCount: number} | null
  }
}

const queue = [...stories]
let done = 0
const total = stories.length * 2

await Promise.all(
  Array.from({length: CONCURRENCY}, async () => {
    // Fixed viewport with no fullPage capture: every screenshot is exactly
    // 900x900. fullPage sizes to content height, which drifts between runs and
    // makes baseline/now differ in dimensions (computeDiff bails on size mismatch).
    const page = await browser.newPage({viewport: {width: 900, height: 900}})

    while (queue.length) {
      const item = queue.shift()
      if (!item) break
      const [id, {title, name}] = item
      try {
        const storyDir = path.join(outputDir, title.replaceAll('/', '-'))
        fs.mkdirSync(storyDir, {recursive: true})
        const slug = name.replaceAll(/\s+/g, '-')

        // 'load' fires while storybook still shows its preparing spinner; the body only gets
        // sb-show-main once the story has rendered.
        const capture = async (url: string, file: string) => {
          await page.goto(url, {timeout: 10000, waitUntil: 'load'})
          await page.waitForFunction(
            () => {
              const {document: d} = globalThis as unknown as PageWindow
              return d.body.classList.contains('sb-show-main') && !!d.querySelector('#storybook-root')?.childElementCount
            },
            undefined,
            {timeout: 10000}
          )
          await page.evaluate(async () => {
            await (globalThis as unknown as PageWindow).document.fonts.ready
          })
          await page.screenshot({animations: 'disabled', path: path.join(storyDir, file)})
        }

        await page.emulateMedia({colorScheme: 'light'})
        await capture(`${storybookUrl}/iframe.html?id=${id}&viewMode=story`, `${slug}.png`)
        done++
        console.log(`  [${done}/${total}] ${title}/${name} (light)`)

        await page.emulateMedia({colorScheme: 'dark'})
        await capture(`${storybookUrl}/iframe.html?id=${id}&viewMode=story&globals=darkMode:true`, `${slug}-dark.png`)
        done++
        console.log(`  [${done}/${total}] ${title}/${name} (dark)`)
      } catch (err) {
        console.warn(`  SKIP ${title}/${name}: ${(err as Error).message.split('\n')[0]}`)
      }
    }
    await page.close()
  })
)

await browser.close()
server.close()
console.log(`\nDone — ${done}/${total} screenshots in ${outputDir}`)

if (compareDir) {
  const listPngs = (root: string) =>
    fs
      .readdirSync(root, {recursive: true})
      .map(String)
      .filter(f => f.endsWith('.png'))
      .sort()
  const now = listPngs(outputDir)
  const base = new Set(listPngs(compareDir))
  const differing: Array<string> = []
  for (const rel of now) {
    if (!base.delete(rel)) {
      differing.push(`${rel}: not in ${compareDir}`)
      continue
    }
    const r = comparePng(path.join(compareDir, rel), path.join(outputDir, rel), {masks: []})
    if (r.sizeMismatch) differing.push(`${rel}: size differs`)
    else if (!r.equal) differing.push(`${rel}: ${r.changed} px differ`)
  }
  for (const rel of base) differing.push(`${rel}: missing from this run`)
  if (done !== total) differing.push(`${total - done} screenshots were skipped`)
  console.log(`\nCompared ${now.length} screenshots against ${compareDir}: ${differing.length} differences`)
  for (const d of differing) console.log(`  ${d}`)
  if (differing.length) process.exit(1)
}
