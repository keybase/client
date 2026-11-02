import {execFileSync} from 'child_process'
import {randomBytes} from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newAssetIds, noisePng, requireSavedImage, type AssetInfo} from './save-photos-lib'

const fill = (n: number) => Buffer.alloc(n, 7)

test('a noise png is one sips reads as a png of its size', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noise-png-'))
  try {
    const file = path.join(dir, 'n.png')
    fs.writeFileSync(file, noisePng(5, 3, fill))
    const out = execFileSync('sips', ['-g', 'format', '-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString()
    expect(out).toMatch(/format: png/)
    expect(out).toMatch(/pixelWidth: 5/)
    expect(out).toMatch(/pixelHeight: 3/)
  } finally {
    fs.rmSync(dir, {force: true, recursive: true})
  }
})

test('noise does not compress, so the png is about its pixel bytes', () => {
  const png = noisePng(200, 100, randomBytes)
  expect(png.length).toBeGreaterThan(200 * 100 * 3 * 0.5)
})

test('a png needs a positive whole size', () => {
  expect(() => noisePng(0, 3, fill)).toThrow(/positive whole size/)
  expect(() => noisePng(2.5, 3, fill)).toThrow(/positive whole size/)
})

const A = 'ph://84909AE1-20B4-42B4-85B8-AA125B4EF5A5/L0/001'
const B = 'ph://CD3D5C68-1DD7-42B4-A3DB-47A0E8A8B718/L0/001'
const image = (over: Partial<AssetInfo> = {}): AssetInfo => ({height: 48, mediaType: 'image', width: 64, ...over})

test('the new assets are the ids the library did not hold before, whatever their order', () => {
  expect(newAssetIds([A], [B, A])).toEqual([B])
  expect(newAssetIds([A], [A, B])).toEqual([B])
  expect(newAssetIds([A, B], [A, B])).toEqual([])
  expect(newAssetIds([], [A])).toEqual([A])
})

test('the saved image is the one new asset, an image of the size saved', () => {
  expect(requireSavedImage([B], image(), '64x48')).toBe(B)
})

test('no new asset, more than one, another kind or size, or no id, is not a save', () => {
  expect(() => requireSavedImage([], image(), '64x48')).toThrow(/0 new assets/)
  expect(() => requireSavedImage([A, B], image(), '64x48')).toThrow(/2 new assets/)
  expect(() => requireSavedImage([B], undefined, '64x48')).toThrow(/no info/)
  expect(() => requireSavedImage([B], image({mediaType: 'video'}), '64x48')).toThrow(/not an image/)
  expect(() => requireSavedImage([B], image({width: 48}), '64x48')).toThrow(/not 64x48/)
  expect(() => requireSavedImage(['IMG_1.PNG'], image(), '64x48')).toThrow(/no asset id/)
})
