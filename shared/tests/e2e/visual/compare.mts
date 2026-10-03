import * as fs from 'fs'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
// pngjs is a transitive dep, loaded the same way generate-report-shared.mts does
type PNGCtor = {
  new (o: {width: number; height: number}): PNGData
  sync: {read: (b: Buffer) => PNGData; write: (p: PNGData) => Buffer}
}
const {PNG} = require('pngjs') as {PNG: PNGCtor}

export type PNGData = {width: number; height: number; data: Buffer}
export type Rect = {x: number; y: number; width: number; height: number}
export type CompareResult = {
  equal: boolean
  sizeMismatch: boolean
  changed: number
  bbox: Rect | null
  width: number
  height: number
}

export const makePng = (width: number, height: number): PNGData => new PNG({height, width})
export const readPng = (p: string): PNGData => PNG.sync.read(fs.readFileSync(p))
export const writePng = (p: string, png: PNGData) => fs.writeFileSync(p, PNG.sync.write(png))

export const paintMasks = (png: PNGData, masks: ReadonlyArray<Rect>) => {
  for (const m of masks) {
    const x0 = Math.max(0, Math.floor(m.x))
    const y0 = Math.max(0, Math.floor(m.y))
    const x1 = Math.min(png.width, Math.ceil(m.x + m.width))
    const y1 = Math.min(png.height, Math.ceil(m.y + m.height))
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) png.data.set([255, 0, 255, 255], (y * png.width + x) * 4)
    }
  }
}

export const pngEqual = (a: Buffer, b: Buffer) => {
  const pa = PNG.sync.read(a)
  const pb = PNG.sync.read(b)
  return pa.width === pb.width && pa.height === pb.height && pa.data.equals(pb.data)
}

export const comparePng = (
  basePath: string,
  changePath: string,
  opts: {masks: ReadonlyArray<Rect>; diffOut?: string}
): CompareResult => {
  const a = readPng(basePath)
  const b = readPng(changePath)
  if (a.width !== b.width || a.height !== b.height) {
    return {bbox: null, changed: 0, equal: false, height: b.height, sizeMismatch: true, width: b.width}
  }
  paintMasks(a, opts.masks)
  paintMasks(b, opts.masks)
  const {width, height} = a
  const diff = opts.diffOut ? makePng(width, height) : undefined
  let changed = 0
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const same =
        a.data[i] === b.data[i] &&
        a.data[i + 1] === b.data[i + 1] &&
        a.data[i + 2] === b.data[i + 2] &&
        a.data[i + 3] === b.data[i + 3]
      if (diff) {
        if (same) {
          // faded copy of the change image so the red reads in context
          const g = Math.round((b.data[i]! + b.data[i + 1]! + b.data[i + 2]!) / 3 / 3 + 170)
          diff.data.set([g, g, g, 255], i)
        } else diff.data.set([255, 0, 0, 255], i)
      }
      if (same) continue
      changed++
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (diff && opts.diffOut) writePng(opts.diffOut, diff)
  const bbox = changed ? {height: maxY - minY + 1, width: maxX - minX + 1, x: minX, y: minY} : null
  return {bbox, changed, equal: changed === 0, height, sizeMismatch: false, width}
}
