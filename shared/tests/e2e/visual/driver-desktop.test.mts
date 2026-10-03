/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'module'
import {settle} from './driver-desktop.mts'
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
