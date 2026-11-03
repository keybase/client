/** @jest-environment jsdom */
/// <reference types="jest" />
// The Navigator's operations on the real React Navigation tree: what each dispatches, and where the
// library then has the app.
import logger from '@/logger'
import * as NavTree from '@/constants/nav-tree'
import * as Tabs from '@/constants/tabs'
import {CommonActions} from '@react-navigation/core'
import {
  clearModals,
  navUpToScreen,
  navigateAppend,
  navigateAppendOnceRootHas,
  navigateUp,
  popStack,
  setChatRootParams,
  switchTab,
  whenModalsGone,
} from '@/constants/router'
import {getNavigator, navigationRef} from '@/constants/navigator'
import {
  installNavigation,
  makeRootState,
  renders,
  rendersUntil,
  routeByKey,
  stackKeyOf,
  type MountedNavigation,
} from '@/test/navigation'

let nav: MountedNavigation

afterEach(() => {
  jest.restoreAllMocks()
})

// A screen covered from the first render (the tabs under a screen pushed above them) comes up a
// render after the screen on top, as it would have mounted before that screen was pushed.
const tabsUp = async () => rendersUntil(() => !!nav.getRootState()?.routes?.[0]?.state)

const visible = () => nav.visibleScreen()
const activeNames = () => NavTree.activeStack(nav.getRootState())?.routes?.map(r => r.name)
const rootNames = () => nav.getRootState()?.routes?.map(r => r.name)

describe('readiness', () => {
  test('before the container mounts nothing is dispatched and there is no root state', () => {
    nav = installNavigation({ready: false})

    navigateUp()
    popStack()
    expect(navigateAppend({name: 'profile', params: {username: 'testuser'}})).toBe(false)
    expect(getNavigator().showAboveTabs(Tabs.chatTab, {name: 'chatConversation'})).toBe(false)
    expect(getNavigator().pushInTab(Tabs.settingsTab, {name: 'settingsTabs.devicesTab'})).toBe(false)
    expect(getNavigator().setRouteParams('chatRoot-0', {conversationIDKey: 'C'})).toBe(false)

    expect(nav.actions).toEqual([])
    expect(nav.getRootState()).toBeUndefined()
  })

  test('once it has mounted both are served', () => {
    nav = installNavigation({ready: false})
    nav.mount()

    expect(navigateAppend({name: 'profile', params: {username: 'testuser'}})).toBe(true)

    expect(nav.types()).toEqual(['PUSH'])
    expect(visible()?.name).toBe('profile')
  })
})

// ---- navigateUp / popStack ----

describe('navigateUp and popStack', () => {
  test('go back and pop-to-top are dispatched at the root, untargeted', () => {
    nav = installNavigation({
      rootState: makeRootState({
        tabStack: [
          {name: 'chatRoot'},
          {name: 'profile', params: {username: 'testuser'}},
          {name: 'profile', params: {username: 'testuser-mac'}},
        ],
      }),
    })

    navigateUp()
    expect(visible()?.params).toEqual({username: 'testuser'})
    popStack()
    expect(visible()?.name).toBe('chatRoot')

    expect(nav.actions).toEqual([{type: 'GO_BACK'}, {type: 'POP_TO_TOP'}])
  })
})

// ---- navigateAppend ----

describe('navigateAppend', () => {
  beforeEach(() => {
    nav = installNavigation({
      rootState: makeRootState({tabStack: [{name: 'chatRoot'}, {name: 'profile', params: {username: 'testuser'}}]}),
    })
  })

  test('pushes a screen that is not already visible', () => {
    expect(navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})).toBe(true)

    expect(nav.pushes()).toEqual([{name: 'profile', params: {username: 'testuser-mac'}}])
    expect(activeNames()).toEqual(['chatRoot', 'profile', 'profile'])
    expect(visible()?.params).toEqual({username: 'testuser-mac'})
  })

  // The caller's goal - "that screen with those params is what the user is looking at" -
  // is already met, so this reports success without a second identical screen.
  test('is a no-op when the target is already the visible route with the same params', () => {
    expect(navigateAppend({name: 'profile', params: {username: 'testuser'}})).toBe(true)

    expect(nav.actions).toEqual([])
  })

  test('replace retargets the visible screen in place when the name matches', () => {
    const key = visible()?.key
    expect(navigateAppend({name: 'profile', params: {username: 'testuser-mac'}}, true)).toBe(true)

    expect(nav.lastAction()?.type).toBe('SET_PARAMS')
    expect(visible()).toMatchObject({key, params: {username: 'testuser-mac'}})
    expect(activeNames()).toEqual(['chatRoot', 'profile'])
  })

  test('replace swaps the screen when the visible one is a different route', () => {
    expect(navigateAppend({name: 'team', params: {teamID: 'T1'}}, true)).toBe(true)

    expect(nav.lastAction()?.type).toBe('REPLACE')
    expect(activeNames()).toEqual(['chatRoot', 'team'])
    expect(visible()?.params).toEqual({teamID: 'T1'})
  })

  // A janky JS thread can queue two taps back to back. The library has the first push in
  // getRootState() as soon as its dispatch returns, so the visible-route check sees it.
  test('a second identical push straight after the first is dropped', () => {
    expect(navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})).toBe(true)
    expect(navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})).toBe(true)

    expect(nav.pushes()).toHaveLength(1)
    expect(activeNames()).toEqual(['chatRoot', 'profile', 'profile'])
  })

  test('and so is one after the first has rendered', async () => {
    navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})
    await renders()
    navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})

    expect(nav.pushes()).toHaveLength(1)
  })

  test('a different push straight after still goes through', () => {
    navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})
    navigateAppend({name: 'profile', params: {username: 'testuser-a'}})

    expect(nav.pushes()).toHaveLength(2)
    expect(visible()?.params).toEqual({username: 'testuser-a'})
  })

  test('the same push goes through again once the user has left that screen', () => {
    navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})
    navigateUp()
    navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})

    expect(nav.pushes()).toHaveLength(2)
    expect(visible()?.params).toEqual({username: 'testuser-mac'})
  })

  // navigateToThread's params carry undefined-valued keys; dropping them would make the
  // visible-route dupe check miss on key count and push a second screen.
  test('the library keeps undefined-valued param keys, so a repeat push is still a dupe', async () => {
    navigateAppend({name: 'profile', params: {extra: undefined, username: 'testuser-mac'}} as never)
    await renders()
    navigateAppend({name: 'profile', params: {extra: undefined, username: 'testuser-mac'}} as never)

    expect(nav.pushes()).toHaveLength(1)
  })

  // Modals are registered only on the root stack, so the library hands a push of one from inside
  // a tab up to the root, where clearModals finds it.
  test('a modal pushed from a tab lands in the root stack', () => {
    navigateAppend({name: 'chatInfoPanel', params: {}} as never)

    expect(NavTree.modalStack(nav.getRootState()).map(r => r.name)).toEqual(['chatInfoPanel'])
    clearModals()
    expect(NavTree.modalStack(nav.getRootState())).toEqual([])
    expect(activeNames()).toEqual(['chatRoot', 'profile'])
  })
})

// ---- navUpToScreen ----

describe('navUpToScreen', () => {
  const stack = [{name: 'teamsRoot'}, {name: 'team', params: {teamID: 'T1'}}, {name: 'teamChannel'}]

  beforeEach(() => {
    nav = installNavigation({rootState: makeRootState({tab: Tabs.teamsTab, tabStack: stack})})
  })

  test('a bare route name pops the active stack back to it', () => {
    const target = stackKeyOf('teamsRoot')
    navUpToScreen('teamsRoot')

    expect(nav.lastAction()).toMatchObject({payload: {name: 'teamsRoot'}, target, type: 'POP_TO'})
    expect(activeNames()).toEqual(['teamsRoot'])
  })

  // A path carries params, and popTo cannot set them, so the stack is rebuilt in place:
  // truncated at the target with the new params written onto it.
  test('a path already in the stack resets the stack onto it with the new params', () => {
    const target = stackKeyOf('teamsRoot')
    navUpToScreen({name: 'team', params: {teamID: 'T2'}})

    expect(nav.lastAction()).toMatchObject({target, type: 'RESET'})
    expect(activeNames()).toEqual(['teamsRoot', 'team'])
    expect(visible()?.params).toEqual({teamID: 'T2'})
  })

  test('a path that is not in the stack is put in place of the current screen when asked', () => {
    navUpToScreen({name: 'teamMember', params: {teamID: 'T1', username: 'testuser'}}, true)

    expect(nav.lastAction()).toMatchObject({target: stackKeyOf('teamsRoot'), type: 'REPLACE'})
    expect(activeNames()).toEqual(['teamsRoot', 'team', 'teamMember'])
    expect(visible()?.params).toEqual({teamID: 'T1', username: 'testuser'})
  })

  test("a path that is not in the stack pops towards it otherwise, which takes the current screen's place", () => {
    navUpToScreen({name: 'teamMember', params: {teamID: 'T1', username: 'testuser'}})

    expect(nav.lastAction()).toMatchObject({payload: {name: 'teamMember'}, type: 'POP_TO'})
    expect(activeNames()).toEqual(['teamsRoot', 'team', 'teamMember'])
  })

  test('before the container mounts it dispatches nothing', () => {
    nav = installNavigation({ready: false})
    navUpToScreen('teamsRoot')

    expect(nav.actions).toEqual([])
  })
})

// On a phone a tab's stack holds only its root screen; every other screen is pushed into the root
// stack above the tab bar.
describe('navUpToScreen on a phone', () => {
  test('after a modal closes, goes back to a screen above the tabs in the root stack', () => {
    nav = installNavigation({
      layout: 'phone',
      rootState: makeRootState({
        above: [{name: 'settingsTabs.devicesTab'}, {name: 'devicePage'}, {name: 'deviceRevoke'}],
        tab: Tabs.settingsTab,
      }),
    })
    const root = nav.getRootState()?.key

    clearModals()
    navUpToScreen('settingsTabs.devicesTab')

    expect(nav.lastAction()).toMatchObject({payload: {name: 'settingsTabs.devicesTab'}, target: root, type: 'POP_TO'})
    expect(rootNames()).toEqual(['loggedIn', 'settingsTabs.devicesTab'])
  })

  test("after a modal closes, going back to a tab's root closes the screens above the tabs", async () => {
    nav = installNavigation({
      layout: 'phone',
      rootState: makeRootState({
        above: [{name: 'team', params: {teamID: 'T1'}}, {name: 'teamReallyLeaveTeam'}],
        tab: Tabs.teamsTab,
      }),
    })
    await tabsUp()
    const root = nav.getRootState()?.key

    clearModals()
    nav.clearActions()
    navUpToScreen('teamsRoot')

    expect(nav.actions).toMatchObject([
      {payload: {name: 'loggedIn'}, target: root, type: 'POP_TO'},
      {payload: {name: 'teamsRoot'}, target: stackKeyOf('teamsRoot'), type: 'POP_TO'},
    ])
    expect(NavTree.visiblePath(nav.getRootState()).map(r => r.name)).toEqual(['loggedIn', Tabs.teamsTab, 'teamsRoot'])
  })

  // A team page opened from the Chat tab, then left: teamsRoot is in no stack a phone shows.
  test("going back to another tab's root closes the screens above the tabs and stops there", async () => {
    nav = installNavigation({
      layout: 'phone',
      rootState: makeRootState({above: [{name: 'team', params: {teamID: 'T1'}}], tab: Tabs.chatTab}),
    })
    await tabsUp()
    const root = nav.getRootState()?.key

    navUpToScreen('teamsRoot')

    expect(nav.actions).toMatchObject([{payload: {name: 'loggedIn'}, target: root, type: 'POP_TO'}])
    expect(NavTree.visiblePath(nav.getRootState()).map(r => r.name)).toEqual(['loggedIn', Tabs.chatTab, 'chatRoot'])
  })

  test('a path in the root stack resets the root stack onto it with the new params', () => {
    nav = installNavigation({
      layout: 'phone',
      rootState: makeRootState({
        above: [{name: 'team', params: {teamID: 'T1'}}, {name: 'teamChannel'}],
        tab: Tabs.teamsTab,
      }),
    })
    const root = nav.getRootState()?.key

    navUpToScreen({name: 'team', params: {teamID: 'T2'}})

    expect(nav.lastAction()).toMatchObject({target: root, type: 'RESET'})
    expect(rootNames()).toEqual(['loggedIn', 'team'])
    expect(visible()).toMatchObject({name: 'team', params: {teamID: 'T2'}})
  })

  // A modal's own flow going back to an earlier step of itself, with a screen above the tabs under it.
  test('with a modal up, only the root stack the modal is in is looked in', () => {
    nav = installNavigation({
      layout: 'phone',
      rootState: makeRootState({
        above: [{name: 'team'}, {name: 'teamAddToTeamFromWhere'}, {name: 'teamAddToTeamConfirm'}],
        tab: Tabs.teamsTab,
      }),
    })
    const root = nav.getRootState()?.key

    navUpToScreen({name: 'teamAddToTeamFromWhere', params: {wizard: 'W'}} as never, true)

    expect(nav.actions).toHaveLength(1)
    expect(nav.lastAction()).toMatchObject({target: root, type: 'RESET'})
    expect(rootNames()).toEqual(['loggedIn', 'team', 'teamAddToTeamFromWhere'])
    expect(visible()).toMatchObject({name: 'teamAddToTeamFromWhere', params: {wizard: 'W'}})
  })
})

// ---- clearModals ----

describe('clearModals', () => {
  test('drops the modals and keeps the tab navigator and non-modal pushed screens', () => {
    nav = installNavigation({
      layout: 'phone',
      rootState: makeRootState({
        above: [{name: 'chatConversation', params: {conversationIDKey: 'CONV'}}, {name: 'chatInfoPanel'}],
      }),
    })
    const root = nav.getRootState()?.key

    clearModals()

    expect(nav.lastAction()).toMatchObject({target: root, type: 'RESET'})
    expect(rootNames()).toEqual(['loggedIn', 'chatConversation'])
    expect(visible()).toMatchObject({name: 'chatConversation', params: {conversationIDKey: 'CONV'}})
  })

  test('dispatches nothing when there is no modal to clear', () => {
    nav = installNavigation()

    clearModals()

    expect(nav.actions).toEqual([])
  })

  // Modals are registered only while logged in, but some logged-out screens share a modal's name.
  // clearModals only ever acts on the logged-in root.
  test('dispatches nothing when logged out, even on a screen with a modal name', () => {
    nav = installNavigation({rootState: makeRootState({above: [{name: 'username'}], loggedIn: false})})
    const before = nav.getRootState()

    clearModals()

    expect(nav.actions).toEqual([])
    expect(nav.getRootState()).toEqual(before)
  })
})

// ---- setChatRootParams ----

describe('setChatRootParams', () => {
  test('merges into the live chatRoot in place when it is already showing', () => {
    nav = installNavigation({
      rootState: makeRootState({tabStack: [{name: 'chatRoot', params: {conversationIDKey: 'OLD'}}]}),
    })
    const key = visible()?.key

    expect(setChatRootParams({conversationIDKey: 'NEW' as never})).toBe(true)

    // in place, targeting the chat tab's own stack - not a reset of the tab navigator
    expect(nav.lastAction()).toMatchObject({target: stackKeyOf('chatRoot'), type: 'NAVIGATE'})
    expect(visible()).toMatchObject({key, name: 'chatRoot', params: {conversationIDKey: 'NEW'}})
  })

  test('dispatches nothing when chatRoot already carries those params', () => {
    nav = installNavigation({
      rootState: makeRootState({tabStack: [{name: 'chatRoot', params: {conversationIDKey: 'SAME'}}]}),
    })

    expect(setChatRootParams({conversationIDKey: 'SAME' as never})).toBe(true)
    expect(nav.actions).toEqual([])
  })

  // Something else is on top of the chat stack, so the tab navigator is reset back onto a
  // chatRoot carrying the merged params.
  test('resets the tab navigator when chatRoot is not the current screen', () => {
    nav = installNavigation({
      rootState: makeRootState({
        tabStack: [{name: 'chatRoot', params: {conversationIDKey: 'OLD'}}, {name: 'profile', params: {username: 'testuser'}}],
      }),
    })
    const tabs = NavTree.tabNavigatorState(nav.getRootState())?.key

    expect(setChatRootParams({conversationIDKey: 'NEW' as never})).toBe(true)

    expect(nav.lastAction()).toMatchObject({target: tabs, type: 'RESET'})
    expect(activeNames()).toEqual(['chatRoot'])
    expect(visible()?.params).toEqual({conversationIDKey: 'NEW'})
  })

  // A mounted stack's state is taken as given, keys included; a keyless chatRoot made React warn on
  // every render of the stack, and a new key would remount the chat root.
  test('the reset keeps the chat root keyed as it was, so it is not remounted', () => {
    nav = installNavigation({
      rootState: makeRootState({
        tabStack: [{name: 'chatRoot', params: {conversationIDKey: 'OLD'}}, {name: 'profile', params: {username: 'testuser'}}],
      }),
    })
    const before = NavTree.activeStack(nav.getRootState())?.routes?.[0]?.key
    expect(before).toBeTruthy()

    setChatRootParams({conversationIDKey: 'NEW' as never})

    expect(NavTree.activeStack(nav.getRootState())?.routes?.[0]?.key).toBe(before)
  })

  // The tab navigator always holds every tab, so the chat tab is there to select from another tab.
  // Its stack had never mounted: the library shows it in getRootState() once React has rendered it.
  test('from another tab, selects the chat tab onto a chatRoot carrying the params', async () => {
    nav = installNavigation({rootState: makeRootState({tab: Tabs.teamsTab})})

    expect(setChatRootParams({conversationIDKey: 'NEW' as never})).toBe(true)

    expect(NavTree.currentTab(nav.getRootState())).toBe(Tabs.chatTab)
    await rendersUntil(() => visible()?.name === 'chatRoot')
    expect(visible()).toMatchObject({name: 'chatRoot', params: {conversationIDKey: 'NEW'}})
  })

  test('reports failure when logged out', () => {
    nav = installNavigation({rootState: makeRootState({loggedIn: false})})

    expect(setChatRootParams({conversationIDKey: 'NEW' as never})).toBe(false)
    expect(nav.actions).toEqual([])
  })
})

// ---- switchTab ----

describe('switchTab', () => {
  test('jumps within the tab navigator, not the root stack', async () => {
    nav = installNavigation()
    const tabs = NavTree.tabNavigatorState(nav.getRootState())?.key

    switchTab(Tabs.teamsTab)

    expect(nav.lastAction()).toMatchObject({payload: {name: Tabs.teamsTab}, target: tabs, type: 'JUMP_TO'})
    expect(NavTree.currentTab(nav.getRootState())).toBe(Tabs.teamsTab)
    // a tab's stack is in the tree once it has mounted
    await rendersUntil(() => visible()?.name === 'teamsRoot')
    expect(visible()?.name).toBe('teamsRoot')
  })

  test('dispatches nothing when logged out', () => {
    nav = installNavigation({rootState: makeRootState({loggedIn: false})})

    switchTab(Tabs.teamsTab)

    expect(nav.actions).toEqual([])
  })
})

// ---- showAboveTabs / setRouteParams ----

describe('showAboveTabs', () => {
  // The reset rebuilds the tab navigator, which is in getRootState() again once it has rendered; the
  // screen above the tabs is there at once.
  test('resets the root onto the tab and pushes the screen above the tab bar', async () => {
    nav = installNavigation({layout: 'phone', rootState: makeRootState({tab: Tabs.teamsTab})})
    const root = nav.getRootState()?.key

    expect(
      getNavigator().showAboveTabs(Tabs.chatTab, {name: 'chatConversation', params: {conversationIDKey: 'C'}})
    ).toBe(true)

    expect(nav.lastAction()).toMatchObject({target: root, type: 'RESET'})
    expect(visible()).toMatchObject({name: 'chatConversation', params: {conversationIDKey: 'C'}})
    await rendersUntil(() => NavTree.currentTab(nav.getRootState()) !== undefined)
    expect(NavTree.currentTab(nav.getRootState())).toBe(Tabs.chatTab)
    expect(visible()).toMatchObject({name: 'chatConversation', params: {conversationIDKey: 'C'}})
  })
})

describe('setRouteParams', () => {
  test('merges params into the route with that key, whatever is on top', () => {
    nav = installNavigation({
      rootState: makeRootState({tabStack: [{name: 'chatRoot'}, {name: 'profile', params: {username: 'testuser'}}]}),
    })

    expect(getNavigator().setRouteParams('chatRoot-0', {conversationIDKey: 'C'})).toBe(true)

    expect(nav.lastAction()).toMatchObject({source: 'chatRoot-0', type: 'SET_PARAMS'})
    expect(NavTree.activeStack(nav.getRootState())?.routes?.[0]?.params).toEqual({conversationIDKey: 'C'})
    expect(visible()?.name).toBe('profile')
  })
})

// ---- navigateAppendOnceRootHas ----

describe('navigateAppendOnceRootHas', () => {
  test('a wait started before a login pushes once the logged-in root has mounted', async () => {
    nav = installNavigation({rootState: makeRootState({loggedIn: false})})
    navigateAppendOnceRootHas('loggedIn', {name: 'profile', params: {username: 'testuser'}})
    expect(nav.actions).toEqual([])

    nav.setLoggedIn(true)
    await rendersUntil(() => nav.pushes().length > 0)

    expect(nav.pushes()).toEqual([{name: 'profile', params: {username: 'testuser'}}])
    expect(visible()).toMatchObject({name: 'profile', params: {username: 'testuser'}})
  })

  // The wait listens on the container it started on; a remounted container (the native user
  // switch remounts it) never tells it, so it times out rather than pushing onto the newcomer.
  test('a wait does not carry over to a remounted container', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    nav = installNavigation({rootState: makeRootState({loggedIn: false})})
    navigateAppendOnceRootHas('loggedIn', {name: 'profile', params: {username: 'testuser'}}, 20)

    nav.setRootState(makeRootState())
    await rendersUntil(() => warn.mock.calls.length > 0)

    expect(nav.pushes()).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('loggedIn never mounted, dropping profile'))
  })
})

// ---- whenModalsGone ----

describe('whenModalsGone', () => {
  const withConfirm = () =>
    makeRootState({
      above: [{name: 'teamDeleteTeam', params: {teamID: 'T1'}}],
      tab: Tabs.teamsTab,
      tabStack: [{name: 'teamsRoot'}, {name: 'team', params: {teamID: 'T1'}}],
    })

  // clearModals' reset is in the tree by the time it returns
  test('runs at once after clearModals', () => {
    nav = installNavigation({rootState: withConfirm()})
    const cb = jest.fn()

    clearModals()
    whenModalsGone(cb)

    expect(cb).toHaveBeenCalledTimes(1)
  })

  // Asked while the modal is up, it waits for the 'state' event, which comes after React renders
  // the dismissal rather than inside its dispatch.
  test('asked with a modal up, runs once the dismissal has rendered', async () => {
    nav = installNavigation({rootState: withConfirm()})
    const cb = jest.fn()

    whenModalsGone(cb)
    navigateUp()
    expect(NavTree.modalStack(nav.getRootState())).toEqual([])
    expect(cb).not.toHaveBeenCalled()

    await rendersUntil(() => cb.mock.calls.length > 0)
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

// ---- what the library does with an action the Navigator relies on ----

// Without pop, navigate reuses only the current route; an older one of that name is left alone
// and a new screen is pushed. setChatRootParams navigates in place only when chatRoot is current.
test('navigate to a name below the current screen pushes a new one', () => {
  nav = installNavigation({rootState: makeRootState({tabStack: [{name: 'chatRoot'}, {name: 'profile'}]})})

  navigationRef.dispatch(CommonActions.navigate('chatRoot', {conversationIDKey: 'C'}))

  expect(activeNames()).toEqual(['chatRoot', 'profile', 'chatRoot'])
})

describe('found on the real library', () => {
  // Desktop and tablet keep the thread in the tab stack; React Navigation hands an action to the
  // focused navigator, here the root stack under a modal, and SET_PARAMS never travels down to a
  // nested stack, so the route has to be targeted through its own navigator.
  test('setRouteParams reaches a route in a tab stack while a modal is up', () => {
    nav = installNavigation({
      rootState: makeRootState({
        above: [{name: 'chatNewChat'}],
        tabStack: [{name: 'chatRoot', params: {conversationIDKey: 'C', threadSearch: {query: 'needle'}}}],
      }),
    })
    const errors = jest.spyOn(console, 'error')
    expect(getNavigator().setRouteParams('chatRoot-0', {threadSearch: undefined})).toBe(true)
    expect(errors).not.toHaveBeenCalled()
    expect(routeByKey('chatRoot-0')?.params).toEqual({conversationIDKey: 'C', threadSearch: undefined})
  })

  // Provisioning another account while logged in shows its screens as modals; an error after
  // clearModals asked to replace the visible screen with the modal 'error'. With no modal up the
  // replace reached the root stack and replaced loggedIn itself.
  test('a replace to a modal with no modal up opens it above the tabs instead of replacing them', () => {
    nav = installNavigation({rootState: makeRootState({tab: Tabs.peopleTab})})
    navigateAppend({name: 'error', params: {}} as never, true)
    expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn', 'error'])
  })

  test('a replace to a modal over a modal still replaces that modal', () => {
    nav = installNavigation({rootState: makeRootState({above: [{name: 'codePage'}]})})
    navigateAppend({name: 'error', params: {}} as never, true)
    expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn', 'error'])
  })
})

// ---- pushInTab ----

describe('pushInTab', () => {
  const settingsStack = () => {
    const tabs = NavTree.tabNavigatorState(nav.getRootState())
    return tabs?.routes?.find(r => r.name === Tabs.settingsTab)?.state?.routes.map(r => r.name)
  }

  test('focuses the tab with the screen on its stack, and history holds only that tab', async () => {
    nav = installNavigation({layout: 'tablet', rootState: makeRootState({tab: Tabs.chatTab})})
    getNavigator().pushInTab(Tabs.settingsTab, {name: 'settingsTabs.devicesTab'})
    await renders()
    const tabs = NavTree.tabNavigatorState(nav.getRootState())
    expect(NavTree.currentTab(nav.getRootState())).toBe(Tabs.settingsTab)
    expect(settingsStack()).toEqual(['settingsRoot', 'settingsTabs.devicesTab'])
    const settingsKey = tabs?.routes?.find(r => r.name === Tabs.settingsTab)?.key
    expect((tabs as {history?: ReadonlyArray<{key: string}>} | undefined)?.history?.map(h => h.key)).toEqual([settingsKey])
  })

  test('the screen already on top is not pushed again', async () => {
    nav = installNavigation({layout: 'tablet', rootState: makeRootState({tab: Tabs.chatTab})})
    getNavigator().pushInTab(Tabs.settingsTab, {name: 'settingsTabs.devicesTab'})
    await renders()
    getNavigator().pushInTab(Tabs.settingsTab, {name: 'settingsTabs.devicesTab'})
    await renders()
    expect(settingsStack()).toEqual(['settingsRoot', 'settingsTabs.devicesTab'])
  })
})

