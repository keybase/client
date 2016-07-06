// @flow
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

export type DevAction = {
  type: 'dev:updateDebugConfig',
  value: $Shape<DebugConfig>,
}
export const updateDebugConfig = 'dev:updateDebugConfig'
