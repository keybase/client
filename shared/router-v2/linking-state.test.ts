/// <reference types="jest" />
import * as Tabs from '@/constants/tabs'
import {createLinkingConfig, isHandledByLinkingConfig, makeChatConversationState} from './linking'

// isSplit is true in this (desktop) test environment, so the split-view shapes are the
// ones exercised here.
const getStateFromPath = (path: string) => {
  const config = createLinkingConfig(jest.fn())
  return (config.getStateFromPath as unknown as (p: string, o?: object) => unknown)(path)
}

test('an unknown path produces no navigation state', () => {
  expect(getStateFromPath('nope/whatever')).toBeUndefined()
  expect(getStateFromPath('')).toBeUndefined()
  expect(getStateFromPath('/')).toBeUndefined()
})

test('a conversation path parks the conversation in the chat tab', () => {
  expect(getStateFromPath('convid/conv-1')).toEqual(makeChatConversationState('conv-1'))
  expect(makeChatConversationState('conv-1')).toEqual({
    index: 0,
    routes: [
      {
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [
            {
              name: Tabs.chatTab,
              state: {index: 0, routes: [{name: 'chatRoot', params: {conversationIDKey: 'conv-1'}}]},
            },
          ],
        },
      },
    ],
  })
})

test('a conversation path without an id is not handled', () => {
  expect(getStateFromPath('convid')).toBeUndefined()
  expect(getStateFromPath('convid/')).toBeUndefined()
})

test('leading slashes and query strings are ignored', () => {
  expect(getStateFromPath('///convid/conv-1?foo=bar')).toEqual(makeChatConversationState('conv-1'))
})

test('a profile path pushes the profile above the people root', () => {
  expect(getStateFromPath('profile/show/testuser')).toEqual({
    index: 0,
    routes: [
      {
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [
            {
              name: Tabs.peopleTab,
              state: {
                index: 1,
                routes: [{name: 'peopleRoot'}, {name: 'profile', params: {username: 'testuser'}}],
              },
            },
          ],
        },
      },
    ],
  })
})

test('profile paths other than show fall through to imperative navigation', () => {
  expect(getStateFromPath('profile/new-proof/twitter')).toBeUndefined()
  expect(getStateFromPath('profile/show')).toBeUndefined()
})

test('kbfs paths open the folder in the files tab and are url-decoded', () => {
  expect(getStateFromPath('private/testuser%2Ctestuser-mac/some%20dir')).toEqual({
    index: 0,
    routes: [
      {
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [
            {
              name: Tabs.fsTab,
              state: {
                index: 1,
                routes: [
                  {name: 'fsRoot'},
                  {name: 'fsBrowse', params: {path: '/keybase/private/testuser,testuser-mac/some dir'}},
                ],
              },
            },
          ],
        },
      },
    ],
  })
})

test('public kbfs paths use the same shape', () => {
  const state = getStateFromPath('public/testuser') as {routes: Array<{state: {routes: Array<unknown>}}>}
  const tabRoute = state.routes[0]!.state.routes[0] as {name: string; state: {routes: Array<{params?: {path?: string}}>}}
  expect(tabRoute.name).toBe(Tabs.fsTab)
  expect(tabRoute.state.routes[1]?.params?.path).toBe('/keybase/public/testuser')
})

test('a malformed kbfs escape sequence is not handled', () => {
  expect(getStateFromPath('private/%E0%A4%A')).toBeUndefined()
})

test('an incoming share parks the chat tab under the share modal', () => {
  expect(getStateFromPath('incoming-share')).toEqual({
    index: 1,
    routes: [
      {name: 'loggedIn', state: {index: 0, routes: [{name: Tabs.chatTab}]}},
      {name: 'incomingShareNew'},
    ],
  })
})

test('an incoming share with a conversation preselects it', () => {
  expect(getStateFromPath('incoming-share/conv-1')).toEqual({
    index: 1,
    routes: [
      {name: 'loggedIn', state: {index: 0, routes: [{name: Tabs.chatTab}]}},
      {name: 'incomingShareNew', params: {selectedConversationIDKey: 'conv-1'}},
    ],
  })
})

test('the push prompt is a modal with no tab parked underneath', () => {
  expect(getStateFromPath('settingsPushPrompt')).toEqual({
    index: 1,
    routes: [{name: 'loggedIn'}, {name: 'settingsPushPrompt'}],
  })
})

test('every app tab name is a bare tab switch', () => {
  for (const tab of [
    Tabs.chatTab,
    Tabs.peopleTab,
    Tabs.teamsTab,
    Tabs.fsTab,
    Tabs.settingsTab,
    Tabs.cryptoTab,
    Tabs.devicesTab,
    Tabs.gitTab,
  ]) {
    expect(getStateFromPath(tab)).toEqual({
      index: 0,
      routes: [{name: 'loggedIn', state: {index: 0, routes: [{name: tab}]}}],
    })
  }
})

test('the login tab is not routable via a deep link', () => {
  expect(getStateFromPath(Tabs.loginTab)).toBeUndefined()
})

test('isHandledByLinkingConfig only accepts keybase urls it can build state for', () => {
  expect(isHandledByLinkingConfig('keybase://convid/conv-1')).toBe(true)
  expect(isHandledByLinkingConfig('keybase://profile/show/testuser')).toBe(true)
  // profile links still route imperatively, but the config can build their state
  expect(isHandledByLinkingConfig('keybase://team-page/keybase')).toBe(false)
  expect(isHandledByLinkingConfig('https://keybase.io/testuser')).toBe(false)
  expect(isHandledByLinkingConfig('keybase://')).toBe(false)
})
