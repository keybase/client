/// <reference types="jest" />
import * as T from '@/constants/types'
import {addDomain, draftOf, hasEdits, removeDomain, unfurlSaveArgs} from './unfurl-lists'

const saved = {blocklist: ['x.com'], whitelist: ['a.com', 'b.com']}
const start = draftOf(saved)
const lists = (draft: ReturnType<typeof draftOf>) => {
  const {blocklist, whitelist} = unfurlSaveArgs(undefined, draft)
  return {blocklist, whitelist}
}

test('adding a domain to the block list moves it off the allow list', () => {
  expect(lists(addDomain(start, 'block', 'b.com'))).toEqual({blocklist: ['x.com', 'b.com'], whitelist: ['a.com']})
})

test('adding a domain to the allow list moves it off the block list', () => {
  expect(lists(addDomain(start, 'allow', 'x.com'))).toEqual({blocklist: [], whitelist: ['a.com', 'b.com', 'x.com']})
})

test('adding a domain to one list drops it from the other list pending adds', () => {
  const draft = addDomain(addDomain(start, 'allow', 'c.com'), 'block', 'c.com')
  expect(lists(draft)).toEqual({blocklist: ['x.com', 'c.com'], whitelist: ['a.com', 'b.com']})
})

test('removing a saved domain shows it as removed and drops it from the save', () => {
  const draft = removeDomain(removeDomain(start, saved, 'allow', 'a.com'), saved, 'block', 'x.com')
  expect(draft.whitelist).toEqual(['a.com', 'b.com'])
  expect([...draft.removed]).toEqual(['a.com', 'x.com'])
  expect(lists(draft)).toEqual({blocklist: [], whitelist: ['b.com']})
  expect(hasEdits(removeDomain(draft, saved, 'allow', 'a.com'), saved)).toBe(true)
  expect(hasEdits(removeDomain(removeDomain(draft, saved, 'allow', 'a.com'), saved, 'block', 'x.com'), saved)).toBe(
    false
  )
})

test('re-adding a removed domain restores it', () => {
  const draft = addDomain(removeDomain(start, saved, 'allow', 'a.com'), 'allow', 'a.com')
  expect(draft.removed.has('a.com')).toBe(false)
  expect(lists(draft).whitelist).toEqual(['a.com', 'b.com'])
  expect(hasEdits(draft, saved)).toBe(false)
})

test('empty or whitespace input changes nothing', () => {
  expect(addDomain(start, 'allow', '')).toBe(start)
  expect(addDomain(start, 'block', '   ')).toBe(start)
})

test('input is trimmed and lowercased, and a duplicate add appears once', () => {
  const draft = addDomain(addDomain(start, 'allow', '  Example.COM '), 'allow', 'example.com')
  expect(draft.whitelist).toEqual(['a.com', 'b.com', 'example.com'])
})

test('adding an already saved domain is not an edit', () => {
  expect(hasEdits(addDomain(start, 'allow', 'a.com'), saved)).toBe(false)
  expect(hasEdits(start, saved)).toBe(false)
})

test('removing a pending add drops it, and an add then remove is not an edit', () => {
  const draft = addDomain(addDomain(start, 'allow', 'c.com'), 'block', 'd.com')
  const next = removeDomain(draft, saved, 'allow', 'c.com')
  expect(lists(next)).toEqual({blocklist: ['x.com', 'd.com'], whitelist: ['a.com', 'b.com']})
  expect(hasEdits(removeDomain(next, saved, 'block', 'd.com'), saved)).toBe(false)
})

test('removing a pending move puts the domain back on its saved list', () => {
  const moved = addDomain(start, 'block', 'a.com')
  const back = removeDomain(moved, saved, 'block', 'a.com')
  expect(back.removed.size).toBe(0)
  expect(lists(back).blocklist).toEqual(['x.com'])
  expect([...lists(back).whitelist].sort()).toEqual(['a.com', 'b.com'])
  expect(hasEdits(back, saved)).toBe(false)
})

test('save keeps the selected mode, and defaults to Ask per domain', () => {
  expect(unfurlSaveArgs(T.RPCChat.UnfurlMode.always, start).mode).toBe(T.RPCChat.UnfurlMode.always)
  expect(unfurlSaveArgs(T.RPCChat.UnfurlMode.never, start).mode).toBe(T.RPCChat.UnfurlMode.never)
  expect(unfurlSaveArgs(undefined, addDomain(start, 'allow', 'c.com'))).toEqual({
    blocklist: ['x.com'],
    mode: T.RPCChat.UnfurlMode.whitelisted,
    whitelist: ['a.com', 'b.com', 'c.com'],
  })
})
