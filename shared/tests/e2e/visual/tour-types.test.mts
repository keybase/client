/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {fixtureOrderProblems, validateEntry, matchEntries, popupFollowerProblems, type TourEntry} from './tour-types.ts'
import * as T from '../shared/test-ids.ts'

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
test('a window entry is desktop only, navigates nowhere and leaves no popup', () => {
  const window = {component: 'menubar', size: {height: 640, width: 360}} as const
  assert.deepEqual(validateEntry({...base, window}), [])
  assert.match(validateEntry({...base, platforms: ['desktop', 'phone'], window}).join(), /desktop only/)
  assert.match(validateEntry({...base, nav: {append: {name: 'x'}, tab: 't'}, window}).join(), /only resets the main window/)
  assert.match(validateEntry({...base, leavesPopup: true, window}).join(), /leaves no popup open/)
  assert.match(validateEntry({...base, window: {...window, size: {height: 0, width: 360}}}).join(), /size must be positive/)
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
const at = (id: string, tab: string, thread?: string, extra: Partial<TourEntry> = {}): TourEntry => ({
  ...base,
  id,
  nav: thread ? {tab, thread: {channel: thread, ref: 'conversationIDKey'}} : {tab},
  ...extra,
})
test('a popup entry needs a desktop follower on its tab; on chat, another conversation', () => {
  const menu = at('team/menu', 'tabs.teamsTab', undefined, {leavesPopup: true})
  assert.deepEqual(popupFollowerProblems([menu, at('team/x', 'tabs.teamsTab')]), [])
  assert.match(popupFollowerProblems([menu, at('tab/git', 'tabs.gitTab')]).join(), /resets tabs.gitTab/)
  // a phone-only entry in between is not captured on desktop
  const phone = at('team/p', 'tabs.gitTab', undefined, {platforms: ['phone']})
  assert.deepEqual(popupFollowerProblems([menu, phone, at('team/x', 'tabs.teamsTab')]), [])
  // the last entry is followed by the first
  assert.deepEqual(popupFollowerProblems([at('team/x', 'tabs.teamsTab'), menu]), [])
  const msg = at('chat/menu', 'tabs.chatTab', 'a', {leavesPopup: true})
  assert.deepEqual(popupFollowerProblems([msg, at('chat/b', 'tabs.chatTab', 'b')]), [])
  assert.match(popupFollowerProblems([msg, at('chat/a', 'tabs.chatTab', 'a')]).join(), /no other conversation/)
  assert.match(popupFollowerProblems([msg, at('chat/root', 'tabs.chatTab')]).join(), /no other conversation/)
  assert.match(popupFollowerProblems([msg]).join(), /no desktop entry follows/)
})
test('every popup entry in the real tour is followed by an entry that closes it', async () => {
  const {tour} = await import('./tour.ts')
  assert.ok(tour.some(e => e.leavesPopup), 'the tour has popup entries')
  assert.deepEqual(popupFollowerProblems(tour), [])
})
test('a fixture entry names a known fixture, waits on a ready only its state shows and has no masks', () => {
  const fx: TourEntry = {...base, fixture: {name: 'people-follow-suggestions'}, ready: T.PEOPLE_FOLLOW_SUGGESTION}
  assert.deepEqual(validateEntry(fx), [])
  assert.match(validateEntry({...fx, fixture: {name: 'nope'}}).join(), /unknown fixture nope/)
  // the suggestions' container shows with no suggestions in it
  assert.match(validateEntry({...fx, ready: T.PEOPLE_FOLLOW_SUGGESTIONS}).join(), /not a testID only fixture people-follow-suggestions/)
  assert.match(validateEntry({...fx, masks: [{reason: 'r', testID: 'a'}]}).join(), /has no masks/)
  assert.match(validateEntry({...fx, window: {component: 'menubar', size: {height: 1, width: 1}}}).join(), /runs no fixture/)
})
test('fixture entries come after every live entry, per platform', () => {
  const fx = (id: string, platforms: TourEntry['platforms']): TourEntry => ({...base, fixture: {name: 'featured-bots'}, id, platforms})
  const live = (id: string, platforms: TourEntry['platforms']): TourEntry => ({...base, id, platforms})
  assert.deepEqual(fixtureOrderProblems([live('a', ['desktop', 'phone']), fx('f', ['desktop', 'phone'])]), [])
  // a phone-only live entry after a desktop-only fixture entry is fine
  assert.deepEqual(fixtureOrderProblems([fx('f', ['desktop']), live('p', ['phone'])]), [])
  assert.deepEqual(fixtureOrderProblems([fx('f', ['desktop', 'phone']), live('a', ['phone'])]), [
    'a (phone): a live entry after the fixture entry f',
  ])
})
test('the real tour runs its fixture entries last', async () => {
  const {tour} = await import('./tour.ts')
  assert.ok(tour.some(e => e.fixture), 'the tour has fixture entries')
  assert.deepEqual(fixtureOrderProblems(tour), [])
})
