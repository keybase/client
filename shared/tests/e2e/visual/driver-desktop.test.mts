/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'module'
import {settle, waitForQuiet, waitsAtTabRoot} from './driver-desktop.mts'
import {makePng, type PNGData} from './compare.mts'

const {PNG} = createRequire(import.meta.url)('pngjs') as {PNG: {sync: {write: (p: PNGData) => Buffer}}}
const frame = (v: number) => {
  const p = makePng(2, 2)
  p.data.fill(v)
  return PNG.sync.write(p)
}

test('settles when two frames match', async () => {
  const frames = [frame(1), frame(2), frame(2)]
  const r = await settle(async () => Promise.resolve(frames.shift() ?? frame(2)), {deadlineMs: 2000, intervalMs: 1})
  assert.equal(r.stable, true)
  assert.ok(r.png.equals(frame(2)))
})

test('gives up at the deadline on a frame that keeps changing', async () => {
  let n = 0
  const r = await settle(async () => Promise.resolve(frame(n++ % 250)), {deadlineMs: 200, intervalMs: 1})
  assert.equal(r.stable, false)
})

test('a snapshot that throws fails the settle instead of hanging', async () => {
  await assert.rejects(
    settle(async () => Promise.reject(new Error('page gone')), {deadlineMs: 200, intervalMs: 1}),
    /page gone/
  )
})

test('a quiet wait needs the check to hold for the whole window', async () => {
  // idle, busy (a loader starting after the first reading), then idle for good
  const readings = [true, false]
  const start = Date.now()
  let idleSince = 0
  await waitForQuiet('idle', 2000, 300, async () => {
    const r = readings.shift() ?? true
    if (r && !idleSince) idleSince = Date.now()
    if (!r) idleSince = 0
    return Promise.resolve(r)
  })
  assert.ok(Date.now() - idleSince >= 300, 'returned before the check had held for 300ms')
  assert.ok(Date.now() - start < 2000)
})

test('a quiet wait that never settles fails at its deadline', async () => {
  let n = 0
  await assert.rejects(
    waitForQuiet('idle', 300, 200, async () => Promise.resolve(n++ % 2 === 0)),
    /timed out after 0.3s waiting for idle/
  )
})

test('a capture waits at its tab root only when it leaves it, acts on it, or has a fixture', () => {
  const tab = 'tabs.peopleTab'
  assert.equal(waitsAtTabRoot({nav: {tab}}), false)
  assert.equal(waitsAtTabRoot({nav: {append: {name: 'x'}, tab}}), true)
  assert.equal(waitsAtTabRoot({nav: {tab, thread: {ref: 'conv'}}} as never), true)
  assert.equal(waitsAtTabRoot({nav: {tab}, setup: [{kind: 'click', testID: 'x'}]} as never), true)
  assert.equal(waitsAtTabRoot({nav: {tab}, setup: []}), false)
  assert.equal(waitsAtTabRoot({fixture: {name: 'people-suggestions'}, nav: {tab}} as never), true)
})
