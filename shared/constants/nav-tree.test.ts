/// <reference types="jest" />
import * as Tabs from '@/constants/tabs'
import {
  activeStack,
  currentTab,
  isLoggedIn,
  isModalKeyUp,
  isModalUp,
  modalStack,
  modalState,
  previousRouteIsModal,
  pushedAboveTabs,
  setModalRouteNames,
  tabNavigatorState,
  tabState,
  topModalKey,
  upToScreenTarget,
  visiblePath,
  visibleScreen,
} from './nav-tree'

// Mirror what router-v2 does at startup: register the modal route names so the tree
// can tell real modals from genuinely-visible pushed screens (e.g. chatConversation).
beforeEach(() => {
  setModalRouteNames(['chatInfoPanel'])
})

// Module-level state — clear it so it can't leak into other tests in this worker.
afterEach(() => {
  setModalRouteNames([])
})

// On phones, chatConversation lives in the root stack as a sibling of the tab
// navigator (above the tab bar), not inside a tab. getSelectedConversation calls
// visibleScreen with includeModals=false, so the visible path must still surface
// chatConversation even though it sits at routes[1+] alongside real modals.
const makePhoneNavState = (extraRootRoutes: ReadonlyArray<{name: string; params?: object}> = []) =>
  ({
    index: extraRootRoutes.length,
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

test('visibleScreen with includeModals=false surfaces chatConversation in the phone root stack', () => {
  const navState = makePhoneNavState([{name: 'chatConversation', params: {conversationIDKey: 'CONV'}}])

  const visible = visibleScreen(navState, {includeModals: false})

  expect(visible?.name).toBe('chatConversation')
  expect((visible?.params as {conversationIDKey?: string} | undefined)?.conversationIDKey).toBe('CONV')
})

test('visiblePath with includeModals=false includes chatConversation but excludes real modals', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV'}},
    {name: 'chatInfoPanel'},
  ])

  const path = visiblePath(navState, {includeModals: false}).map(r => r.name)

  expect(path).toContain('chatConversation')
  expect(path).not.toContain('chatInfoPanel')
})

test('visibleScreen returns the topmost convo when multiple are pushed', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV1'}},
    {name: 'chatConversation', params: {conversationIDKey: 'CONV2'}},
  ])

  const visible = visibleScreen(navState, {includeModals: false})

  expect(visible?.name).toBe('chatConversation')
  expect((visible?.params as {conversationIDKey?: string} | undefined)?.conversationIDKey).toBe('CONV2')
})

test('visibleScreen(includeModals=false) still surfaces the convo under a modal', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV'}},
    {name: 'chatInfoPanel'},
  ])

  // includeModals=false ignores the modal layered on top and reports the convo,
  // matching desktop where the conversation lives in the base (non-modal) layer.
  expect(visibleScreen(navState, {includeModals: false})?.name).toBe('chatConversation')
  expect(visibleScreen(navState)?.name).toBe('chatInfoPanel')
})

test('visiblePath defaults to including real modals', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV'}},
    {name: 'chatInfoPanel'},
  ])

  const path = visiblePath(navState).map(r => r.name)

  expect(path).toContain('chatConversation')
  expect(path).toContain('chatInfoPanel')
})

test('visiblePath of an empty state is empty', () => {
  expect(visiblePath(undefined)).toEqual([])
})

// ---- currentTab / isLoggedIn / modalStack ----

test('currentTab reads the selected tab, and is undefined when logged out', () => {
  expect(currentTab(makePhoneNavState())).toBe(Tabs.chatTab)
  expect(currentTab({index: 0, routes: [{key: 'l', name: 'loggedOut'}]} as any)).toBeUndefined()
  expect(currentTab(undefined)).toBeUndefined()
})

test('isLoggedIn is true only when the tab navigator is the root route', () => {
  expect(isLoggedIn(makePhoneNavState())).toBe(true)
  expect(isLoggedIn({index: 0, routes: [{key: 'l', name: 'loggedOut'}]} as any)).toBe(false)
  expect(isLoggedIn(undefined)).toBe(false)
})

test('modalStack holds only the registered modal names above the tab navigator', () => {
  const navState = makePhoneNavState([
    {name: 'chatConversation', params: {conversationIDKey: 'CONV'}},
    {name: 'chatInfoPanel'},
  ])

  expect(modalStack(navState).map(r => r.name)).toEqual(['chatInfoPanel'])
  expect(modalStack(makePhoneNavState())).toEqual([])
  expect(modalStack({index: 0, routes: [{key: 'l', name: 'loggedOut'}]} as any)).toEqual([])
})

// A team's delete confirm decides whether its delete still takes the user away when it returns.
test('isModalUp matches a modal by name and the params given', () => {
  setModalRouteNames(['chatInfoPanel', 'teamDeleteTeam'])
  const navState = makePhoneNavState([{name: 'team', params: {teamID: 'T1'}}, {name: 'teamDeleteTeam', params: {context: 'teams', teamID: 'T1'}}])

  expect(isModalUp(navState, 'teamDeleteTeam', {teamID: 'T1'})).toBe(true)
  expect(isModalUp(navState, 'teamDeleteTeam')).toBe(true)
  expect(isModalUp(navState, 'teamDeleteTeam', {teamID: 'T2'})).toBe(false)
  // a screen above the tabs that is not a modal
  expect(isModalUp(navState, 'team', {teamID: 'T1'})).toBe(false)
  expect(isModalUp(makePhoneNavState([{name: 'team', params: {teamID: 'T1'}}]), 'teamDeleteTeam', {teamID: 'T1'})).toBe(false)
  expect(isModalUp(undefined, 'teamDeleteTeam')).toBe(false)
})

// A bot popup's mutation closes only the popup instance it started from.
test('topModalKey names the topmost matching modal, and isModalKeyUp finds that instance', () => {
  setModalRouteNames(['chatInstallBot'])
  const navState = makePhoneNavState([
    {name: 'chatInstallBot', params: {botUsername: 'helperbot'}},
    {name: 'chatInstallBot', params: {botUsername: 'otherbot'}},
    {name: 'chatInstallBot', params: {botUsername: 'helperbot'}},
  ])

  expect(topModalKey(navState, 'chatInstallBot', {botUsername: 'helperbot'})).toBe('extra-2')
  expect(topModalKey(navState, 'chatInstallBot', {botUsername: 'nobot'})).toBeUndefined()
  expect(isModalKeyUp(navState, 'extra-0')).toBe(true)
  // the same bot's popup reopened gets a new key
  expect(isModalKeyUp(makePhoneNavState([{name: 'chatInstallBot', params: {botUsername: 'helperbot'}}]), 'extra-2')).toBe(false)
  expect(isModalKeyUp(navState, 'loggedIn')).toBe(false)
  expect(topModalKey(undefined, 'chatInstallBot')).toBeUndefined()
})

test('tabNavigatorState is the tab navigator, and nothing when logged out', () => {
  expect(tabNavigatorState(makePhoneNavState())?.key).toBe('tabs')
  expect(tabNavigatorState({index: 0, routes: [{key: 'l', name: 'loggedOut', state: {key: 'out'}}]} as any)).toBeUndefined()
  expect(tabNavigatorState(undefined)).toBeUndefined()
})

// ---- activeStack ----

test('activeStack descends to the stack inside the selected tab', () => {
  expect(activeStack(makePhoneNavState())?.key).toBe('chatStack')
})

// A non-modal screen pushed above the tab bar (the phone thread) is not a stack of its
// own, so pushes still target the selected tab's stack.
test('activeStack ignores non-modal screens pushed above the tabs', () => {
  const navState = makePhoneNavState([{name: 'chatConversation', params: {conversationIDKey: 'CONV'}}])

  expect(activeStack(navState)?.key).toBe('chatStack')
})

// A modal has no nested stack state of its own here, so the root stack is what a pop
// would act on.
test('activeStack stops at the root stack when a modal is on top', () => {
  const navState = makePhoneNavState([{name: 'chatInfoPanel'}])

  expect(activeStack(navState)?.key).toBe('root')
})

test('activeStack of an empty state is undefined', () => {
  expect(activeStack(undefined)).toBeUndefined()
  expect(activeStack({routes: []} as any)).toBeUndefined()
})

// ---- upToScreenTarget ----

// A phone's device page: the devices list and the page sit above the tab bar, over a Settings
// stack that holds only settingsRoot.
const phoneDevicePage = () =>
  makePhoneNavState([{name: 'settingsTabs.devicesTab'}, {name: 'devicePage', params: {deviceID: 'D'}}])

test('upToScreenTarget finds a screen above the tabs in the root stack', () => {
  const target = upToScreenTarget(phoneDevicePage(), 'settingsTabs.devicesTab')

  expect(target?.found?.stack.key).toBe('root')
  expect(target?.found?.index).toBe(1)
  expect(target?.closeAboveTabs).toBe(false)
})

test("upToScreenTarget finds a tab's root under screens above the tabs, which close first", () => {
  const target = upToScreenTarget(makePhoneNavState([{name: 'team'}]), 'chatRoot')

  expect(target?.found?.stack.key).toBe('chatStack')
  expect(target?.found?.index).toBe(0)
  expect(target?.closeAboveTabs).toBe(true)
})

test('upToScreenTarget with nothing above the tabs looks in the selected tab stack only', () => {
  const target = upToScreenTarget(makePhoneNavState(), 'chatRoot')

  expect(target).toEqual({closeAboveTabs: false, found: {index: 0, stack: activeStack(makePhoneNavState())}})
})

// The modal's own flow (a wizard going back to an earlier step of itself) stays in the active stack.
test('upToScreenTarget with a modal up looks in the active stack only', () => {
  const navState = makePhoneNavState([{name: 'team'}, {name: 'chatInfoPanel'}])

  expect(upToScreenTarget(navState, 'team')).toEqual({closeAboveTabs: false, found: {index: 1, stack: navState}})
  expect(upToScreenTarget(navState, 'chatRoot')).toBeUndefined()
  expect(upToScreenTarget(navState, 'teamsRoot')).toBeUndefined()
})

// A team page opened from the Chat tab: teamsRoot is in no stack a phone shows.
test("upToScreenTarget of another tab's root under screens above the tabs closes them", () => {
  expect(upToScreenTarget(makePhoneNavState([{name: 'team'}]), 'teamsRoot')).toEqual({closeAboveTabs: true})
})

test('upToScreenTarget of a screen nowhere on the way back is undefined', () => {
  expect(upToScreenTarget(phoneDevicePage(), 'teamMember')).toBeUndefined()
  expect(upToScreenTarget(makePhoneNavState(), 'teamsRoot')).toBeUndefined()
  expect(upToScreenTarget(undefined, 'chatRoot')).toBeUndefined()
})

// ---- builders ----

test('tabState selects a tab with no screens pushed inside it', () => {
  expect(tabState(Tabs.fsTab)).toEqual({
    index: 0,
    routes: [{name: 'loggedIn', state: {index: 0, routes: [{name: Tabs.fsTab}]}}],
  })
})

test('tabState pushes a screen stack inside the tab and selects its last entry', () => {
  expect(tabState(Tabs.peopleTab, [{name: 'peopleRoot'}, {name: 'profile', params: {username: 'testuser'}}])).toEqual(
    {
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
    }
  )
})

test('modalState without underTab leaves loggedIn on its initial tab', () => {
  expect(modalState('settingsPushPrompt')).toEqual({
    index: 1,
    routes: [{name: 'loggedIn'}, {name: 'settingsPushPrompt'}],
  })
})

test('modalState parks the requested tab beneath the modal and carries params', () => {
  expect(modalState('incomingShareNew', {selectedConversationIDKey: 'CONV'}, Tabs.chatTab)).toEqual({
    index: 1,
    routes: [
      {name: 'loggedIn', state: {index: 0, routes: [{name: Tabs.chatTab}]}},
      {name: 'incomingShareNew', params: {selectedConversationIDKey: 'CONV'}},
    ],
  })
})

// The phone shape: the tab navigator sits at routes[0] on the tab's own root screen, and
// the pushed screen covers it at routes[1]. Every index is spelled out - a tab navigator
// rehydrates a missing index to 0 while a stack rehydrates it to the last route, so
// leaving them off means the shape reads differently at different depths.
test('pushedAboveTabs puts the tab root under a screen pushed above the tab bar', () => {
  expect(pushedAboveTabs(Tabs.chatTab, {name: 'chatConversation', params: {conversationIDKey: 'CONV'}})).toEqual({
    index: 1,
    routes: [
      {
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [{name: Tabs.chatTab, state: {index: 0, routes: [{name: 'chatRoot'}]}}],
        },
      },
      {name: 'chatConversation', params: {conversationIDKey: 'CONV'}},
    ],
  })
})

test('pushedAboveTabs uses each tab own root screen', () => {
  expect(pushedAboveTabs(Tabs.fsTab, {name: 'fsBrowse', params: {path: '/keybase/private/testuser'}})).toEqual({
    index: 1,
    routes: [
      {
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [{name: Tabs.fsTab, state: {index: 0, routes: [{name: 'fsRoot'}]}}],
        },
      },
      {name: 'fsBrowse', params: {path: '/keybase/private/testuser'}},
    ],
  })
})

describe('previousRouteIsModal', () => {
  const state = {
    routes: [
      {key: 'loggedIn', name: 'loggedIn'},
      {key: 'm1', name: 'chatInfoPanel'},
      {key: 'm2', name: 'chatInfoPanel'},
    ],
  }
  test('the first modal over the app has nothing to go back to', () => {
    expect(previousRouteIsModal(state, 'm1')).toBe(false)
  })
  test('a modal over another modal goes back to it', () => {
    expect(previousRouteIsModal(state, 'm2')).toBe(true)
  })
  test('a route over a non-modal screen, or not in the stack, does not', () => {
    const phone = {routes: [...state.routes.slice(0, 1), {key: 'c', name: 'chatConversation'}, {key: 'm', name: 'chatInfoPanel'}]}
    expect(previousRouteIsModal(phone, 'm')).toBe(false)
    expect(previousRouteIsModal(state, 'missing')).toBe(false)
    expect(previousRouteIsModal(undefined, 'm1')).toBe(false)
  })
})
