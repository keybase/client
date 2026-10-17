/// <reference types="jest" />
import {addDomain, emptyUnfurlListEdits, nextLists, removeAddedDomain, type UnfurlListEdits} from './unfurl-lists'

const saved = {blocklist: ['x.com'], whitelist: ['a.com', 'b.com']}

test('adding a domain to the block list moves it off the saved allow list', () => {
  const edits = addDomain(emptyUnfurlListEdits, 'block', 'b.com')
  expect(nextLists(saved, edits)).toEqual({blocklist: ['b.com', 'x.com'], whitelist: ['a.com']})
})

test('adding a domain to the allow list moves it off the saved block list', () => {
  const edits = addDomain(emptyUnfurlListEdits, 'allow', 'x.com')
  expect(nextLists(saved, edits)).toEqual({blocklist: [], whitelist: ['a.com', 'b.com', 'x.com']})
})

test('adding a domain to one list drops it from the other list pending adds', () => {
  const edits = addDomain(addDomain(emptyUnfurlListEdits, 'allow', 'c.com'), 'block', 'c.com')
  expect(nextLists(saved, edits)).toEqual({blocklist: ['c.com', 'x.com'], whitelist: ['a.com', 'b.com']})
})

test('removing a saved domain drops it', () => {
  const edits: UnfurlListEdits = {...emptyUnfurlListEdits, removed: new Set(['a.com', 'x.com'])}
  expect(nextLists(saved, edits)).toEqual({blocklist: [], whitelist: ['b.com']})
})

test('re-adding a removed domain keeps it', () => {
  const removed: UnfurlListEdits = {...emptyUnfurlListEdits, removed: new Set(['a.com'])}
  const edits = addDomain(removed, 'allow', 'a.com')
  expect(edits.removed.has('a.com')).toBe(false)
  expect(nextLists(saved, edits).whitelist).toEqual(['a.com', 'b.com'])
})

test('empty or whitespace input changes nothing', () => {
  expect(addDomain(emptyUnfurlListEdits, 'allow', '')).toBe(emptyUnfurlListEdits)
  expect(addDomain(emptyUnfurlListEdits, 'block', '   ')).toBe(emptyUnfurlListEdits)
})

test('input is trimmed and lowercased', () => {
  const edits = addDomain(emptyUnfurlListEdits, 'allow', '  Example.COM ')
  expect(edits.added.allow).toEqual(['example.com'])
})

test('duplicate add appears once', () => {
  const edits = addDomain(addDomain(emptyUnfurlListEdits, 'allow', 'c.com'), 'allow', 'C.com')
  expect(edits.added.allow).toEqual(['c.com'])
  expect(nextLists(saved, edits).whitelist).toEqual(['a.com', 'b.com', 'c.com'])
})

test('adding an already saved domain is not a pending edit', () => {
  const edits = addDomain(emptyUnfurlListEdits, 'allow', 'a.com', saved.whitelist)
  expect(edits.added.allow).toEqual([])
  expect(nextLists(saved, edits).whitelist).toEqual(['a.com', 'b.com'])
})

test('adding an already saved domain restores it if it was removed', () => {
  const removed: UnfurlListEdits = {...emptyUnfurlListEdits, removed: new Set(['a.com'])}
  const edits = addDomain(removed, 'allow', 'a.com', saved.whitelist)
  expect(edits.removed.has('a.com')).toBe(false)
  expect(nextLists(saved, edits).whitelist).toEqual(['a.com', 'b.com'])
})

test('removeAddedDomain drops a pending add only', () => {
  const edits = addDomain(addDomain(emptyUnfurlListEdits, 'allow', 'c.com'), 'block', 'd.com')
  const next = removeAddedDomain(edits, 'allow', 'c.com')
  expect(next.added).toEqual({allow: [], block: ['d.com']})
})
