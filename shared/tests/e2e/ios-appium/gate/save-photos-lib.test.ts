import {execFileSync} from 'child_process'
import {randomBytes} from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {cleanupPlan, newAssetIds, noisePng, requireSavedImage, requireWholeLibraryRead, type AssetInfo} from './save-photos-lib'
import {macTest} from '../../shared/mac-test'

const fill = (n: number) => Buffer.alloc(n, 7)

macTest('a noise png is one sips reads as a png of its size', () => {
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

const C1 = 'ph://11111111-1111-1111-1111-111111111111/L0/001'
const C2 = 'ph://22222222-2222-2222-2222-222222222222/L0/001'

test('a whole library read: two reads that agree, holding at least the corpus count', () => {
  expect([...requireWholeLibraryRead([A, C1, C2], [C2, A, C1], 3)].sort()).toEqual([A, C1, C2].sort())
})

test('a short, empty or unstable read is refused', () => {
  expect(() => requireWholeLibraryRead([], [], 3)).toThrow(/reads 0 assets, fewer than the 3/)
  expect(() => requireWholeLibraryRead([A, C1], [A, C1], 3)).toThrow(/fewer than/)
  expect(() => requireWholeLibraryRead([A, C1, C2], [A, C1], 2)).toThrow(/disagree/)
  expect(() => requireWholeLibraryRead([A, C1], [A, C2], 2)).toThrow(/disagree/)
})

test('cleanup deletes only the recorded ids still there, and reports an unrecorded new asset without deleting it', () => {
  const before = new Set([A, C1])
  expect(cleanupPlan(new Set([B]), before, [A, C1, B])).toEqual({toDelete: [B], unrecorded: []})
  // an asset missing from a short before-read is never deleted, only reported
  expect(cleanupPlan(new Set(), new Set([A]), [A, C1, B])).toEqual({toDelete: [], unrecorded: [C1, B]})
  // a recorded id already gone is not deleted again
  expect(cleanupPlan(new Set([B]), before, [A, C1])).toEqual({toDelete: [], unrecorded: []})
  // a recorded id that was there before is never deleted
  expect(cleanupPlan(new Set([A]), before, [A, C1])).toEqual({toDelete: [], unrecorded: []})
})
