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
test('a nav with both append and thread is refused', () => {
  const bad: TourEntry = {...base, nav: {append: {name: 'x'}, tab: 't', thread: {ref: 'conversationIDKey'}}}
  assert.match(validateEntry(bad).join(), /both append and thread/)
})
test('a thread that is not a conversation is refused', () => {
  const bad: TourEntry = {...base, nav: {tab: 't', thread: {ref: 'teamID'}}}
  assert.match(validateEntry(bad).join(), /conversationIDKey ref/)
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
// An id may name one screen reached differently per platform (desktop's settings sub-tab, the
// phone's pushed page); captures are stored per platform.
test('every entry in the real tour validates and ids are unique per platform', async () => {
  const {tour} = await import('./tour.ts')
  const ids = new Set<string>()
  for (const e of tour) {
    assert.deepEqual(validateEntry(e), [], e.id)
    for (const p of e.platforms) {
      assert.ok(!ids.has(`${p}:${e.id}`), `duplicate ${e.id} on ${p}`)
      ids.add(`${p}:${e.id}`)
    }
  }
})
