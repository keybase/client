/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render} from '@testing-library/react'
import * as T from '@/constants/types'
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
jest.mock('@/chat/user-emoji', () => ({
  useUserEmoji: () => ({emojis: mockUserEmojis(), loading: false}),
}))
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
})

test('two emoji with the same name do not trap the highlight', () => {
  let handle: ListHandle | undefined
  const onSelected = jest.fn()
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
  const names = mockListProps?.items.map(e => e.short_name) ?? []
  expect(names.filter(n => n === 'smile')).toHaveLength(2)

  const move = () => {
    act(() => handle?.move(false))
  }
  move()
  move()
  move()

  expect(mockListProps?.selectedIndex).toBe(3)
  expect(onSelected.mock.calls.map(c => (c[0] as EmojiData).short_name)).toEqual(names.slice(1, 4))
})
