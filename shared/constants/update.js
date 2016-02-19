/* @flow */

import type {TypedAction} from '../constants/types/flux'
import type {Asset, UpdateType} from '../constants/types/flow-types'

export const showUpdateConfirm = 'update:showUpdateConfirm'
export const registerUpdateListener = 'update:registerUpdateListener'
export const onCancel = 'update:onCancel'
export const onSkip = 'update:onSkip'
export const onSnooze = 'update:onSnooze'
export const onConfirmUpdate = 'update:onConfirmUpdate'
export const setAlwaysUpdate = 'update:setAlwaysUpdate'

export type ShowUpdateConfirmAction = TypedAction<'update:showUpdateConfirm', showUpdateConfirmPayload, UpdateError>
export type RegisterUpdateListenerAction = TypedAction<'update:registerUpdateListener', {started: bool}, any>
export type OnCancelAction = TypedAction<'update:onCancel', void, any>
export type OnSkipAction = TypedAction<'update:onSkip', void, any>
export type OnSnoozeAction = TypedAction<'update:onSnooze', void, any>
export type OnConfirmUpdateAction = TypedAction<'update:onConfirmUpdate', void, any>
export type SetAlwaysUpdateAction = TypedAction<'update:setAlwaysUpdate', {alwaysUpdate: bool}, any>

export type UpdateConfirmActions = ShowUpdateConfirmAction | RegisterUpdateListenerAction | OnSkipAction | OnSnoozeAction | OnConfirmUpdateAction | OnCancelAction | SetAlwaysUpdateAction

type showUpdateConfirmPayload = {
  isCritical: bool,
  description: string,
  type: UpdateType,
  asset: ?Asset,
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

export const showUpdatePaused = 'update:showUpdatePaused'
export const onForce = 'updatePaused:onForce'

export type ShowUpdatePausedAction = TypedAction<'update:showUpdatePaused', showUpdatePausedPayload, UpdateError>
export type OnForceAction = TypedAction<'updatePaused:onForce', void, any>

export type UpdatePausedActions = ShowUpdatePausedAction

type showUpdatePausedPayload = {

}
