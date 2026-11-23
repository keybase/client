/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {enterSplit, parseAnyPosture, postureFormFactor, postureOfFormFactor, type SplitDeps} from './split-view.mts'
import type {Img, Point} from './split-view-lib.mts'

// Screens are named; the finders read what each named screen shows
type Shot = 'home' | 'home-p1' | 'kb-menu' | 'safari-menu' | 'kb-left' | 'safari-left' | 'blank'
const img = (name: Shot) => ({data: Buffer.from(name), height: 1, width: 1}) as Img
const nameOf = (s: Img) => Buffer.from(s.data).toString() as Shot

const KEYBASE = {x: 764, y: 182}
const KEYBASE_HALF = {x: 806, y: 182}
const SAFARI = {x: 903, y: 351}

// `split`: what appIsSplit answers on each ask (the last one repeats)
const fake = (shots: Array<Shot>, split: boolean | Array<boolean> = true) => {
  const log: Array<string> = []
  const answers = Array.isArray(split) ? [...split] : [split]
  const d: SplitDeps = {
    appIsSplit: async () => Promise.resolve(answers.length > 1 ? answers.shift()! : answers[0]!),
    find: {
      blue: s => (['home', 'home-p1', 'kb-left'].includes(nameOf(s)) ? SAFARI : undefined),
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

test('left: long-press Keybase, Open in Split View, then Safari launched into the right half', async () => {
  const {d, log} = fake(['home', 'kb-menu', 'kb-left'])
  await enterSplit('left', d)
  assert.deepEqual(log.filter(l => l.startsWith('touch') || l.startsWith('launch')), [
    'touch 764,182+0 764,182+1000',
    'touch 620,372+0 620,372+80',
    'launch com.apple.mobilesafari',
  ])
  assert.ok(log.includes('row kb-menu after-remove after home'))
})

test('right: long-press Safari, its first row, then Keybase launched into the right half', async () => {
  const {d, log} = fake(['home', 'safari-menu', 'safari-left'])
  await enterSplit('right', d)
  assert.deepEqual(log.filter(l => l.startsWith('touch') || l.startsWith('launch')), [
    'touch 903,351+0 903,351+1000',
    'touch 678,330+0 678,330+80',
    'launch keybase.ios',
  ])
})

test('a split left over from an earlier run is waited out until the Home Screen shows whole', async () => {
  const {d, log} = fake(['kb-left', 'kb-left', 'home', 'kb-menu', 'kb-left'])
  await enterSplit('left', d)
  assert.equal(log.filter(l => l.startsWith('touch'))[0], 'touch 764,182+0 764,182+1000')
})

// after a restart the Home Screen shows its first page, and the Keybase icon is on another
test('a Home Screen page without the Keybase icon is swiped past, at most twice', async () => {
  const {d, log} = fake(['home-p1', 'home', 'kb-menu', 'kb-left'])
  await enterSplit('left', d)
  const touches = log.filter(l => l.startsWith('touch'))
  assert.equal(touches[0], 'touch 700,480+0 250,480+300')
  assert.equal(touches[1], 'touch 764,182+0 764,182+1000')
  const {d: d2, log: log2} = fake(Array<Shot>(6).fill('home-p1'))
  await assert.rejects(enterSplit('left', d2), /does not show the Keybase icon/)
  assert.equal(log2.filter(l => l.startsWith('touch')).length, 2)
})

test('no Home Screen: stops before any touch', async () => {
  const {d, log} = fake(Array<Shot>(5).fill('blank'))
  await assert.rejects(enterSplit('left', d), /does not show the Keybase icon; nothing more was touched/)
  assert.equal(log.filter(l => l.startsWith('touch')).length, 0)
})

test('no menu row: stops after the long-press, touching nothing more', async () => {
  const {d, log} = fake(['home', 'blank'])
  await assert.rejects(enterSplit('left', d), /no "Open in Split View" in the Keybase icon menu/)
  assert.equal(log.filter(l => l.startsWith('touch')).length, 1)
})

test('a split still animating in is waited for', async () => {
  const {d, log} = fake(['home', 'kb-menu', 'blank', 'blank', 'kb-left'])
  await enterSplit('left', d)
  assert.equal(log.filter(l => l.startsWith('launch')).length, 1)
})

test('the first app not on the left half: stops before launching the second', async () => {
  const {d, log} = fake(['home', 'kb-menu', 'home', 'home', 'home', 'home', 'home'])
  await assert.rejects(enterSplit('left', d), /did not take the left half/)
  assert.equal(log.filter(l => l.startsWith('touch')).length, 2)
  assert.equal(log.filter(l => l.startsWith('launch')).length, 0)
})

test('an app slow to load its bundle is waited for', async () => {
  const {d} = fake(['home', 'safari-menu', 'safari-left'], [false, false, false, true])
  await enterSplit('right', d)
})

test('the app not split within the wait is a failure', async () => {
  const {d} = fake(['home', 'kb-menu', 'kb-left'], false)
  await assert.rejects(enterSplit('left', d), /not in Split View after the setup/)
})

test('parseAnyPosture takes the four postures', () => {
  for (const p of ['folded', 'unfolded', 'split-left', 'split-right']) assert.equal(parseAnyPosture(p), p)
  assert.equal(parseAnyPosture(undefined), undefined)
  assert.throws(() => parseAnyPosture('split'), /split-left or split-right/)
})

// WDA's launch folds the Duo, so a posture is applied after the session opens, and a run's form factor
// comes from the posture it asked for
test('postureFormFactor and postureOfFormFactor map the four postures both ways', () => {
  for (const [p, f] of [['folded', 'duo-folded'], ['unfolded', 'duo-unfolded'], ['split-left', 'duo-split-left'], ['split-right', 'duo-split-right']] as const) {
    assert.equal(postureFormFactor(p), f)
    assert.equal(postureOfFormFactor(f), p)
  }
  assert.equal(postureOfFormFactor('iphone'), undefined)
})
