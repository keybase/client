// Desktop half of the visual-gate coverage transform: runs babel-plugin.cjs over the app's .tsx
// sources ahead of @vitejs/plugin-react (whose oxc pass compiles them), with only the JSX and
// TypeScript syntax plugins so nothing else changes.
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {Plugin, Rollup} from 'vite'

type Babel = {
  transformAsync: (code: string, opts: object) => Promise<{code?: string | null; map?: Rollup.SourceMapInput | null} | null>
}
const TAG = /\b(Box2|ClickableBox)\b/

// Babel is only loaded when the plugin is created, so Vite runs without coverage never load it.
export const visualCoveragePlugin = (): Plugin => {
  const require = createRequire(import.meta.url)
  const babel = require('@babel/core') as Babel
  const coveragePlugin = require('./babel-plugin.cjs') as unknown
  const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
  return {
    apply: 'serve',
    enforce: 'pre',
    name: 'kb-visual-coverage',
    async transform(code, id) {
      const file = id.split('?')[0] ?? id
      if (!file.endsWith('.tsx') || file.includes('/node_modules/') || !TAG.test(code)) return null
      const out = await babel.transformAsync(code, {
        babelrc: false,
        configFile: false,
        filename: file,
        parserOpts: {plugins: ['jsx', 'typescript']},
        plugins: [[coveragePlugin, {root: sharedDir}]],
        sourceMaps: true,
      })
      const marked = out?.code
      if (!marked?.includes('__KbSrcMark')) return null
      return {code: marked, map: out?.map}
    },
  }
}
