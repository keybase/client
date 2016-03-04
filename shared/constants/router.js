/* @flow */

import type {TypedAction} from '../constants/types/flux'

export const navigate = 'router:navigate'
export const navigateAppend = 'router:navigateAppend'
export type RouteAppend = TypedAction<'router:navigateAppend', {route: string}, {}>
export const navigateUp = 'router:navigateUp'
export const navigateBack = 'router:navigateBack'
