/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render} from '@testing-library/react'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import type {EmojiData} from '@/common-adapters/emoji'
import type {ListHandle} from './common'
import {List} from './emoji'

// a team's custom :smile: alongside the stock one
const mockUserEmojis = (): Array<T.RPCChat.Emoji> => [
  {
    alias: 'smile',
    creationInfo: null,
    isAlias: false,
    isBig: false,
    isCrossTeam: false,
    isReacji: false,
    noAnimSource: {httpsrv: 'https://testuser.example/smile.png', typ: T.RPCChat.EmojiLoadSourceTyp.httpsrv},
    remoteSource: {typ: T.RPCChat.EmojiRemoteSourceTyp.message} as T.RPCChat.EmojiRemoteSource,
    source: {httpsrv: 'https://testuser.example/smile.png', typ: T.RPCChat.EmojiLoadSourceTyp.httpsrv},
    teamname: 'testteam',
  },
]
type MockSuggestionListProps = {items: Array<EmojiData>; selectedIndex: number}
let mockListProps: MockSuggestionListProps | undefined
jest.mock('./suggestion-list', () => ({
  __esModule: true,
  default: (p: MockSuggestionListProps) => {
    mockListProps = p
    return null
  },
}))

afterEach(() => {
  cleanup()
  mockListProps = undefined
  resetAllStores()
})

test('two emoji with the same name do not trap the highlight', async () => {
  const fake = installFakeEngine()
  fake.answer('chat.1.local.userEmojis', () => ({
    emojis: {emojis: [{emojis: mockUserEmojis(), name: 'testteam'}]},
  }))
  let handle: ListHandle | undefined
  const onSelected = jest.fn((_e: EmojiData, _final: boolean) => {})
  render(
    <List
      conversationIDKey={T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))}
      filter="smile"
      listStyle={{}}
      spinnerStyle={{}}
      onSelected={onSelected}
      setListHandle={h => (handle = h)}
    />
  )
  // the team's emoji arrive from the service after the stock ones are already listed
  expect(mockListProps?.items.filter(e => e.short_name === 'smile')).toHaveLength(1)
  await flush()
  expect(fake.calls.map(c => c.method)).toEqual(['chat.1.local.userEmojis'])
  const names = mockListProps?.items.map(e => e.short_name) ?? []
  expect(names.filter(n => n === 'smile')).toHaveLength(2)

  const move = () => {
    act(() => handle?.move(false))
  }
  move()
  move()
  move()

  expect(mockListProps?.selectedIndex).toBe(3)
  expect(onSelected.mock.calls.map(c => c[0].short_name)).toEqual(names.slice(1, 4))
})
