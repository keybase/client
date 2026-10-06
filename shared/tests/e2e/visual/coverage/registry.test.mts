/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {makeCoverage} from './registry.ts'

test('a capture counts only the call sites its entry mounted that are still mounted', () => {
  const c = makeCoverage()
  const unmountChrome = c.mount('tabs.tsx:1')
  const seq = c.seq()
  const unmountLoading = c.mount('loading.tsx:4')
  c.mount('row.tsx:9')
  unmountLoading()
  assert.deepEqual(c.mountedNowSince(seq), ['row.tsx:9'])
  assert.deepEqual(c.mounted(), ['row.tsx:9', 'tabs.tsx:1'])
  unmountChrome()
  assert.deepEqual(c.mounted(), ['row.tsx:9'])
})

test('a site counts while any instance the entry mounted is live, not for an older one', () => {
  const c = makeCoverage()
  c.mount('cell.tsx:2') // a hidden screen's, from before the entry
  const seq = c.seq()
  const unmountNew = c.mount('cell.tsx:2')
  const unmountOther = c.mount('cell.tsx:2')
  unmountNew()
  assert.deepEqual(c.mountedNowSince(seq), ['cell.tsx:2'])
  unmountOther()
  assert.deepEqual(c.mountedNowSince(seq), [])
  assert.deepEqual(c.mounted(), ['cell.tsx:2'])
})

test('an unmount from an earlier mount leaves a later mount of the same site live', () => {
  const c = makeCoverage()
  const first = c.mount('a.tsx:1')
  first()
  const seq = c.seq()
  c.mount('a.tsx:1')
  first()
  assert.deepEqual(c.mountedNowSince(seq), ['a.tsx:1'])
})
