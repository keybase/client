// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/settings'
import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const clearAddedPhone = 'settings:clearAddedPhone'
export const clearPhoneNumberAdd = 'settings:clearPhoneNumberAdd'
export const clearPhoneNumberErrors = 'settings:clearPhoneNumberErrors'
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
export const loadDefaultPhoneNumberCountry = 'settings:loadDefaultPhoneNumberCountry'
export const loadLockdownMode = 'settings:loadLockdownMode'
export const loadedLockdownMode = 'settings:loadedLockdownMode'
export const loadedUserCountryCode = 'settings:loadedUserCountryCode'
export const loginBrowserViaWebAuthToken = 'settings:loginBrowserViaWebAuthToken'
export const notificationsRefresh = 'settings:notificationsRefresh'
export const notificationsRefreshed = 'settings:notificationsRefreshed'
export const notificationsSaved = 'settings:notificationsSaved'
export const notificationsToggle = 'settings:notificationsToggle'
export const onChangeLockdownMode = 'settings:onChangeLockdownMode'
export const processorProfile = 'settings:processorProfile'
export const stop = 'settings:stop'
export const trace = 'settings:trace'
export const verifiedPhoneNumber = 'settings:verifiedPhoneNumber'

// Action Creators
/**
 * Cancel adding a phone number.
 */
export const createClearPhoneNumberAdd = (payload?: undefined) => ({
  payload,
  type: clearPhoneNumberAdd as typeof clearPhoneNumberAdd,
})
/**
 * Clear only error from phone number add flow.
 */
export const createClearPhoneNumberErrors = (payload?: undefined) => ({
  payload,
  type: clearPhoneNumberErrors as typeof clearPhoneNumberErrors,
})
/**
 * Reset state used for showing we just added a phone number.
 */
export const createClearAddedPhone = (payload?: undefined) => ({
  payload,
  type: clearAddedPhone as typeof clearAddedPhone,
})
/**
 * We verified a phone number or hit an error.
 */
export const createVerifiedPhoneNumber = (payload: {
  readonly error?: string
  readonly phoneNumber: string
}) => ({payload, type: verifiedPhoneNumber as typeof verifiedPhoneNumber})
export const createDbNuke = (payload?: undefined) => ({payload, type: dbNuke as typeof dbNuke})
export const createDeleteAccountForever = (payload: {readonly passphrase?: HiddenString} = {}) => ({
  payload,
  type: deleteAccountForever as typeof deleteAccountForever,
})
export const createLoadDefaultPhoneNumberCountry = (payload?: undefined) => ({
  payload,
  type: loadDefaultPhoneNumberCountry as typeof loadDefaultPhoneNumberCountry,
})
export const createLoadLockdownMode = (payload?: undefined) => ({
  payload,
  type: loadLockdownMode as typeof loadLockdownMode,
})
export const createLoadedLockdownMode = (payload: {readonly status?: boolean} = {}) => ({
  payload,
  type: loadedLockdownMode as typeof loadedLockdownMode,
})
export const createLoadedUserCountryCode = (payload: {readonly code?: string} = {}) => ({
  payload,
  type: loadedUserCountryCode as typeof loadedUserCountryCode,
})
export const createLoginBrowserViaWebAuthToken = (payload?: undefined) => ({
  payload,
  type: loginBrowserViaWebAuthToken as typeof loginBrowserViaWebAuthToken,
})
export const createNotificationsRefresh = (payload?: undefined) => ({
  payload,
  type: notificationsRefresh as typeof notificationsRefresh,
})
export const createNotificationsRefreshed = (payload: {
  readonly notifications: Map<string, Types.NotificationsGroupState>
}) => ({payload, type: notificationsRefreshed as typeof notificationsRefreshed})
export const createNotificationsSaved = (payload?: undefined) => ({
  payload,
  type: notificationsSaved as typeof notificationsSaved,
})
export const createNotificationsToggle = (payload: {readonly group: string; readonly name?: string}) => ({
  payload,
  type: notificationsToggle as typeof notificationsToggle,
})
export const createOnChangeLockdownMode = (payload: {readonly enabled: boolean}) => ({
  payload,
  type: onChangeLockdownMode as typeof onChangeLockdownMode,
})
export const createProcessorProfile = (payload: {readonly durationSeconds: number}) => ({
  payload,
  type: processorProfile as typeof processorProfile,
})
export const createStop = (payload: {readonly exitCode: RPCTypes.ExitCode}) => ({
  payload,
  type: stop as typeof stop,
})
export const createTrace = (payload: {readonly durationSeconds: number}) => ({
  payload,
  type: trace as typeof trace,
})

// Action Payloads
export type ClearAddedPhonePayload = ReturnType<typeof createClearAddedPhone>
export type ClearPhoneNumberAddPayload = ReturnType<typeof createClearPhoneNumberAdd>
export type ClearPhoneNumberErrorsPayload = ReturnType<typeof createClearPhoneNumberErrors>
export type DbNukePayload = ReturnType<typeof createDbNuke>
export type DeleteAccountForeverPayload = ReturnType<typeof createDeleteAccountForever>
export type LoadDefaultPhoneNumberCountryPayload = ReturnType<typeof createLoadDefaultPhoneNumberCountry>
export type LoadLockdownModePayload = ReturnType<typeof createLoadLockdownMode>
export type LoadedLockdownModePayload = ReturnType<typeof createLoadedLockdownMode>
export type LoadedUserCountryCodePayload = ReturnType<typeof createLoadedUserCountryCode>
export type LoginBrowserViaWebAuthTokenPayload = ReturnType<typeof createLoginBrowserViaWebAuthToken>
export type NotificationsRefreshPayload = ReturnType<typeof createNotificationsRefresh>
export type NotificationsRefreshedPayload = ReturnType<typeof createNotificationsRefreshed>
export type NotificationsSavedPayload = ReturnType<typeof createNotificationsSaved>
export type NotificationsTogglePayload = ReturnType<typeof createNotificationsToggle>
export type OnChangeLockdownModePayload = ReturnType<typeof createOnChangeLockdownMode>
export type ProcessorProfilePayload = ReturnType<typeof createProcessorProfile>
export type StopPayload = ReturnType<typeof createStop>
export type TracePayload = ReturnType<typeof createTrace>
export type VerifiedPhoneNumberPayload = ReturnType<typeof createVerifiedPhoneNumber>

// All Actions
// prettier-ignore
export type Actions =
  | ClearAddedPhonePayload
  | ClearPhoneNumberAddPayload
  | ClearPhoneNumberErrorsPayload
  | DbNukePayload
  | DeleteAccountForeverPayload
  | LoadDefaultPhoneNumberCountryPayload
  | LoadLockdownModePayload
  | LoadedLockdownModePayload
  | LoadedUserCountryCodePayload
  | LoginBrowserViaWebAuthTokenPayload
  | NotificationsRefreshPayload
  | NotificationsRefreshedPayload
  | NotificationsSavedPayload
  | NotificationsTogglePayload
  | OnChangeLockdownModePayload
  | ProcessorProfilePayload
  | StopPayload
  | TracePayload
  | VerifiedPhoneNumberPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
