/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {callSiteRanges, changedRanges, mapBaseLine, parseDiffHunks, unmarkedFile, unmountedChanged} from './changed-sites.mts'

const DIFF = `diff --git a/shared/a.tsx b/shared/a.tsx
index 1..2 100644
--- a/shared/a.tsx
+++ b/shared/a.tsx
@@ -3 +3 @@ const A = () => (
-    <Kb.Box2 direction="vertical">
+    <Kb.Box2 direction="horizontal">
@@ -10,0 +11,2 @@ x
+a
+b
@@ -20,3 +22 @@ y
-c
-d
-e
+f
diff --git a/shared/gone.tsx b/shared/gone.tsx
--- a/shared/gone.tsx
+++ /dev/null
@@ -1,2 +0,0 @@
-x
-y
`

test('parseDiffHunks reads -U0 hunks per post-change path, dropping deleted files', () => {
  const h = parseDiffHunks(DIFF)
  assert.deepEqual([...h.keys()], ['shared/a.tsx'])
  assert.deepEqual(h.get('shared/a.tsx'), [
    {newCount: 1, newStart: 3, oldCount: 1, oldStart: 3},
    {newCount: 2, newStart: 11, oldCount: 0, oldStart: 10},
    {newCount: 1, newStart: 22, oldCount: 3, oldStart: 20},
  ])
})

test('callSiteRanges finds Box2/ClickableBox opening elements, multi-line ones included', () => {
  const src = [
    'import * as Kb from "@/common-adapters"', // 1
    'export const A = () => (', // 2
    '  <Kb.Box2', // 3
    '    direction="vertical"', // 4
    '  >', // 5
    '    <Kb.Text type="Body">x</Kb.Text>', // 6
    '    <ClickableBox onClick={() => {}} />', // 7
    '    <Box2X />', // 8
    '  </Kb.Box2>', // 9
    ')', // 10
  ].join('\n')
  assert.deepEqual(callSiteRanges(src), [
    {end: 5, start: 3},
    {end: 7, start: 7},
  ])
})

test('changedRanges: added lines inside, deletions strictly inside, not deletions just outside', () => {
  const ranges = [
    {end: 5, start: 3},
    {end: 9, start: 9},
  ]
  assert.deepEqual(changedRanges(ranges, [{newCount: 1, newStart: 4, oldCount: 1, oldStart: 4}]), [{end: 5, start: 3}])
  assert.deepEqual(changedRanges(ranges, [{newCount: 0, newStart: 3, oldCount: 2, oldStart: 4}]), [{end: 5, start: 3}])
  assert.deepEqual(changedRanges(ranges, [{newCount: 0, newStart: 5, oldCount: 2, oldStart: 6}]), [])
  assert.deepEqual(changedRanges(ranges, [{newCount: 0, newStart: 8, oldCount: 1, oldStart: 9}]), [])
})

test('mapBaseLine shifts by the hunks above and clamps lines inside a hunk to its replacement', () => {
  const hunks = parseDiffHunks(DIFF).get('shared/a.tsx')!
  assert.equal(mapBaseLine(1, hunks), 1)
  assert.equal(mapBaseLine(3, hunks), 3)
  assert.equal(mapBaseLine(10, hunks), 10)
  assert.equal(mapBaseLine(11, hunks), 13)
  assert.equal(mapBaseLine(20, hunks), 22)
  assert.equal(mapBaseLine(22, hunks), 22)
  assert.equal(mapBaseLine(30, hunks), 30)
})

test('unmountedChanged lists changed sites no mapped base mount lands in', () => {
  const baseHunks = new Map([['a.tsx', [{newCount: 2, newStart: 1, oldCount: 0, oldStart: 0}]]])
  const changed = new Map([
    ['a.tsx', [{end: 5, start: 3}, {end: 12, start: 10}]],
    ['b.tsx', [{end: 1, start: 1}]],
  ])
  // base a.tsx:2 is now line 4, inside the first site; nothing lands in the second
  assert.deepEqual(unmountedChanged({baseHunks, changed, mounted: ['a.tsx:2', 'c.tsx:1']}), ['a.tsx:10', 'b.tsx:1'])
})

test('unmarkedFile matches what the babel plugin skips', () => {
  assert.equal(unmarkedFile('common-adapters/box.tsx'), true)
  assert.equal(unmarkedFile('../x.tsx'), true)
  assert.equal(unmarkedFile('chat/inbox.tsx'), false)
})
