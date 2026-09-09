/// <reference types="jest" />
import * as Tabs from '@/constants/tabs'
import {CommonActions} from '@react-navigation/core'
import {
  clearModals,
  navUpToScreen,
  navigateAppend,
  navigateUp,
  popStack,
  setChatRootParams,
  switchTab,
} from '@/constants/router'
import {
  installFakeNavigator,
  makeRootState,
  restoreNavigator,
  type FakeNavigator,
} from '@/test/fake-navigator'

let nav: FakeNavigator

afterEach(() => {
  restoreNavigator()
  jest.useRealTimers()
})

// The two adapters have to agree about readiness or the fake is not a stand-in: the real one
// drops dispatches and reports no root state until the container has mounted, and callers rely
// on that instead of guarding themselves (constants/router's same-conversation retarget
// dispatches straight through the adapter and only then asks whether it was ready).
describe('readiness', () => {
  test('a not-ready navigator drops raw dispatches and reports no root state', () => {
    nav = installFakeNavigator({ready: false})

    nav.dispatch(CommonActions.goBack())

    expect(nav.actions).toEqual([])
    expect(nav.getRootState()).toBeUndefined()
  })

  test('and serves both once the container has mounted', () => {
    nav = installFakeNavigator({ready: false})
    nav.setReady(true)

    nav.dispatch(CommonActions.goBack())

    expect(nav.actions).toEqual([{type: 'GO_BACK'}])
    expect(nav.getRootState()?.key).toBe('root')
  })
})

// ---- navigateUp / popStack ----

describe('navigateUp and popStack', () => {
  test('go back and pop-to-top are dispatched at the root, untargeted', () => {
    nav = installFakeNavigator()

    navigateUp()
    popStack()

    expect(nav.actions).toEqual([{type: 'GO_BACK'}, {type: 'POP_TO_TOP'}])
  })

  test('a not-ready navigator dispatches neither', () => {
    nav = installFakeNavigator({ready: false})

    navigateUp()
    popStack()

    expect(nav.actions).toEqual([])
  })
})

// ---- navigateAppend ----

describe('navigateAppend', () => {
  beforeEach(() => {
    nav = installFakeNavigator({
      rootState: makeRootState({tabStack: [{name: 'chatRoot'}, {name: 'profile', params: {username: 'testuser'}}]}),
    })
  })

  test('pushes a screen that is not already visible', () => {
    expect(navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})).toBe(true)

    expect(nav.pushes()).toEqual([{name: 'profile', params: {username: 'testuser-mac'}}])
  })

  // The caller's goal - "that screen with those params is what the user is looking at" -
  // is already met, so this reports success without a second identical screen.
  test('is a no-op when the target is already the visible route with the same params', () => {
    expect(navigateAppend({name: 'profile', params: {username: 'testuser'}})).toBe(true)

    expect(nav.actions).toEqual([])
  })

  test('a not-ready navigator dispatches nothing and reports failure', () => {
    nav.setReady(false)

    expect(navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})).toBe(false)
    expect(nav.actions).toEqual([])
  })

  test('replace retargets the visible screen in place when the name matches', () => {
    expect(navigateAppend({name: 'profile', params: {username: 'testuser-mac'}}, true)).toBe(true)

    expect(nav.lastAction()?.type).toBe('SET_PARAMS')
    expect(nav.lastAction()?.payload).toEqual({params: {username: 'testuser-mac'}})
  })

  test('replace swaps the screen when the visible one is a different route', () => {
    expect(navigateAppend({name: 'chatNewChat', params: {namespace: 'chat', title: 'New chat'}}, true)).toBe(true)

    expect(nav.lastAction()?.type).toBe('REPLACE')
    expect(nav.lastAction()?.payload).toMatchObject({name: 'chatNewChat'})
  })
})

// A push dispatched this tick is not in getRootState() until React Navigation commits, so
// the visible-route check above cannot see it. Repeat taps that land inside that window -
// a janky JS thread queueing both - would otherwise push the same screen twice.
describe('navigateAppend in-flight dedupe', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    nav = installFakeNavigator()
  })

  test('a second identical push before the state commits is dropped', () => {
    navigateAppend({name: 'profile', params: {username: 'testuser'}})
    navigateAppend({name: 'profile', params: {username: 'testuser'}})

    expect(nav.pushes()).toEqual([{name: 'profile', params: {username: 'testuser'}}])
  })

  test('a different push inside the window still goes through', () => {
    navigateAppend({name: 'profile', params: {username: 'testuser'}})
    navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})

    expect(nav.pushes()).toHaveLength(2)
  })

  // The window is a backstop for the container tearing down before the state listener
  // fires; it must not swallow a genuine repeat navigation forever.
  test('the same push is allowed again once the 1000ms window has passed', () => {
    navigateAppend({name: 'profile', params: {username: 'testuser'}})
    jest.advanceTimersByTime(1001)
    navigateAppend({name: 'profile', params: {username: 'testuser'}})

    expect(nav.pushes()).toHaveLength(2)
  })

  test('the window is still closed one tick before it expires', () => {
    navigateAppend({name: 'profile', params: {username: 'testuser'}})
    jest.advanceTimersByTime(999)
    navigateAppend({name: 'profile', params: {username: 'testuser'}})

    expect(nav.pushes()).toHaveLength(1)
  })

  // The commit is the real end of the window: once the navigator reports new state the
  // visible-route check can see the pushed screen, so the backstop stands down.
  test('a committed state event ends the window early', () => {
    navigateAppend({name: 'profile', params: {username: 'testuser'}})
    nav.setRootState(makeRootState({tabStack: [{name: 'chatRoot'}, {name: 'peopleRoot'}]}))
    navigateAppend({name: 'profile', params: {username: 'testuser'}})

    expect(nav.pushes()).toHaveLength(2)
  })
})

// ---- navUpToScreen ----

describe('navUpToScreen', () => {
  const stack = [{name: 'teamsRoot'}, {name: 'team', params: {teamID: 'T1'}}, {name: 'teamChannel'}]

  beforeEach(() => {
    nav = installFakeNavigator({rootState: makeRootState({tab: Tabs.teamsTab, tabStack: stack})})
  })

  test('a bare route name pops the active stack back to it', () => {
    navUpToScreen('teamsRoot')

    expect(nav.lastAction()).toMatchObject({
      payload: {name: 'teamsRoot'},
      target: `${Tabs.teamsTab}-stack`,
      type: 'POP_TO',
    })
  })

  // A path carries params, and popTo cannot set them, so the stack is rebuilt in place:
  // truncated at the target with the new params written onto it.
  test('a path already in the stack resets the stack onto it with the new params', () => {
    navUpToScreen({name: 'team', params: {teamID: 'T2'}})

    const action = nav.lastAction()
    expect(action?.type).toBe('RESET')
    expect(action?.target).toBe(`${Tabs.teamsTab}-stack`)
    const payload = action?.payload as {index: number; routes: Array<{name: string; params?: object}>}
    expect(payload.index).toBe(1)
    expect(payload.routes.map(r => r.name)).toEqual(['teamsRoot', 'team'])
    expect(payload.routes[1]?.params).toEqual({teamID: 'T2'})
  })

  test('a path that is not in the stack is put in place of the current screen when asked', () => {
    navUpToScreen({name: 'teamMember', params: {teamID: 'T1', username: 'testuser'}}, true)

    expect(nav.lastAction()).toMatchObject({
      payload: {name: 'teamMember', params: {teamID: 'T1', username: 'testuser'}},
      target: `${Tabs.teamsTab}-stack`,
      type: 'REPLACE',
    })
  })

  test('a path that is not in the stack pops towards it otherwise', () => {
    navUpToScreen({name: 'teamMember', params: {teamID: 'T1', username: 'testuser'}})

    expect(nav.lastAction()).toMatchObject({payload: {name: 'teamMember'}, type: 'POP_TO'})
  })

  test('a not-ready navigator dispatches nothing', () => {
    nav.setReady(false)
    navUpToScreen('teamsRoot')

    expect(nav.actions).toEqual([])
  })
})

// ---- clearModals ----

describe('clearModals', () => {
  test('drops the modals and keeps the tab navigator and non-modal pushed screens', () => {
    nav = installFakeNavigator({
      modalRouteNames: ['chatInfoPanel', 'chatNewChat'],
      rootState: makeRootState({
        above: [{name: 'chatConversation', params: {conversationIDKey: 'CONV'}}, {name: 'chatInfoPanel'}],
      }),
    })

    clearModals()

    const action = nav.lastAction()
    expect(action?.type).toBe('RESET')
    expect(action?.target).toBe('root')
    const payload = action?.payload as {index: number; routes: Array<{name: string}>}
    expect(payload.routes.map(r => r.name)).toEqual(['loggedIn', 'chatConversation'])
    expect(payload.index).toBe(1)
  })

  test('dispatches nothing when there is no modal to clear', () => {
    nav = installFakeNavigator({modalRouteNames: ['chatInfoPanel']})

    clearModals()

    expect(nav.actions).toEqual([])
  })

  // A modal can sit above the logged-out stack too, so "nothing to clear" is not what makes
  // this a no-op - clearModals only ever acts on the logged-in root.
  test('dispatches nothing when logged out, even with a modal on top', () => {
    nav = installFakeNavigator({
      modalRouteNames: ['chatInfoPanel'],
      rootState: makeRootState({above: [{name: 'chatInfoPanel'}], loggedIn: false}),
    })

    clearModals()

    expect(nav.actions).toEqual([])
  })
})

// ---- setChatRootParams ----

describe('setChatRootParams', () => {
  test('merges into the live chatRoot in place when it is already showing', () => {
    nav = installFakeNavigator({
      rootState: makeRootState({tabStack: [{name: 'chatRoot', params: {conversationIDKey: 'OLD'}}]}),
    })

    expect(setChatRootParams({conversationIDKey: 'NEW' as never})).toBe(true)

    // in place, targeting the chat tab's own stack - not a reset of the tab navigator
    expect(nav.lastAction()).toMatchObject({
      payload: {name: 'chatRoot', params: {conversationIDKey: 'NEW'}},
      target: `${Tabs.chatTab}-stack`,
      type: 'NAVIGATE',
    })
  })

  test('dispatches nothing when chatRoot already carries those params', () => {
    nav = installFakeNavigator({
      rootState: makeRootState({tabStack: [{name: 'chatRoot', params: {conversationIDKey: 'SAME'}}]}),
    })

    expect(setChatRootParams({conversationIDKey: 'SAME' as never})).toBe(true)
    expect(nav.actions).toEqual([])
  })

  // Something else is on top of the chat stack, so the tab navigator is reset back onto a
  // chatRoot carrying the merged params.
  test('resets the tab navigator when chatRoot is not the current screen', () => {
    nav = installFakeNavigator({
      rootState: makeRootState({
        tabStack: [{name: 'chatRoot', params: {conversationIDKey: 'OLD'}}, {name: 'chatInfoPanel'}],
      }),
    })

    expect(setChatRootParams({conversationIDKey: 'NEW' as never})).toBe(true)

    const action = nav.lastAction()
    expect(action?.type).toBe('RESET')
    expect(action?.target).toBe('tabs')
    const payload = action?.payload as {routes: Array<{state?: {routes: Array<{params?: object}>}}>}
    expect(payload.routes[0]?.state?.routes).toEqual([
      {name: 'chatRoot', params: {conversationIDKey: 'NEW'}},
    ])
  })

  test('reports failure when there is no chat tab to target', () => {
    nav = installFakeNavigator({rootState: makeRootState({tab: Tabs.teamsTab})})

    expect(setChatRootParams({conversationIDKey: 'NEW' as never})).toBe(false)
    expect(nav.actions).toEqual([])
  })

  test('reports failure when logged out', () => {
    nav = installFakeNavigator({rootState: makeRootState({loggedIn: false})})

    expect(setChatRootParams({conversationIDKey: 'NEW' as never})).toBe(false)
    expect(nav.actions).toEqual([])
  })
})

// ---- switchTab ----

describe('switchTab', () => {
  test('jumps within the tab navigator, not the root stack', () => {
    nav = installFakeNavigator()

    switchTab(Tabs.teamsTab)

    expect(nav.lastAction()).toMatchObject({payload: {name: Tabs.teamsTab}, target: 'tabs', type: 'JUMP_TO'})
  })

  // The logged-out root has a stack of its own, with a key a tab jump could be aimed at.
  test('dispatches nothing when logged out', () => {
    nav = installFakeNavigator({rootState: makeRootState({loggedIn: false})})

    switchTab(Tabs.teamsTab)

    expect(nav.actions).toEqual([])
  })
})
