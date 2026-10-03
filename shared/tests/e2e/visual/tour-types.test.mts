/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validateEntry, matchEntries, type TourEntry} from './tour-types.ts'

const base: TourEntry = {
  id: 'settings/advanced',
  nav: {tab: 'tabs.settingsTab'},
  platforms: ['desktop'],
  ready: 'x',
  seal: [],
}

test('unknown setup kind is refused', () => {
  const bad = {...base, setup: [{kind: 'click', testID: 'save'}]} as unknown as TourEntry
  assert.match(validateEntry(bad).join(), /setup step 'click' is not allowed/)
})
test('hover on phone is refused', () => {
  const bad: TourEntry = {...base, platforms: ['phone'], setup: [{kind: 'hover', testID: 'a'}]}
  assert.match(validateEntry(bad).join(), /hover is desktop only/)
})
test('mask without reason is refused', () => {
  const bad = {...base, masks: [{testID: 'a', reason: ''}]}
  assert.match(validateEntry(bad).join(), /mask a needs a reason/)
})
test('glob matching', () => {
  const es = [base, {...base, id: 'settings/chat'}, {...base, id: 'teams/root'}]
  assert.deepEqual(
    matchEntries(es, 'settings/*').map(e => e.id),
    ['settings/advanced', 'settings/chat']
  )
  assert.deepEqual(
    matchEntries(es, 'teams/root').map(e => e.id),
    ['teams/root']
  )
  assert.deepEqual(matchEntries(es, 'nope'), [])
})
test('every entry in the real tour validates and ids are unique', async () => {
  const {tour} = await import('./tour.ts')
  const ids = new Set<string>()
  for (const e of tour) {
    assert.deepEqual(validateEntry(e), [], e.id)
    assert.ok(!ids.has(e.id), `duplicate ${e.id}`)
    ids.add(e.id)
  }
})
