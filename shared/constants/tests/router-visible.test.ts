/// <reference types="jest" />
import {getVisiblePath, getVisibleScreen, setModalRouteNames} from '../router'

// Mirror what router-v2 does at startup: register the modal route names so the router
// can tell real modals from genuinely-visible pushed screens (e.g. chatConversation).
beforeEach(() => {
  setModalRouteNames(['chatInfoPanel'])
})

// On phones, chatConversation lives in the root stack as a sibling of the tab
// navigator (above the tab bar), not inside a tab. getSelectedConversation calls
// getVisibleScreen with includeModals=false, so the visible path must still surface
// chatConversation even though it sits at routes[1+] alongside real modals.
const makePhoneNavState = (extraRootRoutes: ReadonlyArray<{name: string; params?: object}> = []) =>
  ({
    index: extraRootRoutes.length ? 1 : 0,
    key: 'root',
    type: 'stack',
    routes: [
      {
        key: 'loggedIn',
        name: 'loggedIn',
        state: {
          index: 0,
          key: 'tabs',
          type: 'tab',
          routes: [
            {
              key: 'chatTab',
              name: 'tabs.chatTab',
              state: {
                index: 0,
                key: 'chatStack',
                type: 'stack',
                routes: [{key: 'chatRoot', name: 'chatRoot'}],
              },
            },
          ],
        },
      },
      ...extraRootRoutes.map((r, i) => ({key: `extra-${i}`, name: r.name, params: r.params})),
    ],
  }) as any

test('getVisibleScreen with includeModals=false surfaces chatConversation in the phone root stack', () => {
  const navState = makePhoneNavState([{name: 'chatConversation', params: {conversationIDKey: 'CONV'}}])

  const visible = getVisibleScreen(navState, false)

  expect(visible?.name).toBe('chatConversation')
  expect((visible?.params as {conversationIDKey?: string} | undefined)?.conversationIDKey).toBe('CONV')
})

test('getVisiblePath with includeModals=false includes chatConversation but excludes real modals', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV'}},
    {name: 'chatInfoPanel'},
  ])

  const path = getVisiblePath(navState, false).map(r => r.name)

  expect(path).toContain('chatConversation')
  expect(path).not.toContain('chatInfoPanel')
})

test('getVisibleScreen returns the topmost convo when multiple are pushed', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV1'}},
    {name: 'chatConversation', params: {conversationIDKey: 'CONV2'}},
  ])

  const visible = getVisibleScreen(navState, false)

  expect(visible?.name).toBe('chatConversation')
  expect((visible?.params as {conversationIDKey?: string} | undefined)?.conversationIDKey).toBe('CONV2')
})

test('getVisibleScreen(false) still surfaces the convo under a modal', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV'}},
    {name: 'chatInfoPanel'},
  ])

  // includeModals=false ignores the modal layered on top and reports the convo,
  // matching desktop where the conversation lives in the base (non-modal) layer.
  expect(getVisibleScreen(navState, false)?.name).toBe('chatConversation')
  expect(getVisibleScreen(navState, true)?.name).toBe('chatInfoPanel')
})

test('getVisiblePath with includeModals=true includes real modals', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV'}},
    {name: 'chatInfoPanel'},
  ])

  const path = getVisiblePath(navState, true).map(r => r.name)

  expect(path).toContain('chatConversation')
  expect(path).toContain('chatInfoPanel')
})
