/// <reference types="jest" />
import {expect, test} from '@jest/globals'
import type * as T from '@/constants/types'
import {getPinnedConvIDs, pinToTop, pruneToLayout, unpin} from './pinned-convs'

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

test('pruneToLayout keeps only ids the layout marks pinned', () => {
  const rows = [
    {convID: 'a', isPinned: true},
    {convID: 'b', isPinned: false},
  ] as unknown as ReadonlyArray<T.RPCChat.UIInboxSmallTeamRow>
  expect(pruneToLayout(['gone', 'b', 'a'], rows)).toEqual(['a'])
  expect(pruneToLayout(['a'], undefined)).toEqual(['a'])
})
