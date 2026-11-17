/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {enterSplit, parseAnyPosture, type SplitDeps} from './split-view.mts'
import type {Img, Point} from './split-view-lib.mts'

// Screens are named; the finders read what each named screen shows
type Shot = 'home' | 'kb-menu' | 'safari-menu' | 'kb-left' | 'safari-left' | 'blank'
const img = (name: Shot) => ({data: Buffer.from(name), height: 1, width: 1}) as Img
const nameOf = (s: Img) => Buffer.from(s.data).toString() as Shot

const KEYBASE = {x: 764, y: 182}
const KEYBASE_HALF = {x: 806, y: 182}
const SAFARI = {x: 903, y: 351}

const fake = (shots: Array<Shot>, appIsSplit = true) => {
  const log: Array<string> = []
  const d: SplitDeps = {
    appIsSplit: async () => Promise.resolve(appIsSplit),
    find: {
      blue: s => (['home', 'kb-left'].includes(nameOf(s)) ? SAFARI : undefined),
      divider: s => ['kb-left', 'safari-left'].includes(nameOf(s)),
      icon: s => ({'home': KEYBASE, 'kb-left': KEYBASE_HALF, 'safari-left': KEYBASE_HALF})[nameOf(s) as string] as Point | undefined,
      row: (s, at, layout, before) => {
        log.push(`row ${nameOf(s)} ${layout} after ${nameOf(before)}`)
        if (nameOf(s) === 'kb-menu' && at === KEYBASE) return {x: 620, y: 372}
        if (nameOf(s) === 'safari-menu' && at === SAFARI) return {x: 678, y: 330}
        return undefined
      },
    },
    launch: id => log.push(`launch ${id}`),
    screenshot: async () => Promise.resolve(img(shots.shift() ?? 'blank')),
    sleep: async () => {},
    terminate: id => log.push(`terminate ${id}`),
    touch: points => log.push(`touch ${points.map(p => `${p.x},${p.y}+${p.ms}`).join(' ')}`),
  }
  return {d, log}
}

test('left: long-press Keybase, Open in Split View, then Safari on the right half', async () => {
  const {d, log} = fake(['home', 'kb-menu', 'kb-left'])
  await enterSplit('left', d)
  assert.deepEqual(log.filter(l => l.startsWith('touch')), [
    'touch 764,182+0 764,182+1000',
    'touch 620,372+0 620,372+80',
    'touch 903,351+0 903,351+80',
  ])
  assert.ok(log.includes('row kb-menu after-remove after home'))
})

test('right: long-press Safari, its first row, then Keybase on the right half', async () => {
  const {d, log} = fake(['home', 'safari-menu', 'safari-left'])
  await enterSplit('right', d)
  assert.deepEqual(log.filter(l => l.startsWith('touch')), [
    'touch 903,351+0 903,351+1000',
    'touch 678,330+0 678,330+80',
    'touch 806,182+0 806,182+80',
  ])
})

test('no Home Screen: stops before any touch', async () => {
  const {d, log} = fake(['blank'])
  await assert.rejects(enterSplit('left', d), /does not show the Keybase icon; nothing more was touched/)
  assert.equal(log.filter(l => l.startsWith('touch')).length, 0)
})

test('no menu row: stops after the long-press, touching nothing more', async () => {
  const {d, log} = fake(['home', 'blank'])
  await assert.rejects(enterSplit('left', d), /no "Open in Split View" in the Keybase icon menu/)
  assert.equal(log.filter(l => l.startsWith('touch')).length, 1)
})

test('the app not on the left half: stops before picking the second app', async () => {
  const {d, log} = fake(['home', 'kb-menu', 'home'])
  await assert.rejects(enterSplit('left', d), /did not take the left half/)
  assert.equal(log.filter(l => l.startsWith('touch')).length, 2)
})

test('the app not split at the end is a failure', async () => {
  const {d} = fake(['home', 'kb-menu', 'kb-left'], false)
  await assert.rejects(enterSplit('left', d), /not in Split View after the setup/)
})

test('parseAnyPosture takes the four postures', () => {
  for (const p of ['folded', 'unfolded', 'split-left', 'split-right']) assert.equal(parseAnyPosture(p), p)
  assert.equal(parseAnyPosture(undefined), undefined)
  assert.throws(() => parseAnyPosture('split'), /split-left or split-right/)
})
