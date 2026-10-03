/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {comparePng, writePng, makePng} from './compare.mts'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-compare-'))
const solid = (w: number, h: number, rgba: [number, number, number, number]) => {
  const p = makePng(w, h)
  for (let i = 0; i < w * h * 4; i += 4) p.data.set(rgba, i)
  return p
}
const save = (name: string, p: ReturnType<typeof makePng>) => {
  const f = path.join(dir, name)
  writePng(f, p)
  return f
}

test('identical images are equal', () => {
  const a = save('a.png', solid(10, 10, [1, 2, 3, 255]))
  const b = save('b.png', solid(10, 10, [1, 2, 3, 255]))
  const r = comparePng(a, b, {masks: []})
  assert.equal(r.equal, true)
  assert.equal(r.changed, 0)
  assert.equal(r.bbox, null)
})

test('one channel off by one is a difference (no threshold)', () => {
  const p = solid(10, 10, [1, 2, 3, 255])
  p.data[(3 * 10 + 4) * 4 + 2] = 4
  const r = comparePng(save('c.png', solid(10, 10, [1, 2, 3, 255])), save('d.png', p), {masks: []})
  assert.equal(r.equal, false)
  assert.equal(r.changed, 1)
  assert.deepEqual(r.bbox, {x: 4, y: 3, width: 1, height: 1})
})

test('alpha difference counts', () => {
  const p = solid(4, 4, [0, 0, 0, 255])
  p.data[3] = 254
  assert.equal(comparePng(save('e.png', solid(4, 4, [0, 0, 0, 255])), save('f.png', p), {masks: []}).changed, 1)
})

test('masked pixels are ignored', () => {
  const p = solid(10, 10, [0, 0, 0, 255])
  p.data.set([255, 255, 255, 255], (5 * 10 + 5) * 4)
  const r = comparePng(save('g.png', solid(10, 10, [0, 0, 0, 255])), save('h.png', p), {
    masks: [{x: 4, y: 4, width: 3, height: 3}],
  })
  assert.equal(r.equal, true)
})

test('size mismatch fails', () => {
  const r = comparePng(save('i.png', solid(10, 10, [0, 0, 0, 255])), save('j.png', solid(10, 11, [0, 0, 0, 255])), {masks: []})
  assert.equal(r.equal, false)
  assert.equal(r.sizeMismatch, true)
})

test('diffOut writes a png the size of the inputs', () => {
  const p = solid(6, 6, [0, 0, 0, 255])
  p.data.set([9, 9, 9, 255], 0)
  const out = path.join(dir, 'diff.png')
  comparePng(save('k.png', solid(6, 6, [0, 0, 0, 255])), save('l.png', p), {masks: [], diffOut: out})
  assert.ok(fs.existsSync(out))
})
