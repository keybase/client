/// <reference types="jest" />
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
  removeRoutes,
  setChatRootParams,
  switchTab,
} from '@/constants/router'
import {getNavigator, rootWaitLimitMs, type RootWait} from '@/constants/navigator'
import logger from '@/logger'
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
// drops dispatches and reports no root state until the container has mounted.
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

// The in-flight push is dropped until the next 'state' event. In the app the visible-route check
// above already sees a push dispatched this tick (getRootState() has it at once); these tests hold
// the push out of the tree with a manual commit so that only the in-flight check can drop it.
describe('navigateAppend in-flight dedupe', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    nav = installFakeNavigator({commit: 'manual'})
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

// ---- removeRoutes ----

describe('removeRoutes', () => {
  const rootNames = () => nav.getRootState()?.routes?.map(r => r.name)
  const stackNames = () => NavTree.activeStack(nav.getRootState())?.routes?.map(r => r.name)

  test('takes a covered modal out of the root stack and keeps the ones around it', () => {
    nav = installFakeNavigator({
      modalRouteNames: ['m1', 'm2', 'm3'],
      rootState: makeRootState({above: [{name: 'm1'}, {name: 'm2'}, {name: 'm3'}]}),
    })

    removeRoutes(['m2-above-1'])

    expect(nav.actions).toEqual([expect.objectContaining({target: 'root', type: 'RESET'})])
    expect(rootNames()).toEqual(['loggedIn', 'm1', 'm3'])
    // the other routes keep their keys, and so their screens
    expect(nav.getRootState()?.routes?.map(r => r.key)).toEqual(['loggedIn', 'm1-above-0', 'm3-above-2'])
    expect(nav.getRootState()?.routes?.[0]?.state?.key).toBe('tabs')
  })

  describe('on iOS', () => {
    const wasIOS = isIOS
    beforeEach(() => {
      global.isIOS = true
    })
    afterEach(() => {
      global.isIOS = wasIOS
    })

    test('a modal under a modal that stays is kept, as react-native-screens cannot take it out', () => {
      nav = installFakeNavigator({
        modalRouteNames: ['m1', 'm2'],
        rootState: makeRootState({above: [{name: 'm1'}, {name: 'm2'}]}),
      })

      removeRoutes(['m1-above-0'])

      expect(nav.actions).toEqual([])
      expect(rootNames()).toEqual(['loggedIn', 'm1', 'm2'])
    })

    test('modals that go with every modal over them, and pushed screens under a modal, are taken out', () => {
      nav = installFakeNavigator({
        modalRouteNames: ['m1', 'm2'],
        rootState: makeRootState({above: [{name: 'chatConversation'}, {name: 'm1'}, {name: 'm2'}]}),
      })

      removeRoutes(['chatConversation-above-0', 'm1-above-1', 'm2-above-2'])

      expect(rootNames()).toEqual(['loggedIn'])
    })

    test('a modal under a pushed screen that stays is kept too', () => {
      nav = installFakeNavigator({
        modalRouteNames: ['m1'],
        rootState: makeRootState({above: [{name: 'm1'}, {name: 'chatConversation'}]}),
      })

      removeRoutes(['m1-above-0'])

      expect(nav.actions).toEqual([])
      expect(rootNames()).toEqual(['loggedIn', 'm1', 'chatConversation'])
    })

    test('the guard is for the root stack: a tab stack loses a route under one that stays', () => {
      nav = installFakeNavigator({
        rootState: makeRootState({tab: Tabs.peopleTab, tabStack: [{name: 'peopleRoot'}, {name: 'a'}, {name: 'b'}]}),
      })

      removeRoutes(['a-1'])

      expect(stackNames()).toEqual(['peopleRoot', 'b'])
    })
  })

  test('a push dispatched this tick is in the root state it reads, so it goes too', () => {
    nav = installFakeNavigator({modalRouteNames: ['m1']})
    navigateAppend({name: 'm1', params: {}} as never)
    const key = nav.getRootState()?.routes?.at(-1)?.key

    removeRoutes([key!])

    expect(rootNames()).toEqual(['loggedIn'])
  })

  test('a tab navigator is never reset; the stacks in its tabs are', () => {
    nav = installFakeNavigator({
      rootState: makeRootState({tab: Tabs.peopleTab, tabStack: [{name: 'peopleRoot'}, {name: 'a'}]}),
    })

    removeRoutes([Tabs.peopleTab, 'a-1'])

    expect(nav.actions).toEqual([expect.objectContaining({target: `${Tabs.peopleTab}-stack`, type: 'RESET'})])
    expect(stackNames()).toEqual(['peopleRoot'])
  })

  test('a stack with no key is not rewritten, and the stacks under it are still pruned', () => {
    const root = makeRootState({tab: Tabs.peopleTab, tabStack: [{name: 'peopleRoot'}, {name: 'a'}]})
    nav = installFakeNavigator({
      rootState: {
        ...root,
        routes: [
          {
            key: 'outer',
            name: 'outer',
            state: {
              index: 1,
              routes: [
                {key: 'x', name: 'x'},
                {key: 'y', name: 'y', state: root?.routes?.[0]?.state},
              ],
              type: 'stack',
            },
          },
        ],
      } as never,
    })

    removeRoutes(['x', 'a-1'])

    expect(nav.actions).toEqual([expect.objectContaining({target: `${Tabs.peopleTab}-stack`, type: 'RESET'})])
  })

  test('the stack stays focused on the route it was, or the nearest kept one below it', () => {
    const stack = (index: number) =>
      ({
        index: 0,
        key: 'root',
        routes: [
          {
            key: 'loggedOut',
            name: 'loggedOut',
            state: {
              index,
              key: 'loggedOut-stack',
              routes: ['a', 'b', 'c', 'd'].map(n => ({key: n, name: n})),
              type: 'stack',
            },
          },
        ],
        type: 'stack',
      }) as never
    const focused = () => {
      const s = nav.getRootState()?.routes?.[0]?.state
      return s?.routes[s.index ?? 0]?.name
    }

    nav = installFakeNavigator({rootState: stack(2)})
    removeRoutes(['a', 'd'])
    expect(focused()).toBe('c')

    nav = installFakeNavigator({rootState: stack(2)})
    removeRoutes(['b', 'c'])
    expect(focused()).toBe('a')

    nav = installFakeNavigator({rootState: stack(0)})
    removeRoutes(['a'])
    expect(focused()).toBe('b')
  })

  test('resets each stack that holds one, and only those', () => {
    nav = installFakeNavigator({
      modalRouteNames: ['m1'],
      rootState: makeRootState({
        above: [{name: 'm1'}],
        tab: Tabs.peopleTab,
        tabStack: [{name: 'peopleRoot'}, {name: 'a'}, {name: 'b'}],
      }),
    })

    removeRoutes(['a-1', 'm1-above-0'])

    expect(nav.actions).toEqual([
      expect.objectContaining({target: 'root', type: 'RESET'}),
      expect.objectContaining({target: `${Tabs.peopleTab}-stack`, type: 'RESET'}),
    ])
    expect(rootNames()).toEqual(['loggedIn'])
    expect(stackNames()).toEqual(['peopleRoot', 'b'])
  })

  test('a key in no stack, or none at all, dispatches nothing', () => {
    nav = installFakeNavigator()

    removeRoutes(['gone'])
    removeRoutes([])

    expect(nav.actions).toEqual([])
  })

  test('a stack is never emptied', () => {
    nav = installFakeNavigator({rootState: makeRootState({loggedIn: false})})

    removeRoutes(['login-0'])

    expect(nav.actions).toEqual([])
  })

  test('a not-ready navigator dispatches nothing', () => {
    nav = installFakeNavigator({ready: false})

    removeRoutes(['m1-above-0'])

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

// ---- showAboveTabs / setRouteParams ----

describe('showAboveTabs', () => {
  test('resets the root onto the tab and pushes the screen above the tab bar', () => {
    nav = installFakeNavigator({modalRouteNames: [], rootState: makeRootState({tab: Tabs.teamsTab})})

    expect(
      getNavigator().showAboveTabs(Tabs.chatTab, {name: 'chatConversation', params: {conversationIDKey: 'C'}})
    ).toBe(true)

    expect(nav.lastAction()).toMatchObject({target: 'root', type: 'RESET'})
    expect(NavTree.currentTab(nav.getRootState())).toBe(Tabs.chatTab)
    expect(NavTree.visibleScreen(nav.getRootState())).toMatchObject({
      name: 'chatConversation',
      params: {conversationIDKey: 'C'},
    })
  })

  test('a not-ready navigator dispatches nothing and reports failure', () => {
    nav = installFakeNavigator({ready: false})

    expect(getNavigator().showAboveTabs(Tabs.chatTab, {name: 'chatConversation'})).toBe(false)
    expect(nav.actions).toEqual([])
  })
})

describe('setRouteParams', () => {
  test('merges params into the route with that key, whatever is on top', () => {
    nav = installFakeNavigator({
      rootState: makeRootState({tabStack: [{name: 'chatRoot'}, {name: 'profile', params: {username: 'testuser'}}]}),
    })

    expect(getNavigator().setRouteParams('chatRoot-0', {conversationIDKey: 'C'})).toBe(true)

    expect(nav.lastAction()).toMatchObject({source: 'chatRoot-0', type: 'SET_PARAMS'})
    const stack = NavTree.activeStack(nav.getRootState())
    expect(stack?.routes?.[0]?.params).toEqual({conversationIDKey: 'C'})
    expect(NavTree.visibleScreen(nav.getRootState())?.name).toBe('profile')
  })

  test('a not-ready navigator dispatches nothing and reports failure', () => {
    nav = installFakeNavigator({ready: false})

    expect(getNavigator().setRouteParams('chatRoot-0', {conversationIDKey: 'C'})).toBe(false)
    expect(nav.actions).toEqual([])
  })
})

// ---- navigateAppendOnceRootHas ----

describe('navigateAppendOnceRootHas', () => {
  const profile = {name: 'profile', params: {username: 'testuser'}} as const
  const onLoggedIn = (extra?: Partial<RootWait>): RootWait => ({
    path: () => profile,
    rootOk: root => root === 'loggedIn',
    timeoutMs: 1000,
    ...extra,
  })
  const loadingRoot = {index: 0, key: 'root', routes: [{key: 'loading', name: 'loading'}], type: 'stack'}
  let warn: jest.SpyInstance
  beforeEach(() => {
    jest.useFakeTimers()
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  test('pushes at once on a root it wants, and says so', () => {
    const fake = installFakeNavigator()
    const onEnd = jest.fn()
    navigateAppendOnceRootHas(onLoggedIn({onEnd}))

    expect(fake.pushes()).toEqual([profile])
    expect(onEnd).toHaveBeenCalledWith(true)
    expect(fake.listenerCount()).toBe(0)
    expect(jest.getTimerCount()).toBe(0)
  })

  // The wait belongs to the navigator it started on: swapping in another one (a test's
  // teardown, say) must neither check nor push onto the newcomer.
  test('stays bound to the navigator it was called on', () => {
    const first = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
    navigateAppendOnceRootHas(onLoggedIn())

    const second = installFakeNavigator()
    first.setRootState(makeRootState())

    expect(first.pushes()).toEqual([profile])
    expect(second.actions).toEqual([])
  })

  test('gives up at the timeout on a root that never mounts, and tears everything down', () => {
    const fake = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
    const onEnd = jest.fn()
    const unsubscribe = jest.fn()
    navigateAppendOnceRootHas(onLoggedIn({onEnd, recheckOn: () => unsubscribe}))

    jest.advanceTimersByTime(999)
    expect(onEnd).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(onEnd).toHaveBeenCalledWith(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('gave up on root loggedOut'))
    expect(fake.listenerCount()).toBe(0)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)

    fake.setRootState(makeRootState())
    expect(fake.pushes()).toEqual([])
  })

  test('pushes once a root it wants mounts in time', () => {
    const fake = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
    const onEnd = jest.fn()
    navigateAppendOnceRootHas(onLoggedIn({onEnd}))

    fake.setRootState(makeRootState())
    jest.advanceTimersByTime(60_000)

    expect(fake.pushes()).toEqual([profile])
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(true)
  })

  test('waits for a navigator that is not ready, and pushes once it is', () => {
    const fake = installFakeNavigator({ready: false})
    const onEnd = jest.fn()
    navigateAppendOnceRootHas(onLoggedIn({onEnd}))
    expect(onEnd).not.toHaveBeenCalled()

    fake.setReady(true)

    expect(fake.pushes()).toEqual([profile])
    expect(onEnd).toHaveBeenCalledWith(true)
  })

  // A route with no name is one push navigateAppend refuses
  test('a push the navigator refuses keeps waiting, then gives up at the timeout', () => {
    const fake = installFakeNavigator()
    const onEnd = jest.fn()
    navigateAppendOnceRootHas(onLoggedIn({onEnd, path: () => ({name: '', params: {}}) as never}))
    expect(onEnd).not.toHaveBeenCalled()

    fake.setRootState(makeRootState())
    expect(onEnd).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1000)

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(fake.pushes()).toEqual([])
  })

  test('reads its root predicate at every check, including the moments recheckOn adds', () => {
    const fake = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
    let want = 'loggedIn'
    let recheck = () => {}
    navigateAppendOnceRootHas({
      path: root => ({name: 'profile', params: {username: root}}),
      recheckOn: check => {
        recheck = check
        return () => {}
      },
      rootOk: root => root === want,
      timeoutMs: 1000,
    })
    expect(fake.pushes()).toEqual([])

    want = 'loggedOut'
    recheck()

    expect(fake.pushes()).toEqual([{name: 'profile', params: {username: 'loggedOut'}}])
  })

  test('a wait no longer wanted pushes nothing and ends', () => {
    const fake = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
    const onEnd = jest.fn()
    let wanted = true
    navigateAppendOnceRootHas(onLoggedIn({isStillWanted: () => wanted, onEnd}))

    wanted = false
    fake.setRootState(makeRootState())

    expect(fake.pushes()).toEqual([])
    expect(onEnd).toHaveBeenCalledWith(false)
    expect(fake.listenerCount()).toBe(0)
    expect(jest.getTimerCount()).toBe(0)
  })

  test('a cancelled wait pushes nothing, says nothing and tears everything down', () => {
    const fake = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
    const onEnd = jest.fn()
    const unsubscribe = jest.fn()
    const cancel = navigateAppendOnceRootHas(onLoggedIn({atTimeout: 'anyRoot', onEnd, recheckOn: () => unsubscribe}))

    cancel()
    fake.setRootState(makeRootState())
    jest.advanceTimersByTime(60_000)

    expect(fake.pushes()).toEqual([])
    expect(onEnd).not.toHaveBeenCalled()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(fake.listenerCount()).toBe(0)
    expect(jest.getTimerCount()).toBe(0)
  })

  describe("atTimeout 'anyRoot'", () => {
    test('pushes on the mounted root once the timeout is up', () => {
      const fake = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
      const onEnd = jest.fn()
      navigateAppendOnceRootHas(onLoggedIn({atTimeout: 'anyRoot', onEnd}))

      jest.advanceTimersByTime(1000)

      expect(fake.pushes()).toEqual([profile])
      expect(onEnd).toHaveBeenCalledWith(true)
      expect(jest.getTimerCount()).toBe(0)
    })

    test('a root the path has no place on is waited out, up to the limit, then it gives up', () => {
      const fake = installFakeNavigator({rootState: loadingRoot})
      const onEnd = jest.fn()
      navigateAppendOnceRootHas(
        onLoggedIn({
          atTimeout: 'anyRoot',
          onEnd,
          path: root => (root === 'loading' ? undefined : profile),
        })
      )

      jest.advanceTimersByTime(rootWaitLimitMs - 1)
      expect(onEnd).not.toHaveBeenCalled()
      jest.advanceTimersByTime(1)

      expect(onEnd).toHaveBeenCalledWith(false)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('gave up on root loading'))
      fake.setRootState(makeRootState())
      expect(fake.pushes()).toEqual([])
    })

    test('a root the path has a place on, mounting past the timeout, takes it', () => {
      const fake = installFakeNavigator({rootState: loadingRoot})
      navigateAppendOnceRootHas(
        onLoggedIn({atTimeout: 'anyRoot', path: root => (root === 'loading' ? undefined : profile)})
      )
      jest.advanceTimersByTime(10_000)

      fake.setRootState(makeRootState({loggedIn: false}))

      expect(fake.pushes()).toEqual([profile])
    })
  })

  test("a 'giveUp' wait longer than the limit still ends at the limit", () => {
    installFakeNavigator({rootState: makeRootState({loggedIn: false})})
    const onEnd = jest.fn()
    navigateAppendOnceRootHas(onLoggedIn({onEnd, timeoutMs: 10 * rootWaitLimitMs}))

    jest.advanceTimersByTime(rootWaitLimitMs)

    expect(onEnd).toHaveBeenCalledWith(false)
  })
})

// ---- the fake itself ----

describe('fake navigator', () => {
  test('a push lands in the tree, so the next navigation sees it', () => {
    nav = installFakeNavigator()

    navigateAppend({name: 'profile', params: {username: 'testuser'}})
    navigateAppend({name: 'profile', params: {username: 'testuser'}})

    expect(nav.pushes()).toHaveLength(1)
    expect(NavTree.visibleScreen(nav.getRootState())?.name).toBe('profile')

    navigateUp()
    expect(NavTree.visibleScreen(nav.getRootState())?.name).toBe('chatRoot')
  })

  test('an action it does not model throws instead of leaving the tree stale', () => {
    nav = installFakeNavigator()

    expect(() => nav.dispatch({type: 'OPEN_DRAWER'} as never)).toThrow('OPEN_DRAWER is not modelled')
  })

  // A root reset that happens to leave no modal is not clearModals: navToThread's phone reset
  // is one.
  test('modalsCleared only counts resets clearModals dispatched', () => {
    nav = installFakeNavigator({modalRouteNames: ['chatInfoPanel']})

    getNavigator().showAboveTabs(Tabs.chatTab, {name: 'chatConversation'})

    expect(nav.modalsCleared()).toBe(false)
  })

  test('restoring puts back the modal route registration from before the install', () => {
    installFakeNavigator({modalRouteNames: ['chatInfoPanel']})
    restoreNavigator()

    expect(() => NavTree.isModalRouteName('chatInfoPanel')).toThrow('modalRouteNames not registered')
  })

  test('installing without names keeps the ones already registered', () => {
    NavTree.setModalRouteNames(['chatInfoPanel'])
    installFakeNavigator()

    expect(NavTree.isModalRouteName('chatInfoPanel')).toBe(true)
    restoreNavigator()
    expect(NavTree.isModalRouteName('chatInfoPanel')).toBe(true)
  })

  // Modals are registered only on the root stack, so a push of one from inside a tab lands
  // there, where clearModals can find it.
  test('a modal pushed from a tab lands in the root stack', () => {
    nav = installFakeNavigator({modalRouteNames: ['chatInfoPanel']})

    navigateAppend({name: 'chatInfoPanel', params: {}} as never)

    expect(NavTree.modalStack(nav.getRootState()).map(r => r.name)).toEqual(['chatInfoPanel'])
    clearModals()
    expect(nav.modalsCleared()).toBe(true)
  })

  test('popTo a screen that is not in the stack takes the current screen\'s place', () => {
    nav = installFakeNavigator({
      rootState: makeRootState({tab: Tabs.teamsTab, tabStack: [{name: 'teamsRoot'}, {name: 'team'}]}),
    })

    navUpToScreen('teamMember')

    expect(NavTree.activeStack(nav.getRootState())?.routes?.map(r => r.name)).toEqual([
      'teamsRoot',
      'teamMember',
    ])
  })

  // Without pop, navigate reuses only the current route; an older one of that name is left
  // alone and a new screen is pushed.
  test('navigate to a name below the current screen pushes a new one', () => {
    nav = installFakeNavigator({
      rootState: makeRootState({tabStack: [{name: 'chatRoot'}, {name: 'profile'}]}),
    })

    nav.dispatch(CommonActions.navigate('chatRoot', {conversationIDKey: 'C'}))

    expect(NavTree.activeStack(nav.getRootState())?.routes?.map(r => r.name)).toEqual([
      'chatRoot',
      'profile',
      'chatRoot',
    ])
  })

  // navigateToThread's params carry undefined-valued keys; dropping them would make the
  // visible-route dupe check miss on key count and push a second screen.
  test('params keep their undefined-valued keys, so a repeat push is still a dupe', () => {
    nav = installFakeNavigator()

    navigateAppend({name: 'profile', params: {username: 'testuser', extra: undefined}} as never)
    // any later commit copies the tree
    nav.dispatch(CommonActions.setParams({}))
    navigateAppend({name: 'profile', params: {username: 'testuser', extra: undefined}} as never)

    expect(nav.pushes()).toHaveLength(1)
  })
})
