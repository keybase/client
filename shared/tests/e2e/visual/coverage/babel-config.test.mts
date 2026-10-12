/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
type Config = {plugins: Array<unknown>}
const makeConfig = require('../../../../babel.config.js') as (api: object) => Config
const pluginPath = require.resolve('./babel-plugin.cjs')

const rnConfig = (opts: {coverage: boolean; isDev: boolean}) => {
  const saved = process.env['KB_VISUAL_COVERAGE']
  process.env['KB_VISUAL_COVERAGE'] = opts.coverage ? '1' : ''
  try {
    const caller = {isDev: opts.isDev, platform: 'ios'}
    let cacheKey = ''
    const config = makeConfig({
      cache: {using: (f: () => string) => void (cacheKey = f())},
      caller: (f: (c: object) => unknown) => f(caller),
      env: () => 'development',
    })
    return {cacheKey, config}
  } finally {
    process.env['KB_VISUAL_COVERAGE'] = saved
  }
}
const hasPlugin = (c: Config) => c.plugins.some(p => Array.isArray(p) && p[0] === pluginPath)

test('the RN config marks call sites only in a dev bundle with KB_VISUAL_COVERAGE=1', () => {
  assert.equal(hasPlugin(rnConfig({coverage: true, isDev: true}).config), true)
  assert.equal(hasPlugin(rnConfig({coverage: true, isDev: false}).config), false)
  assert.equal(hasPlugin(rnConfig({coverage: false, isDev: true}).config), false)
})

test('the coverage flag is part of the config cache key', () => {
  assert.notEqual(rnConfig({coverage: true, isDev: true}).cacheKey, rnConfig({coverage: false, isDev: true}).cacheKey)
})
