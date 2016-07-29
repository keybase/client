// @flow
import type {TypedAction} from '../constants/types/flux'
import type {Tabs} from '../constants/tabs'
import {List, Map} from 'immutable'

type History = List<URI>

export type TabbedRouterState = MapADT2<'tabs', Map<Tabs, RouterState>, 'activeTab', Tabs>
export type RouteAppend = TypedAction<'router:navigateAppend', {route: string}, {}>
export type URI = List<Map<string, string>>
export type RouterState = MapADT2<'uri', URI, 'history', History>
export const switchTab = 'router:switchTab'
export const navigate = 'router:navigate'
export const navigateAppend = 'router:navigateAppend'
export const navigateBack = 'router:navigateBack'
export const navigateUp = 'router:navigateUp'
