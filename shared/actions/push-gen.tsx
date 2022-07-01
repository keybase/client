// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/push'

// Constants
export const resetStore = 'common:resetStore' // not a part of push but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'push:'
export const notification = 'push:notification'
export const rejectPermissions = 'push:rejectPermissions'
export const requestPermissions = 'push:requestPermissions'
export const showPermissionsPrompt = 'push:showPermissionsPrompt'
export const updateHasPermissions = 'push:updateHasPermissions'
export const updatePushToken = 'push:updatePushToken'

// Action Creators
export const createNotification = (payload: {readonly notification: Types.PushNotification}) => ({
  payload,
  type: notification as typeof notification,
})
export const createRejectPermissions = (payload?: undefined) => ({
  payload,
  type: rejectPermissions as typeof rejectPermissions,
})
export const createRequestPermissions = (payload?: undefined) => ({
  payload,
  type: requestPermissions as typeof requestPermissions,
})
export const createShowPermissionsPrompt = (
  payload: {readonly show?: boolean; readonly persistSkip?: boolean; readonly justSignedUp?: boolean} = {}
) => ({payload, type: showPermissionsPrompt as typeof showPermissionsPrompt})
export const createUpdateHasPermissions = (payload: {readonly hasPermissions: boolean}) => ({
  payload,
  type: updateHasPermissions as typeof updateHasPermissions,
})
export const createUpdatePushToken = (payload: {readonly token: string}) => ({
  payload,
  type: updatePushToken as typeof updatePushToken,
})

// Action Payloads
export type NotificationPayload = ReturnType<typeof createNotification>
export type RejectPermissionsPayload = ReturnType<typeof createRejectPermissions>
export type RequestPermissionsPayload = ReturnType<typeof createRequestPermissions>
export type ShowPermissionsPromptPayload = ReturnType<typeof createShowPermissionsPrompt>
export type UpdateHasPermissionsPayload = ReturnType<typeof createUpdateHasPermissions>
export type UpdatePushTokenPayload = ReturnType<typeof createUpdatePushToken>

// All Actions
// prettier-ignore
export type Actions =
  | NotificationPayload
  | RejectPermissionsPayload
  | RequestPermissionsPayload
  | ShowPermissionsPromptPayload
  | UpdateHasPermissionsPayload
  | UpdatePushTokenPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
