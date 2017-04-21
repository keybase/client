// @flow
import type {TypedAction} from './types/flux'
import type {Exact} from './types/more'

export const serializeRestore = 'dev:restoreState'
export const serializeSave = 'dev:saveState'
export const timeTravel = 'dev:timetravel'
export const timeTravelBack = 'dev:back'
export const timeTravelForward = 'dev:forward'

export type DebugConfig = {
  dumbFilter: string,
  dumbIndex: number,
  dumbFullscreen: boolean,
}

export const updateDebugConfig = 'dev:updateDebugConfig'
export type UpdateDebugConfig = TypedAction<'dev:updateDebugConfig', Exact<DebugConfig>, void>

export const updateReloading = 'dev:updatehmrReloading'
export type UpdateReloading = TypedAction<'dev:updatehmrReloading', {reloading: boolean}, void>

export type Actions = UpdateDebugConfig | UpdateReloading
