/** @jest-environment jsdom */
/// <reference types="jest" />
// What the real React Navigation does, pinned: code and tests reason from these, never from a model.
import {CommonActions, StackActions, TabActions} from '@react-navigation/core'
import * as NavTree from '@/constants/nav-tree'
import * as Tabs from '@/constants/tabs'
import {navigationRef} from '@/constants/navigator'
import {installNavigation, makeRootState, stackKeyOf, uninstallNavigation} from './navigation'

afterEach(uninstallNavigation)

const teamWithConfirm = () =>
  makeRootState({
    above: [{name: 'teamDeleteTeam', params: {teamID: 'T1'}}],
    tab: Tabs.teamsTab,
    tabStack: [{name: 'teamsRoot'}, {name: 'team', params: {teamID: 'T1'}}],
  })

test('a dispatch is in getRootState() as soon as dispatch returns', () => {
  const nav = installNavigation({rootState: teamWithConfirm()})
  const rs = nav.getRootState()!
  navigationRef.dispatch({...CommonActions.reset({...rs, index: 0, routes: rs.routes!.slice(0, 1)} as never), target: rs.key})

  expect(NavTree.modalStack(nav.getRootState())).toEqual([])
  navigationRef.dispatch({...StackActions.popTo('teamsRoot'), target: stackKeyOf('teamsRoot')})
  expect(nav.visibleScreen()?.name).toBe('teamsRoot')
})

test("the 'state' event fires after React renders, not inside dispatch", async () => {
  const nav = installNavigation({rootState: makeRootState({tab: Tabs.teamsTab, tabStack: [{name: 'teamsRoot'}, {name: 'team', params: {teamID: 'T1'}}]})})
  const events: Array<string> = []
  const unsub = navigationRef.addListener('state', () => events.push('state'))
  navigationRef.dispatch(StackActions.push('teamChannel'))
  expect(events).toEqual([])
  expect(nav.visibleScreen()?.name).toBe('teamChannel')
  // the dispatch runs in a transition, so the render (and the event after it) comes on React's schedule
  for (let i = 0; i < 50 && !events.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 1))
  }
  expect(events).toEqual(['state'])
  unsub()
})

test('an unregistered route is refused, not invented', () => {
  const nav = installNavigation({layout: 'phone', rootState: makeRootState({tab: Tabs.teamsTab})})
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  // a phone's tab stack registers only its root
  navigationRef.dispatch({...StackActions.push('team', {teamID: 'T1'}), target: stackKeyOf('teamsRoot')})
  expect(errors.mock.calls.map(c => String(c[0])).join('\n')).toMatch(/was not handled/)
  errors.mockRestore()
  expect(nav.visibleScreen()?.name).toBe('teamsRoot')
})

// A nested navigator's state is reported by that navigator once it has mounted, so a tab focused
// for the first time (or a navigator a reset rebuilds) shows its stack only after React renders.
test('a nested navigator that has not mounted yet is in getRootState() once it renders', async () => {
  const nav = installNavigation()
  navigationRef.dispatch({...TabActions.jumpTo(Tabs.teamsTab), target: NavTree.tabNavigatorState(nav.getRootState())?.key})
  expect(NavTree.currentTab(nav.getRootState())).toBe(Tabs.teamsTab)
  expect(nav.visibleScreen()?.name).toBe(Tabs.teamsTab)
  for (let i = 0; i < 50 && nav.visibleScreen()?.name !== 'teamsRoot'; i++) {
    await new Promise(resolve => setTimeout(resolve, 1))
  }
  expect(nav.visibleScreen()?.name).toBe('teamsRoot')
})
