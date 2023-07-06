// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import type * as Types from '../constants/types/settings'
import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const addEmail = 'settings:addEmail'
export const addedEmail = 'settings:addedEmail'
export const clearAddedEmail = 'settings:clearAddedEmail'
export const clearAddedPhone = 'settings:clearAddedPhone'
export const clearAddingEmail = 'settings:clearAddingEmail'
export const clearPhoneNumberAdd = 'settings:clearPhoneNumberAdd'
export const clearPhoneNumberErrors = 'settings:clearPhoneNumberErrors'
export const contactSettingsError = 'settings:contactSettingsError'
export const contactSettingsRefresh = 'settings:contactSettingsRefresh'
export const contactSettingsRefreshed = 'settings:contactSettingsRefreshed'
export const contactSettingsSaved = 'settings:contactSettingsSaved'
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
export const editContactImportEnabled = 'settings:editContactImportEnabled'
export const editEmail = 'settings:editEmail'
export const emailVerified = 'settings:emailVerified'
export const feedbackSent = 'settings:feedbackSent'
export const importContactsLater = 'settings:importContactsLater'
export const loadContactImportEnabled = 'settings:loadContactImportEnabled'
export const loadDefaultPhoneNumberCountry = 'settings:loadDefaultPhoneNumberCountry'
export const loadLockdownMode = 'settings:loadLockdownMode'
export const loadedContactImportEnabled = 'settings:loadedContactImportEnabled'
export const loadedContactPermissions = 'settings:loadedContactPermissions'
export const loadedLockdownMode = 'settings:loadedLockdownMode'
export const loadedUserCountryCode = 'settings:loadedUserCountryCode'
export const loginBrowserViaWebAuthToken = 'settings:loginBrowserViaWebAuthToken'
export const notificationsRefresh = 'settings:notificationsRefresh'
export const notificationsRefreshed = 'settings:notificationsRefreshed'
export const notificationsSaved = 'settings:notificationsSaved'
export const notificationsToggle = 'settings:notificationsToggle'
export const onChangeLockdownMode = 'settings:onChangeLockdownMode'
export const onChangeNewEmail = 'settings:onChangeNewEmail'
export const onSubmitNewEmail = 'settings:onSubmitNewEmail'
export const onUpdateEmailError = 'settings:onUpdateEmailError'
export const processorProfile = 'settings:processorProfile'
export const requestContactPermissions = 'settings:requestContactPermissions'
export const sendFeedback = 'settings:sendFeedback'
export const sentVerificationEmail = 'settings:sentVerificationEmail'
export const setContactImportedCount = 'settings:setContactImportedCount'
export const showContactsJoinedModal = 'settings:showContactsJoinedModal'
export const stop = 'settings:stop'
export const trace = 'settings:trace'
export const unfurlSettingsError = 'settings:unfurlSettingsError'
export const unfurlSettingsRefresh = 'settings:unfurlSettingsRefresh'
export const unfurlSettingsRefreshed = 'settings:unfurlSettingsRefreshed'
export const unfurlSettingsSaved = 'settings:unfurlSettingsSaved'
export const verifiedPhoneNumber = 'settings:verifiedPhoneNumber'

// Action Creators
/**
 * An email was just marked as verified
 */
export const createEmailVerified = (payload: {readonly email: string}) => ({
  payload,
  type: emailVerified as typeof emailVerified,
})
/**
 * An error occurred on the contact settings screen
 */
export const createContactSettingsError = (payload: {readonly error: string}) => ({
  payload,
  type: contactSettingsError as typeof contactSettingsError,
})
/**
 * An error occurred on the unfurl settings screen
 */
export const createUnfurlSettingsError = (payload: {readonly error: string}) => ({
  payload,
  type: unfurlSettingsError as typeof unfurlSettingsError,
})
/**
 * An error occurred while trying to send feedback to Keybase
 */
export const createFeedbackSent = (payload: {readonly error?: Error} = {}) => ({
  payload,
  type: feedbackSent as typeof feedbackSent,
})
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
 * Load whether config says we've enabled contact importing and check OS contacts permission status.
 */
export const createLoadContactImportEnabled = (payload?: undefined) => ({
  payload,
  type: loadContactImportEnabled as typeof loadContactImportEnabled,
})
/**
 * Refresh Chat contact settings
 */
export const createContactSettingsRefresh = (payload?: undefined) => ({
  payload,
  type: contactSettingsRefresh as typeof contactSettingsRefresh,
})
/**
 * Refresh unfurl settings
 */
export const createUnfurlSettingsRefresh = (payload?: undefined) => ({
  payload,
  type: unfurlSettingsRefresh as typeof unfurlSettingsRefresh,
})
/**
 * Refreshed Chat contact settings available
 */
export const createContactSettingsRefreshed = (payload: {readonly settings: RPCTypes.ContactSettings}) => ({
  payload,
  type: contactSettingsRefreshed as typeof contactSettingsRefreshed,
})
/**
 * Refreshed Chat contact settings available
 */
export const createContactSettingsSaved = (payload: {
  readonly enabled: boolean
  readonly indirectFollowees: boolean
  readonly teamsEnabled: boolean
  readonly teamsList: Types.ContactSettingsTeamsList
}) => ({payload, type: contactSettingsSaved as typeof contactSettingsSaved})
/**
 * Refreshed unfurl settings available
 */
export const createUnfurlSettingsRefreshed = (payload: {
  readonly mode: RPCChatTypes.UnfurlMode
  readonly whitelist: Array<string>
}) => ({payload, type: unfurlSettingsRefreshed as typeof unfurlSettingsRefreshed})
/**
 * Reset state used for adding an email.
 */
export const createClearAddingEmail = (payload?: undefined) => ({
  payload,
  type: clearAddingEmail as typeof clearAddingEmail,
})
/**
 * Reset state used for showing we just added a phone number.
 */
export const createClearAddedPhone = (payload?: undefined) => ({
  payload,
  type: clearAddedPhone as typeof clearAddedPhone,
})
/**
 * Reset state used for showing we just added an email.
 */
export const createClearAddedEmail = (payload?: undefined) => ({
  payload,
  type: clearAddedEmail as typeof clearAddedEmail,
})
/**
 * Update unfurl settings from settings screen
 */
export const createUnfurlSettingsSaved = (payload: {
  readonly mode: RPCChatTypes.UnfurlMode
  readonly whitelist: Array<string>
}) => ({payload, type: unfurlSettingsSaved as typeof unfurlSettingsSaved})
/**
 * We verified a phone number or hit an error.
 */
export const createVerifiedPhoneNumber = (payload: {
  readonly error?: string
  readonly phoneNumber: string
}) => ({payload, type: verifiedPhoneNumber as typeof verifiedPhoneNumber})
export const createAddEmail = (payload: {readonly email: string; readonly searchable: boolean}) => ({
  payload,
  type: addEmail as typeof addEmail,
})
export const createAddedEmail = (payload: {readonly email: string; readonly error?: string}) => ({
  payload,
  type: addedEmail as typeof addedEmail,
})
export const createDbNuke = (payload?: undefined) => ({payload, type: dbNuke as typeof dbNuke})
export const createDeleteAccountForever = (payload: {readonly passphrase?: HiddenString} = {}) => ({
  payload,
  type: deleteAccountForever as typeof deleteAccountForever,
})
export const createEditContactImportEnabled = (payload: {
  readonly enable: boolean
  readonly fromSettings?: boolean
}) => ({payload, type: editContactImportEnabled as typeof editContactImportEnabled})
export const createEditEmail = (payload: {
  readonly email: string
  readonly delete?: boolean
  readonly makePrimary?: boolean
  readonly makeSearchable?: boolean
  readonly verify?: boolean
}) => ({payload, type: editEmail as typeof editEmail})
export const createImportContactsLater = (payload?: undefined) => ({
  payload,
  type: importContactsLater as typeof importContactsLater,
})
export const createLoadDefaultPhoneNumberCountry = (payload?: undefined) => ({
  payload,
  type: loadDefaultPhoneNumberCountry as typeof loadDefaultPhoneNumberCountry,
})
export const createLoadLockdownMode = (payload?: undefined) => ({
  payload,
  type: loadLockdownMode as typeof loadLockdownMode,
})
export const createLoadedContactImportEnabled = (payload: {readonly enabled: boolean}) => ({
  payload,
  type: loadedContactImportEnabled as typeof loadedContactImportEnabled,
})
export const createLoadedContactPermissions = (payload: {
  readonly status: 'granted' | 'denied' | 'undetermined'
}) => ({payload, type: loadedContactPermissions as typeof loadedContactPermissions})
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
export const createOnChangeNewEmail = (payload: {readonly email: string}) => ({
  payload,
  type: onChangeNewEmail as typeof onChangeNewEmail,
})
export const createOnSubmitNewEmail = (payload?: undefined) => ({
  payload,
  type: onSubmitNewEmail as typeof onSubmitNewEmail,
})
export const createOnUpdateEmailError = (payload: {readonly error: Error}) => ({
  payload,
  type: onUpdateEmailError as typeof onUpdateEmailError,
})
export const createProcessorProfile = (payload: {readonly durationSeconds: number}) => ({
  payload,
  type: processorProfile as typeof processorProfile,
})
export const createRequestContactPermissions = (
  payload: {readonly thenToggleImportOn?: boolean; readonly fromSettings?: boolean} = {}
) => ({payload, type: requestContactPermissions as typeof requestContactPermissions})
export const createSendFeedback = (payload: {
  readonly feedback: string
  readonly sendLogs: boolean
  readonly sendMaxBytes: boolean
}) => ({payload, type: sendFeedback as typeof sendFeedback})
export const createSentVerificationEmail = (payload: {readonly email: string}) => ({
  payload,
  type: sentVerificationEmail as typeof sentVerificationEmail,
})
export const createSetContactImportedCount = (
  payload: {readonly count?: number; readonly error?: string} = {}
) => ({payload, type: setContactImportedCount as typeof setContactImportedCount})
export const createShowContactsJoinedModal = (payload: {
  readonly resolved: Array<RPCTypes.ProcessedContact>
}) => ({payload, type: showContactsJoinedModal as typeof showContactsJoinedModal})
export const createStop = (payload: {readonly exitCode: RPCTypes.ExitCode}) => ({
  payload,
  type: stop as typeof stop,
})
export const createTrace = (payload: {readonly durationSeconds: number}) => ({
  payload,
  type: trace as typeof trace,
})

// Action Payloads
export type AddEmailPayload = ReturnType<typeof createAddEmail>
export type AddedEmailPayload = ReturnType<typeof createAddedEmail>
export type ClearAddedEmailPayload = ReturnType<typeof createClearAddedEmail>
export type ClearAddedPhonePayload = ReturnType<typeof createClearAddedPhone>
export type ClearAddingEmailPayload = ReturnType<typeof createClearAddingEmail>
export type ClearPhoneNumberAddPayload = ReturnType<typeof createClearPhoneNumberAdd>
export type ClearPhoneNumberErrorsPayload = ReturnType<typeof createClearPhoneNumberErrors>
export type ContactSettingsErrorPayload = ReturnType<typeof createContactSettingsError>
export type ContactSettingsRefreshPayload = ReturnType<typeof createContactSettingsRefresh>
export type ContactSettingsRefreshedPayload = ReturnType<typeof createContactSettingsRefreshed>
export type ContactSettingsSavedPayload = ReturnType<typeof createContactSettingsSaved>
export type DbNukePayload = ReturnType<typeof createDbNuke>
export type DeleteAccountForeverPayload = ReturnType<typeof createDeleteAccountForever>
export type EditContactImportEnabledPayload = ReturnType<typeof createEditContactImportEnabled>
export type EditEmailPayload = ReturnType<typeof createEditEmail>
export type EmailVerifiedPayload = ReturnType<typeof createEmailVerified>
export type FeedbackSentPayload = ReturnType<typeof createFeedbackSent>
export type ImportContactsLaterPayload = ReturnType<typeof createImportContactsLater>
export type LoadContactImportEnabledPayload = ReturnType<typeof createLoadContactImportEnabled>
export type LoadDefaultPhoneNumberCountryPayload = ReturnType<typeof createLoadDefaultPhoneNumberCountry>
export type LoadLockdownModePayload = ReturnType<typeof createLoadLockdownMode>
export type LoadedContactImportEnabledPayload = ReturnType<typeof createLoadedContactImportEnabled>
export type LoadedContactPermissionsPayload = ReturnType<typeof createLoadedContactPermissions>
export type LoadedLockdownModePayload = ReturnType<typeof createLoadedLockdownMode>
export type LoadedUserCountryCodePayload = ReturnType<typeof createLoadedUserCountryCode>
export type LoginBrowserViaWebAuthTokenPayload = ReturnType<typeof createLoginBrowserViaWebAuthToken>
export type NotificationsRefreshPayload = ReturnType<typeof createNotificationsRefresh>
export type NotificationsRefreshedPayload = ReturnType<typeof createNotificationsRefreshed>
export type NotificationsSavedPayload = ReturnType<typeof createNotificationsSaved>
export type NotificationsTogglePayload = ReturnType<typeof createNotificationsToggle>
export type OnChangeLockdownModePayload = ReturnType<typeof createOnChangeLockdownMode>
export type OnChangeNewEmailPayload = ReturnType<typeof createOnChangeNewEmail>
export type OnSubmitNewEmailPayload = ReturnType<typeof createOnSubmitNewEmail>
export type OnUpdateEmailErrorPayload = ReturnType<typeof createOnUpdateEmailError>
export type ProcessorProfilePayload = ReturnType<typeof createProcessorProfile>
export type RequestContactPermissionsPayload = ReturnType<typeof createRequestContactPermissions>
export type SendFeedbackPayload = ReturnType<typeof createSendFeedback>
export type SentVerificationEmailPayload = ReturnType<typeof createSentVerificationEmail>
export type SetContactImportedCountPayload = ReturnType<typeof createSetContactImportedCount>
export type ShowContactsJoinedModalPayload = ReturnType<typeof createShowContactsJoinedModal>
export type StopPayload = ReturnType<typeof createStop>
export type TracePayload = ReturnType<typeof createTrace>
export type UnfurlSettingsErrorPayload = ReturnType<typeof createUnfurlSettingsError>
export type UnfurlSettingsRefreshPayload = ReturnType<typeof createUnfurlSettingsRefresh>
export type UnfurlSettingsRefreshedPayload = ReturnType<typeof createUnfurlSettingsRefreshed>
export type UnfurlSettingsSavedPayload = ReturnType<typeof createUnfurlSettingsSaved>
export type VerifiedPhoneNumberPayload = ReturnType<typeof createVerifiedPhoneNumber>

// All Actions
// prettier-ignore
export type Actions =
  | AddEmailPayload
  | AddedEmailPayload
  | ClearAddedEmailPayload
  | ClearAddedPhonePayload
  | ClearAddingEmailPayload
  | ClearPhoneNumberAddPayload
  | ClearPhoneNumberErrorsPayload
  | ContactSettingsErrorPayload
  | ContactSettingsRefreshPayload
  | ContactSettingsRefreshedPayload
  | ContactSettingsSavedPayload
  | DbNukePayload
  | DeleteAccountForeverPayload
  | EditContactImportEnabledPayload
  | EditEmailPayload
  | EmailVerifiedPayload
  | FeedbackSentPayload
  | ImportContactsLaterPayload
  | LoadContactImportEnabledPayload
  | LoadDefaultPhoneNumberCountryPayload
  | LoadLockdownModePayload
  | LoadedContactImportEnabledPayload
  | LoadedContactPermissionsPayload
  | LoadedLockdownModePayload
  | LoadedUserCountryCodePayload
  | LoginBrowserViaWebAuthTokenPayload
  | NotificationsRefreshPayload
  | NotificationsRefreshedPayload
  | NotificationsSavedPayload
  | NotificationsTogglePayload
  | OnChangeLockdownModePayload
  | OnChangeNewEmailPayload
  | OnSubmitNewEmailPayload
  | OnUpdateEmailErrorPayload
  | ProcessorProfilePayload
  | RequestContactPermissionsPayload
  | SendFeedbackPayload
  | SentVerificationEmailPayload
  | SetContactImportedCountPayload
  | ShowContactsJoinedModalPayload
  | StopPayload
  | TracePayload
  | UnfurlSettingsErrorPayload
  | UnfurlSettingsRefreshPayload
  | UnfurlSettingsRefreshedPayload
  | UnfurlSettingsSavedPayload
  | VerifiedPhoneNumberPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
