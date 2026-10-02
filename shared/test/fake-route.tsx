// A screen's route for tests of what happens when it leaves the navigation state (router-v2/route-gone):
// Route renders its children as that route, and enter/leave put it in or take it out of the root state
// the app mirrors into the router store.
import type * as React from 'react'
import {act} from '@testing-library/react'
import {NavigationRouteContext} from '@react-navigation/core'
import {useRouterState} from '@/stores/router'

let nextRoute = 0

export const makeFakeRoute = (name = 'screen') => {
  const key = `${name}-route-${nextRoute++}`
  const setRoot = (routes: Array<{key: string; name: string; params?: object}>) =>
    act(() => {
      useRouterState
        .getState()
        .dispatch.setNavState({index: routes.length - 1, key: 'root', routes, type: 'stack'})
    })
  const Route = ({children}: {children?: React.ReactNode}) => (
    <NavigationRouteContext value={{key, name}}>{children}</NavigationRouteContext>
  )
  return {
    // The route is in the state, with these params
    enter: (params?: object) => setRoot([{key: 'app', name: 'app'}, {key, name, params}]),
    key,
    // The route is out of the state: removed, or its root swapped out
    leave: () => setRoot([{key: 'app', name: 'app'}]),
    Route,
  }
}
