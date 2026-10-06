// Builds the production desktop renderer and main-process bundles and a `--dev false` iOS Metro
// bundle into a temp dir, and fails if any holds the fixture runtime. From shared/:
//   node tests/e2e/visual/fixtures/check-prod-bundles.mts [--skip-desktop] [--skip-ios]
// Slow (minutes): it is not part of visual:unit, which tests the resolution itself
// (prod-exclusion.test.mts).
import {execFileSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {build} from 'vite'
import {makeNodeConfig} from '../../../../desktop/vite.node.mts'

const shared = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
// the runtime's globals, and a string only its code holds
export const MARKERS = ['__kbVisualFixtures', '__kbVisualRpc', 'it writes, and no rule answers it']

const filesUnder = (dir: string): Array<string> =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(d => {
    const p = path.join(dir, d.name)
    return d.isDirectory() ? filesUnder(p) : /\.(js|jsbundle|mjs|cjs)$/.test(d.name) ? [p] : []
  })

const scan = (label: string, files: ReadonlyArray<string>) => {
  if (!files.length) throw new Error(`${label}: the build wrote no bundle`)
  const hits: Array<string> = []
  let bytes = 0
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    bytes += text.length
    for (const m of MARKERS) if (text.includes(m)) hits.push(`${path.basename(f)}: ${m}`)
  }
  console.log(`${hits.length ? '✗' : '✓'} ${label}: ${files.length} file(s), ${bytes} bytes${hits.length ? `\n  ${hits.join('\n  ')}` : ', no fixture runtime'}`)
  return hits.length === 0
}

const main = async () => {
  const skip = new Set(process.argv.slice(2))
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-prod-bundles-'))
  let ok = true
  try {
    if (!skip.has('--skip-desktop')) {
      const renderer = path.join(out, 'renderer')
      execFileSync('node_modules/.bin/vite', ['build', '--mode', 'production', '--outDir', renderer, '--emptyOutDir'], {
        cwd: shared,
        stdio: 'inherit',
      })
      ok = scan('desktop renderer (vite build --mode production)', filesUnder(renderer)) && ok
      const main = path.join(out, 'node')
      const config = makeNodeConfig('node', {isDev: false, isHot: false, isProfile: false})
      await build({...config, build: {...config.build, emptyOutDir: true, outDir: main}, logLevel: 'warn'})
      ok = scan('desktop main process (vite.node.mts, production)', filesUnder(main)) && ok
    }
    if (!skip.has('--skip-ios')) {
      const bundle = path.join(out, 'ios', 'main.jsbundle')
      fs.mkdirSync(path.dirname(bundle), {recursive: true})
      execFileSync(
        'node_modules/.bin/react-native',
        ['bundle', '--platform', 'ios', '--dev', 'false', '--entry-file', 'index.ios.js', '--bundle-output', bundle],
        {cwd: shared, stdio: 'inherit'}
      )
      ok = scan('iOS (react-native bundle --dev false)', [bundle]) && ok
    }
  } finally {
    fs.rmSync(out, {force: true, recursive: true})
  }
  process.exit(ok ? 0 : 1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
