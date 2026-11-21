/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'module'
import {findBlueIcon, findIcon, findSplitViewRow, hasSplitDivider, isSplitWidth, nativePoint} from './split-view-lib.mts'

const require = createRequire(import.meta.url)
const {PNG} = require('pngjs') as {PNG: new (o: {width: number; height: number}) => Img}
type Img = {width: number; height: number; data: Buffer}

// a screen of `w`x`h` points at 3x, filled with a dark wallpaper
const screen = (w: number, h: number) => {
  const img = new PNG({height: h * 3, width: w * 3})
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 60
    img.data[i + 1] = 50
    img.data[i + 2] = 70
    img.data[i + 3] = 255
  }
  return img
}
const fill = (img: Img, x: number, y: number, w: number, h: number, rgb: [number, number, number]) => {
  for (let yy = y * 3; yy < (y + h) * 3; yy++) {
    for (let xx = x * 3; xx < (x + w) * 3; xx++) {
      const i = (yy * img.width + xx) * 4
      img.data[i] = rgb[0]
      img.data[i + 1] = rgb[1]
      img.data[i + 2] = rgb[2]
    }
  }
}
// an app icon: quadrants of four colors, so a match is about its pattern, not one color
const icon = () => {
  const img = new PNG({height: 120, width: 120})
  for (let y = 0; y < 120; y++) {
    for (let x = 0; x < 120; x++) {
      const i = (y * 120 + x) * 4
      const c: [number, number, number] = x < 60 ? (y < 60 ? [240, 120, 20] : [20, 200, 220]) : y < 60 ? [250, 250, 250] : [30, 30, 30]
      img.data.set([...c, 255], i)
    }
  }
  return img
}
const ICON = icon()
// draws the icon as the Home Screen shows it: `size` points square, centered on x,y
const pasteIcon = (img: Img, x: number, y: number, size = 60) => {
  for (let yy = 0; yy < size * 3; yy++) {
    for (let xx = 0; xx < size * 3; xx++) {
      const s = (Math.floor((yy / (size * 3)) * 120) * 120 + Math.floor((xx / (size * 3)) * 120)) * 4
      const d = (((y - size / 2) * 3 + yy) * img.width + (x - size / 2) * 3 + xx) * 4
      ICON.data.copy(img.data, d, s, s + 3)
    }
  }
}

test('findIcon finds the app icon where the Home Screen draws it', () => {
  const s = screen(951, 669)
  pasteIcon(s, 764, 182)
  const at = findIcon(s, ICON)
  assert.ok(at, 'found')
  assert.ok(Math.abs(at.x - 764) <= 4 && Math.abs(at.y - 182) <= 4, JSON.stringify(at))
})

test('findIcon finds nothing on a screen without the icon', () => {
  const s = screen(951, 669)
  fill(s, 0, 0, 951, 669, [245, 245, 245])
  fill(s, 20, 40, 400, 30, [30, 30, 30])
  assert.equal(findIcon(s, ICON), undefined)
})

// A row of text: 8pt-tall strokes 3pt wide every 8pt, as text is mostly card between its strokes
const text = (img: Img, x: number, y: number, w: number, rgb: [number, number, number]) => {
  for (let sx = x; sx < x + w; sx += 8) fill(img, sx, y, 3, 8, rgb)
}

// The app's icon menu: a light card, Edit Home Screen, the red Remove App, then Open in Split View
const menu = (s: Img, x: number, y: number) => {
  fill(s, x, y, 250, 170, [235, 235, 238])
  text(s, x + 20, y + 20, 120, [40, 40, 40])
  text(s, x + 20, y + 60, 100, [230, 50, 50])
  text(s, x + 20, y + 124, 140, [40, 40, 40])
}

test("findSplitViewRow takes the row after Remove App in the app's own menu", () => {
  const s = screen(951, 669)
  menu(s, 600, 300)
  const row = findSplitViewRow(s, {x: 764, y: 182}, 'after-remove', screen(951, 669))
  assert.ok(row, 'found')
  assert.ok(Math.abs(row.y - 428) <= 1, JSON.stringify(row))
  // the row's text starts where the red row's does (x 620); the tap lands inside it
  assert.equal(row.x, 660)
})

test('findSplitViewRow refuses a menu with no red row, and a target row with red in it', () => {
  const noRed = screen(951, 669)
  fill(noRed, 600, 300, 250, 170, [235, 235, 238])
  text(noRed, 620, 424, 140, [40, 40, 40])
  assert.equal(findSplitViewRow(noRed, {x: 764, y: 182}, 'after-remove', screen(951, 669)), undefined)
  const redBelow = screen(951, 669)
  menu(redBelow, 600, 300)
  // red in the target row, narrower than Remove App's so Remove App stays the anchor
  text(redBelow, 700, 424, 40, [230, 50, 50])
  assert.equal(findSplitViewRow(redBelow, {x: 764, y: 182}, 'after-remove', screen(951, 669)), undefined)
})

test('findSplitViewRow refuses a menu-like screen that was already there before the long-press', () => {
  const s = screen(951, 669)
  menu(s, 600, 300)
  assert.equal(findSplitViewRow(s, {x: 764, y: 182}, 'after-remove', s), undefined)
})

// Safari's menu: Open in Split View first, then its own rows, Remove App last
test("findSplitViewRow takes the first row of Safari's menu, and refuses when the first row is red", () => {
  const s = screen(951, 669)
  fill(s, 650, 300, 250, 300, [235, 235, 238])
  for (const dy of [30, 90, 130, 170, 210]) text(s, 670, 300 + dy, 140, [40, 40, 40])
  text(s, 670, 300 + 270, 100, [230, 50, 50])
  const row = findSplitViewRow(s, {x: 903, y: 351}, 'first', screen(951, 669))
  assert.ok(row && Math.abs(row.y - 334) <= 1, JSON.stringify(row))
  const onlyRed = screen(951, 669)
  fill(onlyRed, 650, 300, 250, 300, [235, 235, 238])
  text(onlyRed, 670, 330, 100, [230, 50, 50])
  assert.equal(findSplitViewRow(onlyRed, {x: 903, y: 351}, 'first', screen(951, 669)), undefined)
})

test('findBlueIcon finds the blue icon in the dock at the right edge, and nothing without one', () => {
  const s = screen(951, 669)
  fill(s, 880, 320, 46, 46, [30, 120, 240])
  fill(s, 880, 380, 46, 46, [60, 200, 80])
  const at = findBlueIcon(s)
  assert.ok(at && Math.abs(at.x - 903) <= 4 && Math.abs(at.y - 343) <= 4, JSON.stringify(at))
  assert.equal(findBlueIcon(screen(951, 669)), undefined)
})

test('isSplitWidth: the app is split when its window is about half the screen', () => {
  assert.equal(isSplitWidth(469, 951), true)
  assert.equal(isSplitWidth(951, 951), false)
  assert.equal(isSplitWidth(700, 951), false)
})

test('nativePoint maps interface points to the panel axes the touchscreen takes', () => {
  // the inner panel is portrait; the interface on it is landscape (rot90)
  assert.deepEqual(nativePoint({x: 764, y: 182}, {height: 669, rotation: 'rot90', width: 951}), {u: 182 / 669, v: 1 - 764 / 951})
  assert.deepEqual(nativePoint({x: 100, y: 200}, {height: 678, rotation: 'rot0', width: 466}), {u: 100 / 466, v: 200 / 678})
})

test('hasSplitDivider sees the black bar down the middle of a split screen, and none on a full one', () => {
  const split = screen(951, 669)
  fill(split, 0, 0, 951, 669, [200, 200, 200])
  fill(split, 470, 0, 10, 669, [0, 0, 0])
  assert.equal(hasSplitDivider(split), true)
  const full = screen(951, 669)
  fill(full, 0, 0, 951, 669, [200, 200, 200])
  fill(full, 470, 0, 10, 300, [0, 0, 0])
  assert.equal(hasSplitDivider(full), false)
})
