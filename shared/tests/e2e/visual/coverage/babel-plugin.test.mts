/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const babel = require('@babel/core') as {
  transformSync: (code: string, opts: object) => {code: string} | null
}
const plugin = require('./babel-plugin.cjs') as unknown
const transform = (code: string, filename: string, plugins: Array<unknown>) =>
  babel.transformSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    parserOpts: {plugins: ['jsx', 'typescript']},
    plugins,
  })?.code ?? ''
const run = (code: string, filename = '/repo/shared/settings/x.tsx') =>
  transform(code, filename, [[plugin, {root: '/repo/shared'}]])

test('wraps Kb.Box2 with its file:line and moves key', () => {
  const out = run(`const A = () => items.map(i => <Kb.Box2 key={i} direction="vertical" />)`)
  assert.match(out, /__KbSrcMark id="settings\/x\.tsx:1" key=\{i\}/)
  assert.match(out, /<Kb\.Box2 direction="vertical" \/>/)
  assert.match(out, /import \{ KbSrcMark as __KbSrcMark \} from "@\/tests\/e2e\/visual\/coverage\/src-mark"/)
})

test('leaves other elements, box.tsx and node_modules alone', () => {
  assert.doesNotMatch(run(`const A = () => <Kb.Text type="Body" />`), /__KbSrcMark/)
  assert.doesNotMatch(run(`const A = () => <Box2 direction="vertical" />`, '/repo/shared/common-adapters/box.tsx'), /__KbSrcMark/)
  assert.doesNotMatch(run(`const A = () => <Box2 direction="vertical" />`, '/repo/shared/node_modules/z/a.tsx'), /__KbSrcMark/)
})

test('the other common-adapters are marked', () => {
  assert.match(run(`const A = () => <Box2 direction="vertical" />`, '/repo/shared/common-adapters/y.tsx'), /id="common-adapters\/y\.tsx:1"/)
})

test('ClickableBox is wrapped too', () => {
  assert.match(run(`const A = () => <Kb.ClickableBox onClick={f} />`), /__KbSrcMark/)
  assert.match(run(`const A = () => <ClickableBox onClick={f} />`), /__KbSrcMark/)
})

test('nested call sites each get their own line, wrapped once', () => {
  const out = run(`const A = () => (\n  <Box2 direction="vertical">\n    <Kb.Box2 direction="horizontal" />\n  </Box2>\n)`)
  assert.match(out, /id="settings\/x\.tsx:2"/)
  assert.match(out, /id="settings\/x\.tsx:3"/)
  assert.equal(out.match(/<__KbSrcMark/g)?.length, 2)
})

test('marks the source as written, before plugins listed ahead of it rewrite it', () => {
  // stands in for the react compiler, which must stay first in babel.config.js
  const stripLoc = () => ({visitor: {JSXElement: (p: {node: {loc: unknown}}) => void (p.node.loc = null)}})
  const out = transform(`const A = () => <Box2 direction="vertical" />`, '/repo/shared/settings/x.tsx', [
    stripLoc,
    [plugin, {root: '/repo/shared'}],
  ])
  assert.match(out, /id="settings\/x\.tsx:1"/)
})

test('a file with no call sites gets no import', () => {
  assert.doesNotMatch(run(`const A = () => <Kb.Text type="Body" />`), /src-mark/)
})
