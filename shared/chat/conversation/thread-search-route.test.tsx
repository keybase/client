/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, renderHook} from '@testing-library/react'

let mockRoute: {name: string; params?: unknown} = {name: 'chatConversation', params: undefined}
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockRoute,
}))

import {useChatThreadRouteParams, useThreadSearchRoute} from './thread-search-route'

const params = () => renderHook(() => useChatThreadRouteParams()).result.current
const search = () => renderHook(() => useThreadSearchRoute()).result.current

afterEach(() => {
  cleanup()
  mockRoute = {name: 'chatConversation', params: undefined}
})

test('only the chat routes carry thread params', () => {
  const threadSearch = {query: 'hello'}
  mockRoute = {name: 'chatConversation', params: {threadSearch}}
  expect(params()?.threadSearch).toBe(threadSearch)
  mockRoute = {name: 'chatRoot', params: {threadSearch}}
  expect(params()?.threadSearch).toBe(threadSearch)
  mockRoute = {name: 'peopleRoot', params: {threadSearch}}
  expect(params()).toBeUndefined()
})

test('unrelated params on a chat route are ignored', () => {
  mockRoute = {name: 'chatConversation', params: {conversationIDKey: 'conv1'}}
  expect(params()).toBeUndefined()
})

test('missing or non object params are ignored', () => {
  mockRoute = {name: 'chatConversation', params: undefined}
  expect(params()).toBeUndefined()
  mockRoute = {name: 'chatConversation', params: 'nope'}
  expect(params()).toBeUndefined()
})

test('any of the recognized keys makes the params usable', () => {
  const highlightMessageID = T.Chat.numberToMessageID(4)
  mockRoute = {name: 'chatConversation', params: {highlightMessageID}}
  expect(params()?.highlightMessageID).toBe(highlightMessageID)

  // hasOwnProperty, not truthiness: an explicitly undefined key still claims the params
  const withError = {createConversationError: undefined}
  mockRoute = {name: 'chatConversation', params: withError}
  expect(params()).toBe(withError)
})

test('the thread search shortcut only reads the search slice', () => {
  mockRoute = {name: 'chatConversation', params: {highlightMessageID: T.Chat.numberToMessageID(4)}}
  expect(search()).toBeUndefined()
  mockRoute = {name: 'chatConversation', params: {threadSearch: {query: 'hello'}}}
  expect(search()).toEqual({query: 'hello'})
})
