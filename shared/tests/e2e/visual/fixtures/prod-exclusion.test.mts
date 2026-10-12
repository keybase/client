/* eslint-disable @typescript-eslint/no-floating-promises */
// The fixture runtime is dev-only: production builds resolve the app entries' import of it to an
// empty module (vite.config.mts, desktop/vite.node.mts and metro.config.js). Only those entries
// import it, by the one specifier the rules match, and nothing else in the app imports fixtures/.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'child_process'
import * as fs from 'fs'
import {createRequire} from 'module'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {makeAlias} from '../../../../vite.config.mts'

const require = createRequire(import.meta.url)
const shared = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const runtimeFile = path.join(shared, 'tests/e2e/visual/fixtures/runtime.ts')
const specifier = '@/tests/e2e/visual/fixtures/runtime'

// What the first matching vite alias turns a specifier into, or undefined when none matches.
const viteResolve = (isDev: boolean, id: string) => {
  for (const a of makeAlias(isDev)) {
    if (typeof a.find === 'string' ? id === a.find || id.startsWith(`${a.find}/`) : a.find.test(id)) {
      return typeof a.find === 'string' ? a.replacement + id.slice(a.find.length) : id.replace(a.find, a.replacement)
    }
  }
  return undefined
}

test('vite: a production build resolves the runtime to the empty module, a dev build to the runtime', () => {
  assert.equal(viteResolve(false, specifier), path.join(shared, 'desktop/empty-module.js'))
  assert.equal(viteResolve(false, `${specifier}.ts`), path.join(shared, 'desktop/empty-module.js'))
  assert.equal(viteResolve(true, specifier), path.join(shared, 'tests/e2e/visual/fixtures/runtime'))
  // nothing else is emptied: its neighbours still resolve through '@'
  assert.equal(viteResolve(false, '@/tests/e2e/visual/fixtures/names'), path.join(shared, 'tests/e2e/visual/fixtures/names'))
})

type Resolution = {type: string; filePath?: string}
type Context = {dev: boolean; resolveRequest: (c: Context, name: string, platform: string | null) => Resolution}
const metro = require('../../../../metro.config.js') as {
  resolver: {resolveRequest: (c: Context, name: string, platform: string | null) => Resolution}
}

const metroResolve = (dev: boolean, filePath: string) => {
  const context: Context = {dev, resolveRequest: () => ({filePath, type: 'sourceFile'})}
  return metro.resolver.resolveRequest(context, specifier, 'ios').filePath
}

test('metro: a --dev false bundle resolves the runtime to the null module, a dev bundle to the runtime', () => {
  assert.equal(metroResolve(false, runtimeFile), path.join(shared, 'null-module.js'))
  assert.equal(metroResolve(true, runtimeFile), runtimeFile)
  const other = path.join(shared, 'tests/e2e/visual/fixtures/names.ts')
  assert.equal(metroResolve(false, other), other)
})

// The app files allowed to import the fixture runtime: dev bootstraps whose import the rules above
// strip from a production build.
const RUNTIME_IMPORTERS = ['app/index.native.tsx', 'desktop/renderer/main2.desktop.tsx']

const importsOf = (src: string) =>
  [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)].map(m => m[1] ?? '')

// Every import of fixtures/ from outside the visual gate's own tree, as `file: specifier`, except the
// runtime imported by the allowed entries under the specifier the production rules match.
const strayFixtureImports = (files: ReadonlyArray<string>, read: (file: string) => string) =>
  files.flatMap(file =>
    importsOf(read(file))
      .filter(spec => /(^|\/)visual\/fixtures(\/|$)/.test(spec))
      .filter(spec => !(spec === specifier && RUNTIME_IMPORTERS.includes(file)))
      .map(spec => `${file}: ${spec}`)
  )

test('only the dev app entries import the fixture runtime, and nothing in the app imports the rest of fixtures/', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.ts', '*.tsx', '*.js', '*.mts', '*.mjs', '*.cjs'], {
    cwd: shared,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter(f => f && !f.startsWith('tests/e2e/visual/') && fs.existsSync(path.join(shared, f)))
  assert.ok(files.some(f => f.startsWith('engine/')), 'the scan sees engine/')
  assert.deepEqual(strayFixtureImports(files, f => fs.readFileSync(path.join(shared, f), 'utf8')), [])
  for (const entry of RUNTIME_IMPORTERS) {
    assert.ok(importsOf(fs.readFileSync(path.join(shared, entry), 'utf8')).includes(specifier), `${entry} loads the runtime`)
  }
})

test('the import check catches the engine, another specifier and a relative path', () => {
  const src: Record<string, string> = {
    'app/index.native.tsx': `import '${specifier}'\nimport {FIXTURES} from '@/tests/e2e/visual/fixtures/names'`,
    'engine/index.tsx': `import '${specifier}'`,
    'stores/x.tsx': `const r = require('../tests/e2e/visual/fixtures/runtime')\nvoid import('../tests/e2e/visual/fixtures/def')`,
  }
  assert.deepEqual(strayFixtureImports(Object.keys(src), f => src[f] ?? ''), [
    'app/index.native.tsx: @/tests/e2e/visual/fixtures/names',
    `engine/index.tsx: ${specifier}`,
    'stores/x.tsx: ../tests/e2e/visual/fixtures/runtime',
    'stores/x.tsx: ../tests/e2e/visual/fixtures/def',
  ])
})
