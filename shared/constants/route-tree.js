// @flow
import type {_State} from './types/route-tree'
import * as I from 'immutable'

export const navigateAppend = 'routeTree:navigateAppend'
export const navigateTo = 'routeTree:navigateTo'
export const navigateUp = 'routeTree:navigateUp'
export const putActionIfOnPath = 'routeTree:putActionIfOnPath'
export const refreshRouteDef = 'routeTree:refreshRouteDef'
export const resetRoute = 'routeTree:resetRoute'
export const setInitialRouteDef = 'routeTree:setInitialRouteDef'
export const setRouteState = 'routeTree:setRouteState'
export const switchRouteDef = 'routeTree:switchRouteDef'
export const switchTo = 'routeTree:switchTo'

export const makeState: I.RecordFactory<_State> = I.Record({
  loggedInUserNavigated: false,
  routeDef: null,
  routeState: null,
})
