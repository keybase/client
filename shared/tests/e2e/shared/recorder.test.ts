import type {Page} from '@playwright/test'
import {keepBeforeReload, mergeRecordings, takeKept, type Recording} from './recorder'

const rec = (rpcs: Array<string>, routes: Array<string> = [], startRoutes: Array<string> = []): Recording => ({routes, rpcs, startRoutes})

// a page whose recorder hands back each of `takes` in turn
const fakePage = (takes: Array<Recording>) => ({evaluate: async () => Promise.resolve(takes.shift())}) as unknown as Page

test('merging keeps the first startRoutes and each route and rpc once, in the order first seen', () => {
  expect(
    mergeRecordings([rec(['a', 'b'], ['r1'], ['s1']), rec(['b', 'c'], ['r2', 'r1'], ['s2'])])
  ).toEqual({routes: ['r1', 'r2'], rpcs: ['a', 'b', 'c'], startRoutes: ['s1']})
  expect(mergeRecordings([])).toEqual(rec([]))
})

test('what was kept before each reload comes back once, oldest first', async () => {
  const page = fakePage([rec(['before-1']), rec(['before-2'])])
  await keepBeforeReload(page)
  await keepBeforeReload(page)
  expect(takeKept(page).map(r => r.rpcs)).toEqual([['before-1'], ['before-2']])
  expect(takeKept(page)).toEqual([])
})
