/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vstore-'))
process.env['KB_VISUAL_RESULTS'] = root
const store = await import('./store.mts')

const seal = {fields: {inbox: [1]}, hash: 'h', newestMessageMs: 5, takenAt: 6}

test('paths: ids become file names, base and run dirs sit under the results dir', () => {
  assert.equal(store.baseDir('abc'), path.join(root, 'base', 'abc'))
  assert.equal(store.basePng('abc', 'desktop', 'dark', 'settings/advanced'), path.join(root, 'base', 'abc', 'desktop', 'dark', 'settings__advanced.png'))
  assert.equal(store.baseMasksPath('abc', 'ios', 'light', 'tab/chat'), path.join(root, 'base', 'abc', 'ios', 'light', 'tab__chat.masks.json'))
  assert.equal(store.runDir('s1'), path.join(root, 'runs', 's1'))
})

test('base meta round-trips per platform; a missing meta reads as undefined', () => {
  assert.equal(store.readBaseMeta('m1', 'desktop'), undefined)
  store.writeBaseMeta('m1', 'desktop', {createdAt: 1, frozenAt: 2, seal})
  assert.deepEqual(store.readBaseMeta('m1', 'desktop'), {createdAt: 1, frozenAt: 2, seal})
  assert.equal(store.readBaseMeta('m1', 'ios'), undefined)
})

test('the last base is kept per platform', () => {
  assert.equal(store.readLastBase('desktop'), undefined)
  store.writeLastBase('desktop', 'd1')
  store.writeLastBase('ios', 'i1')
  store.writeLastBase('desktop', 'd2')
  assert.equal(store.readLastBase('desktop'), 'd2')
  assert.equal(store.readLastBase('ios'), 'i1')
})

test('masks default to none; coverage is the union of every stored coverage JSON', () => {
  assert.deepEqual(store.readBaseMasks('c1', 'desktop', 'light', 'tab/chat'), [])
  const a = store.baseCoveragePath('c1', 'desktop', 'light', 'tab/chat')
  const b = store.baseCoveragePath('c1', 'ios', 'light', '__chrome__')
  fs.mkdirSync(path.dirname(a), {recursive: true})
  fs.mkdirSync(path.dirname(b), {recursive: true})
  fs.writeFileSync(a, store.writeCoverageJson(['b.tsx:2', 'a.tsx:1'], false))
  fs.writeFileSync(b, JSON.stringify(['a.tsx:1', 'c.tsx:3']))
  fs.writeFileSync(path.join(path.dirname(a), '..', 'tab__chat.masks.json'), '[]')
  assert.deepEqual(store.readBaseCoverage('c1'), {masked: [], mounted: ['a.tsx:1', 'b.tsx:2', 'c.tsx:3']})
})

test('a masked entry contributes no coverage and is reported', () => {
  const kept = store.baseCoveragePath('c2', 'desktop', 'light', 'tab/chat')
  const masked = store.baseCoveragePath('c2', 'desktop', 'dark', 'tab/people')
  fs.mkdirSync(path.dirname(kept), {recursive: true})
  fs.mkdirSync(path.dirname(masked), {recursive: true})
  fs.writeFileSync(kept, store.writeCoverageJson(['a.tsx:1'], false))
  fs.writeFileSync(masked, store.writeCoverageJson(['a.tsx:1', 'm.tsx:9'], true))
  assert.deepEqual(store.readBaseCoverage('c2'), {
    masked: [path.join('desktop', 'dark', 'tab__people')],
    mounted: ['a.tsx:1'],
  })
})

test('run stamps have no characters a path dislikes', () => {
  assert.equal(store.runStamp(new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6))), '2026-01-02T03-04-05-006Z')
})
