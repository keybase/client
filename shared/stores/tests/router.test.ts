import {resetAllStores} from '@/util/zustand'
import {useRouterState} from '../router'

afterEach(() => {
  resetAllStores()
})

const makeNavState = (label: string) =>
  ({
    index: 0,
    key: `nav-${label}`,
    routes: [{key: `route-${label}`, name: 'loggedOut'}],
  }) as any

test('setNavState stores the provided navigation state', () => {
  const navState = makeNavState('one')

  useRouterState.getState().dispatch.setNavState(navState)

  expect(useRouterState.getState().navState).toBe(navState)
})

test('resetState clears navState and preserves the dispatch object', () => {
  const dispatch = useRouterState.getState().dispatch
  useRouterState.getState().dispatch.setNavState(makeNavState('two'))
  expect(useRouterState.getState().navState).not.toBeUndefined()

  useRouterState.getState().dispatch.resetState()

  expect(useRouterState.getState().navState).toBeUndefined()
  expect(useRouterState.getState().dispatch).toBe(dispatch)
})
