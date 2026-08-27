/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {inboxSearchPreviewSectionSize, makeInboxSearchInfo} from '../inbox/use-inbox-search'

type CapturedSection = {
  data: ReadonlyArray<unknown>
  indexOffset: number
  isCollapsed: boolean
  onCollapse: () => void
  onSelect: (item: unknown, index: number) => void
  title: string
}

const mockSections: Array<Array<CapturedSection>> = []

// The real SectionList is react-native's, which the desktop test env stubs out.
// Standing in for it lets the container's section derivation run for real and
// hands us the sections it built.
jest.mock('@/common-adapters/section-list', () => ({
  __esModule: true,
  default: (p: {sections: Array<CapturedSection>}) => {
    mockSections.push(p.sections)
    return null
  },
}))

import InboxSearchContainer, {
  canonBotItem,
  canonNameResult,
  canonOpenTeamItem,
  canonTextResult,
  emptyUnreadPlaceholder,
} from './index'

const convKey = (s: string) => T.Chat.stringToConversationIDKey(s)

const nameHit = (id: string, over: Partial<T.Chat.InboxSearchConvHit> = {}): T.Chat.InboxSearchConvHit => ({
  conversationIDKey: convKey(id),
  name: 'testuser',
  teamType: 'small',
  ...over,
})

const textHit = (id: string, over: Partial<T.Chat.InboxSearchTextHit> = {}): T.Chat.InboxSearchTextHit => ({
  conversationIDKey: convKey(id),
  name: 'testuser',
  numHits: 2,
  query: 'needle',
  teamType: 'small',
  time: 1,
  ...over,
})

const openTeamHit = (name: string): T.Chat.InboxSearchOpenTeamHit => ({
  description: 'a team',
  inTeam: false,
  memberCount: 3,
  name,
  publicAdmins: [],
})

const bot = (botUsername: string) => ({botUsername}) as T.RPCGen.FeaturedBot

type Search = {
  searchInfo: T.Chat.InboxSearchInfo
  selectResult: jest.Mock
  setVisibleResultCounts: jest.Mock
}

const makeSearch = (over: Partial<T.Chat.InboxSearchInfo> = {}): Search => ({
  searchInfo: {...makeInboxSearchInfo(), ...over},
  selectResult: jest.fn(),
  setVisibleResultCounts: jest.fn(),
})

const renderSearch = (search: Search) => {
  mockSections.length = 0
  render(React.createElement(InboxSearchContainer as never, {search} as never))
  return {
    lastCounts: () => search.setVisibleResultCounts.mock.calls.at(-1)?.[0] as Record<string, number>,
    sections: () => mockSections.at(-1)!,
    section: (title: string) => mockSections.at(-1)!.find(s => s.title === title)!,
  }
}

afterEach(() => {
  cleanup()
  mockSections.length = 0
  resetAllStores()
})

describe('result canonicalization', () => {
  test('name results keep identity while their fields are unchanged', () => {
    const first = canonNameResult({conversationIDKey: convKey('a'), name: 'testuser', sizeType: 'small', type: 'name'})
    const again = canonNameResult({conversationIDKey: convKey('a'), name: 'testuser', sizeType: 'small', type: 'name'})
    expect(again).toBe(first)

    const renamed = canonNameResult({conversationIDKey: convKey('a'), name: 'testuser-mac', sizeType: 'small', type: 'name'})
    expect(renamed).not.toBe(first)
    expect(renamed.name).toBe('testuser-mac')

    const resized = canonNameResult({conversationIDKey: convKey('a'), name: 'testuser-mac', sizeType: 'big', type: 'name'})
    expect(resized).not.toBe(renamed)

    // the cache is keyed per conversation, so a sibling never aliases
    const other = canonNameResult({conversationIDKey: convKey('b'), name: 'testuser-mac', sizeType: 'big', type: 'name'})
    expect(other).not.toBe(resized)
  })

  test('text results re-canonicalize when hit count or query moves', () => {
    const base = {conversationIDKey: convKey('a'), name: 'testuser', numHits: 2, query: 'needle', sizeType: 'small', type: 'text'} as const
    const first = canonTextResult({...base})
    expect(canonTextResult({...base})).toBe(first)

    const moreHits = canonTextResult({...base, numHits: 3})
    expect(moreHits).not.toBe(first)
    expect(canonTextResult({...base, numHits: 3})).toBe(moreHits)

    const newQuery = canonTextResult({...base, numHits: 3, query: 'haystack'})
    expect(newQuery).not.toBe(moreHits)
  })

  test('name and text caches are independent and survive an external reset by clearing', () => {
    const name = canonNameResult({conversationIDKey: convKey('a'), name: 'testuser', sizeType: 'small', type: 'name'})
    const text = canonTextResult({conversationIDKey: convKey('a'), name: 'testuser', numHits: 1, query: 'q', sizeType: 'small', type: 'text'})
    expect(text).not.toBe(name)

    resetAllStores()

    expect(canonNameResult({conversationIDKey: convKey('a'), name: 'testuser', sizeType: 'small', type: 'name'})).not.toBe(name)
    expect(canonTextResult({conversationIDKey: convKey('a'), name: 'testuser', numHits: 1, query: 'q', sizeType: 'small', type: 'text'})).not.toBe(text)
  })

  test('open team and bot items key off the hit object identity', () => {
    const hit = openTeamHit('keybasefriends')
    const item = canonOpenTeamItem(hit)
    expect(item).toBe(canonOpenTeamItem(hit))
    expect(item.type).toBe('openTeam')
    expect(item.hit).toBe(hit)
    expect(canonOpenTeamItem(openTeamHit('keybasefriends'))).not.toBe(item)

    const b = bot('testuser')
    const botItem = canonBotItem(b)
    expect(botItem).toBe(canonBotItem(b))
    expect(botItem.type).toBe('bot')
    expect(botItem.bot).toBe(b)
    expect(canonBotItem(bot('testuser'))).not.toBe(botItem)
  })
})

describe('section derivation', () => {
  test('empty search still yields the four sections in order with no data', () => {
    const search = makeSearch()
    const {sections, lastCounts} = renderSearch(search)
    expect(sections().map(s => s.title)).toEqual(['Chats', 'Open teams', 'Featured bots', 'Messages'])
    expect(sections().map(s => s.data.length)).toEqual([0, 0, 0, 0])
    expect(sections().map(s => s.indexOffset)).toEqual([0, 0, 0, 0])
    expect(lastCounts()).toEqual({bots: 0, names: 0, openTeams: 0, text: 0})
  })

  test('index offsets accumulate names, then open teams, then bots', () => {
    const search = makeSearch({
      botsResults: [bot('bot1'), bot('bot2')],
      nameResults: [nameHit('a'), nameHit('b'), nameHit('c')],
      openTeamsResults: [openTeamHit('t1')],
      textResults: [textHit('d')],
    })
    const {sections} = renderSearch(search)
    expect(sections().map(s => [s.title, s.indexOffset, s.data.length])).toEqual([
      ['Chats', 0, 3],
      ['Open teams', 3, 1],
      ['Featured bots', 4, 2],
      ['Messages', 6, 1],
    ])
  })

  test('open teams and bots are trimmed to the preview size', () => {
    const many = ['t1', 't2', 't3', 't4', 't5'].map(openTeamHit)
    const search = makeSearch({
      botsResults: ['b1', 'b2', 'b3', 'b4'].map(bot),
      openTeamsResults: many,
      textResults: [textHit('d')],
    })
    const {section, lastCounts} = renderSearch(search)
    expect(inboxSearchPreviewSectionSize).toBe(3)
    expect(section('Open teams').data.length).toBe(inboxSearchPreviewSectionSize)
    expect(section('Featured bots').data.length).toBe(inboxSearchPreviewSectionSize)
    // trimmed lengths, not the raw result lengths, drive the offsets
    expect(section('Featured bots').indexOffset).toBe(3)
    expect(section('Messages').indexOffset).toBe(6)
    expect(lastCounts()).toEqual({bots: 3, names: 0, openTeams: 3, text: 1})
  })

  test('suggested results relabel the open team and bot headers', () => {
    const search = makeSearch({
      botsResults: [bot('b1')],
      botsResultsSuggested: true,
      openTeamsResults: [openTeamHit('t1')],
      openTeamsResultsSuggested: true,
    })
    const {sections} = renderSearch(search)
    expect(sections().map(s => s.title)).toEqual([
      'Chats',
      'Suggested teams',
      'Suggested bots',
      'Messages',
    ])
  })

  test('unread mode swaps in a placeholder row and drops the messages section', () => {
    const search = makeSearch({nameResultsUnread: true, textResults: [textHit('d')]})
    const {sections, lastCounts} = renderSearch(search)
    expect(sections().map(s => s.title)).toEqual(['Unread', 'Open teams', 'Featured bots'])
    expect(sections()[0]!.data).toEqual([emptyUnreadPlaceholder])
    expect(lastCounts()).toEqual({bots: 0, names: 1, openTeams: 0, text: 0})
  })

  test('unread mode with real name hits shows them instead of the placeholder', () => {
    const search = makeSearch({nameResults: [nameHit('a'), nameHit('b')], nameResultsUnread: true})
    const {sections, lastCounts} = renderSearch(search)
    expect(sections()[0]!.title).toBe('Unread')
    expect(sections()[0]!.data.length).toBe(2)
    expect(sections()[0]!.data).not.toContain(emptyUnreadPlaceholder)
    expect(lastCounts()).toEqual({bots: 0, names: 2, openTeams: 0, text: 0})
  })

  test('name results are handed to the section as canonical items', () => {
    const hits = [nameHit('a', {teamType: 'big'})]
    const search = makeSearch({nameResults: hits})
    const {section} = renderSearch(search)
    expect(section('Chats').data[0]).toBe(
      canonNameResult({conversationIDKey: convKey('a'), name: 'testuser', sizeType: 'big', type: 'name'})
    )
  })
})

describe('collapsing', () => {
  test('collapsing chats empties the section and shifts every later offset', () => {
    const search = makeSearch({
      botsResults: [bot('b1')],
      nameResults: [nameHit('a'), nameHit('b')],
      openTeamsResults: [openTeamHit('t1')],
      textResults: [textHit('d')],
    })
    const {section, sections, lastCounts} = renderSearch(search)
    expect(section('Chats').isCollapsed).toBe(false)
    expect(section('Messages').indexOffset).toBe(4)

    act(() => section('Chats').onCollapse())

    expect(section('Chats').isCollapsed).toBe(true)
    expect(section('Chats').data.length).toBe(0)
    expect(sections().map(s => s.indexOffset)).toEqual([0, 0, 1, 2])
    expect(lastCounts()).toEqual({bots: 1, names: 0, openTeams: 1, text: 1})
  })

  test('collapsing messages zeroes the text count but leaves earlier offsets alone', () => {
    const search = makeSearch({nameResults: [nameHit('a')], textResults: [textHit('d'), textHit('e')]})
    const {section, lastCounts} = renderSearch(search)
    expect(lastCounts()).toEqual({bots: 0, names: 1, openTeams: 0, text: 2})

    act(() => section('Messages').onCollapse())

    expect(section('Messages').data.length).toBe(0)
    expect(section('Messages').indexOffset).toBe(1)
    expect(lastCounts()).toEqual({bots: 0, names: 1, openTeams: 0, text: 0})
  })

  test('collapsing open teams and bots removes them from the running offset', () => {
    const search = makeSearch({
      botsResults: [bot('b1'), bot('b2')],
      nameResults: [nameHit('a')],
      openTeamsResults: [openTeamHit('t1'), openTeamHit('t2')],
      textResults: [textHit('d')],
    })
    const {section, lastCounts} = renderSearch(search)
    act(() => section('Open teams').onCollapse())
    expect(section('Featured bots').indexOffset).toBe(1)
    expect(section('Messages').indexOffset).toBe(3)

    act(() => section('Featured bots').onCollapse())
    expect(section('Messages').indexOffset).toBe(1)
    expect(lastCounts()).toEqual({bots: 0, names: 1, openTeams: 0, text: 1})
  })
})

describe('selection', () => {
  test('picking a name hit selects it with no query', () => {
    const search = makeSearch({nameResults: [nameHit('a'), nameHit('b')]})
    const {section} = renderSearch(search)
    const item = section('Chats').data[1]
    act(() => section('Chats').onSelect(item, 1))
    expect(search.selectResult).toHaveBeenCalledWith(convKey('b'), undefined, 1)
  })

  test('picking a text hit carries its query and real index', () => {
    const search = makeSearch({nameResults: [nameHit('a')], textResults: [textHit('d', {query: 'needle'})]})
    const {section} = renderSearch(search)
    const realIndex = section('Messages').indexOffset
    act(() => section('Messages').onSelect(section('Messages').data[0], realIndex))
    expect(search.selectResult).toHaveBeenCalledWith(convKey('d'), 'needle', 1)
  })

  test('a text hit with an empty query passes undefined instead', () => {
    const search = makeSearch({textResults: [textHit('d', {query: ''})]})
    const {section} = renderSearch(search)
    act(() => section('Messages').onSelect(section('Messages').data[0], 0))
    expect(search.selectResult).toHaveBeenCalledWith(convKey('d'), undefined, 0)
  })

  test('sections ignore items of the wrong kind', () => {
    const search = makeSearch({nameResults: [nameHit('a')], textResults: [textHit('d')]})
    const {section} = renderSearch(search)
    act(() => section('Chats').onSelect(section('Messages').data[0], 0))
    act(() => section('Messages').onSelect(section('Chats').data[0], 0))
    expect(search.selectResult).not.toHaveBeenCalled()
  })
})
