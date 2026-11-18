/** @jest-environment jsdom */
/// <reference types="jest" />
// An iPhone whose chat splits by window width (an iPhone Duo folding and unfolding), on the phone
// tree: the open thread moves between chatConversation above the tabs and chatRoot's param.
import type * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {moveOpenThreadToLayout} from '@/constants/router'
import {installNavigation, makeRootState, rendersUntil, type MountedNavigation} from '@/test/navigation'

let nav: MountedNavigation

type Spec = {name: string; params?: object}

const showing = (p: {tabStack?: Array<Spec>; above?: Array<Spec>}) => {
  nav = installNavigation({layout: 'phone', rootState: makeRootState({...p, tab: Tabs.chatTab})})
}

const convID = 'ff00ff00' as T.Chat.ConversationIDKey
const threadSearch = {query: 'hello'}
const visible = () => nav.visibleScreen()
const rootNames = () => nav.getRootState()?.routes?.map(r => r.name)

test('narrowing pushes the selected thread above the tabs, search and all', () => {
  showing({tabStack: [{name: 'chatRoot', params: {conversationIDKey: convID, threadSearch}}]})

  moveOpenThreadToLayout(false)

  expect(rootNames()).toEqual(['loggedIn', 'chatConversation'])
  expect(visible()).toMatchObject({name: 'chatConversation', params: {conversationIDKey: convID, threadSearch}})
})

test('narrowing with no thread selected leaves the inbox showing', () => {
  showing({tabStack: [{name: 'chatRoot'}]})

  moveOpenThreadToLayout(false)

  expect(nav.types()).toEqual([])
  expect(visible()?.name).toBe('chatRoot')
})

test('narrowing under a modal leaves the modal up', () => {
  showing({
    above: [{name: 'chatNewChat'}],
    tabStack: [{name: 'chatRoot', params: {conversationIDKey: convID}}],
  })

  moveOpenThreadToLayout(false)

  expect(nav.types()).toEqual([])
  expect(visible()?.name).toBe('chatNewChat')
})

test('splitting moves the pushed thread into the chat root, search and all', async () => {
  showing({above: [{name: 'chatConversation', params: {conversationIDKey: convID, threadSearch}}]})

  moveOpenThreadToLayout(true)
  // the chat tab under the pushed thread reports its state once the pop renders
  await rendersUntil(() => visible()?.name === 'chatRoot')

  expect(rootNames()).toEqual(['loggedIn'])
  expect(visible()).toMatchObject({name: 'chatRoot', params: {conversationIDKey: convID, threadSearch}})
})

test('splitting leaves a thread with another screen pushed over it alone', () => {
  showing({
    above: [
      {name: 'chatConversation', params: {conversationIDKey: convID}},
      {name: 'profile', params: {username: 'testuser'}},
    ],
  })

  moveOpenThreadToLayout(true)

  expect(nav.types()).toEqual([])
  expect(rootNames()).toEqual(['loggedIn', 'chatConversation', 'profile'])
})

test('splitting on the inbox changes nothing', () => {
  showing({})

  moveOpenThreadToLayout(true)

  expect(nav.types()).toEqual([])
  expect(visible()?.name).toBe('chatRoot')
})

test('narrowing with the info panel beside the thread pushes the thread and its panel', () => {
  showing({tabStack: [{name: 'chatRoot', params: {conversationIDKey: convID, infoPanel: {tab: 'bots'}}}]})

  moveOpenThreadToLayout(false)

  expect(rootNames()).toEqual(['loggedIn', 'chatConversation', 'chatInfoPanel'])
  expect(visible()).toMatchObject({name: 'chatInfoPanel', params: {conversationIDKey: convID, tab: 'bots'}})
})

test('splitting with the info panel over the thread puts both in the chat root', async () => {
  showing({
    above: [
      {name: 'chatConversation', params: {conversationIDKey: convID}},
      {name: 'chatInfoPanel', params: {conversationIDKey: convID, tab: 'attachments'}},
    ],
  })

  moveOpenThreadToLayout(true)
  await rendersUntil(() => visible()?.name === 'chatRoot')

  expect(rootNames()).toEqual(['loggedIn'])
  expect(visible()).toMatchObject({
    name: 'chatRoot',
    params: {conversationIDKey: convID, infoPanel: {tab: 'attachments'}},
  })
})

test('a fold and unfold round trip keeps the thread and its panel', async () => {
  showing({tabStack: [{name: 'chatRoot', params: {conversationIDKey: convID, infoPanel: {tab: 'members'}}}]})

  moveOpenThreadToLayout(false)
  moveOpenThreadToLayout(true)
  await rendersUntil(() => visible()?.name === 'chatRoot')

  expect(rootNames()).toEqual(['loggedIn'])
  expect(visible()).toMatchObject({
    name: 'chatRoot',
    params: {conversationIDKey: convID, infoPanel: {tab: 'members'}},
  })
})

test('splitting after the panel was closed leaves it closed', async () => {
  showing({
    above: [{name: 'chatConversation', params: {conversationIDKey: convID}}],
    tabStack: [{name: 'chatRoot', params: {conversationIDKey: convID, infoPanel: {tab: 'members'}}}],
  })

  moveOpenThreadToLayout(true)
  await rendersUntil(() => visible()?.name === 'chatRoot')

  expect((visible()?.params as {infoPanel?: unknown}).infoPanel).toBeUndefined()
})
