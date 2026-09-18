/// <reference types="jest" />
import {expect, test} from '@jest/globals'
import type * as T from '@/constants/types'
import {getPinnedConvIDs, maxPinnedConvs, nextPinnedList, pinToTop, pruneToLayout, unpin} from './pinned-convs'

const enc = (s: string) => new TextEncoder().encode(s)
const item = (category: string, body: string) =>
  ({item: {body: enc(body), category}}) as unknown as {item: T.RPCGen.Gregor1.Item}

test('getPinnedConvIDs reads the category and ignores junk', () => {
  expect(getPinnedConvIDs(undefined)).toEqual([])
  expect(getPinnedConvIDs([item('other', '["a"]')])).toEqual([])
  expect(getPinnedConvIDs([item('chatPinnedConvs', 'nope')])).toEqual([])
  expect(getPinnedConvIDs([item('chatPinnedConvs', '["a",1,"b"]')])).toEqual(['a', 'b'])
})

test('pinToTop prepends and moves existing', () => {
  expect(pinToTop([], 'a')).toEqual(['a'])
  expect(pinToTop(['b', 'c'], 'a')).toEqual(['a', 'b', 'c'])
  expect(pinToTop(['b', 'a', 'c'], 'a')).toEqual(['a', 'b', 'c'])
})

test('unpin removes', () => {
  expect(unpin(['a', 'b'], 'a')).toEqual(['b'])
  expect(unpin(['b'], 'a')).toEqual(['b'])
})

test('pruneToLayout keeps ids present as any row in the layout', () => {
  const rows = [
    {convID: 'a', isPinned: true},
    {convID: 'b', isPinned: false},
  ] as unknown as ReadonlyArray<T.RPCChat.UIInboxSmallTeamRow>
  expect(pruneToLayout(['gone', 'b', 'a'], rows)).toEqual(['b', 'a'])
  expect(pruneToLayout(['a'], undefined)).toEqual(['a'])
  expect(pruneToLayout(['a'], null)).toEqual(['a'])
})

test('nextPinnedList refuses a new pin at the limit but allows reorder and unpin', () => {
  const full = Array.from({length: maxPinnedConvs}, (_, i) => `c${i}`)
  expect(nextPinnedList(full, 'new', true)).toBeUndefined()
  expect(nextPinnedList(full, 'c5', true)?.[0]).toBe('c5')
  expect(nextPinnedList(full, 'c5', false)).toHaveLength(maxPinnedConvs - 1)
  expect(nextPinnedList(full.slice(1), 'new', true)?.[0]).toBe('new')
})
