/* eslint-disable @typescript-eslint/no-floating-promises */
// The fixture runtime is dev-only: production builds resolve the engine's import of it to an empty
// module (vite.config.mts, desktop/vite.node.mts and metro.config.js).
import {test} from 'node:test'
import assert from 'node:assert/strict'
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
