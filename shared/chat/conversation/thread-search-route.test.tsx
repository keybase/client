/** @jest-environment jsdom */
/// <reference types="jest" />
// The hooks run as a route of the real navigation tree, so the route and params are the library's.
import {act, cleanup, renderHook} from '@testing-library/react'
import * as C from '@/constants'
import {navigationWrapper} from '@/test/navigation'
import {useChatThreadRouteParams, useThreadSearchRoute} from './thread-search-route'

const renderAs = <R,>(hook: () => R, route: string, params?: unknown) =>
  renderHook(hook, {wrapper: navigationWrapper({params: params as object | undefined, route}).wrapper})
const params = (route: string, p?: unknown) => renderAs(useChatThreadRouteParams, route, p).result.current
const search = (route: string, p?: unknown) => renderAs(useThreadSearchRoute, route, p).result.current

afterEach(cleanup)

test('only the chat routes carry thread params', () => {
  const threadSearch = {query: 'hello'}
  expect(params('chatConversation', {threadSearch})?.threadSearch).toEqual(threadSearch)
  cleanup()
  expect(params('chatRoot', {threadSearch})?.threadSearch).toEqual(threadSearch)
  cleanup()
  expect(params('peopleRoot', {threadSearch})).toBeUndefined()
})

test('unrelated params on a chat route are ignored', () => {
  expect(params('chatConversation', {conversationIDKey: 'conv1'})).toBeUndefined()
})

test('missing or non object params are ignored', () => {
  expect(params('chatConversation')).toBeUndefined()
  cleanup()
  expect(params('chatConversation', 'nope')).toBeUndefined()
})

test('any of the recognized keys makes the params usable', () => {
  // hasOwnProperty, not truthiness: an explicitly undefined key still claims the params
  const got = params('chatConversation', {createConversationError: undefined})
  expect(got).toBeDefined()
  expect(Object.prototype.hasOwnProperty.call(got, 'createConversationError')).toBe(true)
})

test('the thread search shortcut only reads the search slice', () => {
  expect(search('chatConversation', {createConversationError: undefined})).toBeUndefined()
  cleanup()
  expect(search('chatConversation', {threadSearch: {query: 'hello'}})).toEqual({query: 'hello'})
})

test('a param change on the route reaches the hook', () => {
  const {result} = renderAs(useThreadSearchRoute, 'chatRoot', {conversationIDKey: 'conv1'})
  expect(result.current).toBeUndefined()
  act(() => {
    C.Router2.setChatRootParams({threadSearch: {query: 'later'}})
  })
  expect(result.current).toEqual({query: 'later'})
})
