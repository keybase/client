/* @flow */

import type {TypedAction} from '../constants/types/flux'
import type {Asset, UpdateType} from '../constants/types/flow-types'

export const showUpdatePrompt = 'update:showUpdatePrompt'
export const registerUpdateListener = 'update:registerUpdateListener'
export const onCancel = 'update:onCancel'
export const onSkip = 'update:onSkip'
export const onSnooze = 'update:onSnooze'
export const onUpdate = 'update:onUpdate'
export const setAlwaysUpdate = 'update:setAlwaysUpdate'

export type ShowUpdateAction = TypedAction<'update:showUpdatePrompt', showUpdatePromptPayload, UpdateError>
export type RegisterUpdateListenerAction = TypedAction<'update:registerUpdateListener', {started: bool}, any>
export type OnCancelAction = TypedAction<'update:onCancel', void, any>
export type OnSkipAction = TypedAction<'update:onSkip', void, any>
export type OnSnoozeAction = TypedAction<'update:onSnooze', void, any>
export type OnUpdateAction = TypedAction<'update:onUpdate', void, any>
export type SetAlwaysUpdateAction = TypedAction<'update:setAlwaysUpdate', {alwaysUpdate: bool}, any>

export type UpdateActions = ShowUpdateAction | RegisterUpdateListenerAction | OnSkipAction | OnSnoozeAction | OnUpdateAction | OnCancelAction | SetAlwaysUpdateAction

type showUpdatePromptPayload = {
  isCritical: bool,
  description: string,
  type: UpdateType,
  asset: Asset,
  windowTitle: string,
  oldVersion: string,
  newVersion: string,
  alwaysUpdate: bool,
  snoozeTime: string,
  updateCommand: ?string,
  canUpdate: bool
}

// TODO: figure out what kind of errors we'll get here
type UpdateError = void

export const snoozeTimeSecs = 60 * 60 * 24
