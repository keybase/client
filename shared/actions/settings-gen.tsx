// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import type * as Types from '../constants/types/settings'
import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const addEmail = 'settings:addEmail'
export const addPhoneNumber = 'settings:addPhoneNumber'
export const addedEmail = 'settings:addedEmail'
export const addedPhoneNumber = 'settings:addedPhoneNumber'
export const certificatePinningToggled = 'settings:certificatePinningToggled'
export const checkPassword = 'settings:checkPassword'
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
export const editPhone = 'settings:editPhone'
export const emailVerified = 'settings:emailVerified'
export const feedbackSent = 'settings:feedbackSent'
export const importContactsLater = 'settings:importContactsLater'
export const invitesClearError = 'settings:invitesClearError'
export const invitesReclaim = 'settings:invitesReclaim'
export const invitesRefresh = 'settings:invitesRefresh'
export const invitesRefreshed = 'settings:invitesRefreshed'
export const invitesSend = 'settings:invitesSend'
export const invitesSent = 'settings:invitesSent'
export const loadContactImportEnabled = 'settings:loadContactImportEnabled'
export const loadDefaultPhoneNumberCountry = 'settings:loadDefaultPhoneNumberCountry'
export const loadHasRandomPw = 'settings:loadHasRandomPw'
export const loadLockdownMode = 'settings:loadLockdownMode'
export const loadProxyData = 'settings:loadProxyData'
export const loadRememberPassword = 'settings:loadRememberPassword'
export const loadSettings = 'settings:loadSettings'
export const loadedCheckPassword = 'settings:loadedCheckPassword'
export const loadedContactImportEnabled = 'settings:loadedContactImportEnabled'
export const loadedContactPermissions = 'settings:loadedContactPermissions'
export const loadedHasRandomPw = 'settings:loadedHasRandomPw'
export const loadedLockdownMode = 'settings:loadedLockdownMode'
export const loadedProxyData = 'settings:loadedProxyData'
export const loadedRememberPassword = 'settings:loadedRememberPassword'
export const loadedSettings = 'settings:loadedSettings'
export const loadedUserCountryCode = 'settings:loadedUserCountryCode'
export const loginBrowserViaWebAuthToken = 'settings:loginBrowserViaWebAuthToken'
export const notificationsRefresh = 'settings:notificationsRefresh'
export const notificationsRefreshed = 'settings:notificationsRefreshed'
export const notificationsSaved = 'settings:notificationsSaved'
export const notificationsToggle = 'settings:notificationsToggle'
export const onChangeLockdownMode = 'settings:onChangeLockdownMode'
export const onChangeNewEmail = 'settings:onChangeNewEmail'
export const onChangeNewPassword = 'settings:onChangeNewPassword'
export const onChangeNewPasswordConfirm = 'settings:onChangeNewPasswordConfirm'
export const onChangeRememberPassword = 'settings:onChangeRememberPassword'
export const onChangeShowPassword = 'settings:onChangeShowPassword'
export const onSubmitNewEmail = 'settings:onSubmitNewEmail'
export const onSubmitNewPassword = 'settings:onSubmitNewPassword'
export const onUpdateEmailError = 'settings:onUpdateEmailError'
export const onUpdatePGPSettings = 'settings:onUpdatePGPSettings'
export const onUpdatePasswordError = 'settings:onUpdatePasswordError'
export const onUpdatedPGPSettings = 'settings:onUpdatedPGPSettings'
export const processorProfile = 'settings:processorProfile'
export const requestContactPermissions = 'settings:requestContactPermissions'
export const resendVerificationForPhoneNumber = 'settings:resendVerificationForPhoneNumber'
export const resetCheckPasswordIsCorrect = 'settings:resetCheckPasswordIsCorrect'
export const saveProxyData = 'settings:saveProxyData'
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
export const updateDefaultPhoneNumberCountry = 'settings:updateDefaultPhoneNumberCountry'
export const verifiedPhoneNumber = 'settings:verifiedPhoneNumber'
export const verifyPhoneNumber = 'settings:verifyPhoneNumber'

// Action Creators
/**
 * Add a phone number and kick off a text message with a verification code.
 */
export const createAddPhoneNumber = (payload: {
  readonly searchable: boolean
  readonly phoneNumber: string
}) => ({payload, type: addPhoneNumber as typeof addPhoneNumber})
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
 * Resend verification code for a phone number that's already added.
 */
export const createResendVerificationForPhoneNumber = (payload: {readonly phoneNumber: string}) => ({
  payload,
  type: resendVerificationForPhoneNumber as typeof resendVerificationForPhoneNumber,
})
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
 * Submit a verification code for a phone number
 */
export const createVerifyPhoneNumber = (payload: {readonly phoneNumber: string; readonly code: string}) => ({
  payload,
  type: verifyPhoneNumber as typeof verifyPhoneNumber,
})
/**
 * Update unfurl settings from settings screen
 */
export const createUnfurlSettingsSaved = (payload: {
  readonly mode: RPCChatTypes.UnfurlMode
  readonly whitelist: Array<string>
}) => ({payload, type: unfurlSettingsSaved as typeof unfurlSettingsSaved})
/**
 * We just attempted to add a phone number and either got an error or the number is pending verification.
 */
export const createAddedPhoneNumber = (payload: {
  readonly searchable: boolean
  readonly error?: string
  readonly phoneNumber: string
}) => ({payload, type: addedPhoneNumber as typeof addedPhoneNumber})
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
export const createCertificatePinningToggled = (payload: {readonly toggled?: boolean} = {}) => ({
  payload,
  type: certificatePinningToggled as typeof certificatePinningToggled,
})
export const createCheckPassword = (payload: {readonly password: HiddenString}) => ({
  payload,
  type: checkPassword as typeof checkPassword,
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
export const createEditPhone = (payload: {
  readonly phone: string
  readonly delete?: boolean
  readonly setSearchable?: boolean
}) => ({payload, type: editPhone as typeof editPhone})
export const createImportContactsLater = (payload?: undefined) => ({
  payload,
  type: importContactsLater as typeof importContactsLater,
})
export const createInvitesClearError = (payload?: undefined) => ({
  payload,
  type: invitesClearError as typeof invitesClearError,
})
export const createInvitesReclaim = (payload: {readonly inviteId: string}) => ({
  payload,
  type: invitesReclaim as typeof invitesReclaim,
})
export const createInvitesRefresh = (payload?: undefined) => ({
  payload,
  type: invitesRefresh as typeof invitesRefresh,
})
export const createInvitesRefreshed = (payload: {readonly invites: Types.InvitesState}) => ({
  payload,
  type: invitesRefreshed as typeof invitesRefreshed,
})
export const createInvitesSend = (payload: {readonly email: string; readonly message?: string}) => ({
  payload,
  type: invitesSend as typeof invitesSend,
})
export const createInvitesSent = (payload: {readonly error?: Error} = {}) => ({
  payload,
  type: invitesSent as typeof invitesSent,
})
export const createLoadDefaultPhoneNumberCountry = (payload?: undefined) => ({
  payload,
  type: loadDefaultPhoneNumberCountry as typeof loadDefaultPhoneNumberCountry,
})
export const createLoadHasRandomPw = (payload?: undefined) => ({
  payload,
  type: loadHasRandomPw as typeof loadHasRandomPw,
})
export const createLoadLockdownMode = (payload?: undefined) => ({
  payload,
  type: loadLockdownMode as typeof loadLockdownMode,
})
export const createLoadProxyData = (payload?: undefined) => ({
  payload,
  type: loadProxyData as typeof loadProxyData,
})
export const createLoadRememberPassword = (payload?: undefined) => ({
  payload,
  type: loadRememberPassword as typeof loadRememberPassword,
})
export const createLoadSettings = (payload?: undefined) => ({
  payload,
  type: loadSettings as typeof loadSettings,
})
export const createLoadedCheckPassword = (payload: {readonly checkPasswordIsCorrect?: boolean} = {}) => ({
  payload,
  type: loadedCheckPassword as typeof loadedCheckPassword,
})
export const createLoadedContactImportEnabled = (payload: {readonly enabled: boolean}) => ({
  payload,
  type: loadedContactImportEnabled as typeof loadedContactImportEnabled,
})
export const createLoadedContactPermissions = (payload: {
  readonly status: 'granted' | 'denied' | 'undetermined'
}) => ({payload, type: loadedContactPermissions as typeof loadedContactPermissions})
export const createLoadedHasRandomPw = (payload: {readonly randomPW: boolean}) => ({
  payload,
  type: loadedHasRandomPw as typeof loadedHasRandomPw,
})
export const createLoadedLockdownMode = (payload: {readonly status?: boolean} = {}) => ({
  payload,
  type: loadedLockdownMode as typeof loadedLockdownMode,
})
export const createLoadedProxyData = (payload: {readonly proxyData: RPCTypes.ProxyData}) => ({
  payload,
  type: loadedProxyData as typeof loadedProxyData,
})
export const createLoadedRememberPassword = (payload: {readonly remember: boolean}) => ({
  payload,
  type: loadedRememberPassword as typeof loadedRememberPassword,
})
export const createLoadedSettings = (
  payload: {readonly emails?: Map<string, Types.EmailRow>; readonly phones?: Map<string, Types.PhoneRow>} = {}
) => ({payload, type: loadedSettings as typeof loadedSettings})
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
export const createOnChangeNewPassword = (payload: {readonly password: HiddenString}) => ({
  payload,
  type: onChangeNewPassword as typeof onChangeNewPassword,
})
export const createOnChangeNewPasswordConfirm = (payload: {readonly password: HiddenString}) => ({
  payload,
  type: onChangeNewPasswordConfirm as typeof onChangeNewPasswordConfirm,
})
export const createOnChangeRememberPassword = (payload: {readonly remember: boolean}) => ({
  payload,
  type: onChangeRememberPassword as typeof onChangeRememberPassword,
})
export const createOnChangeShowPassword = (payload?: undefined) => ({
  payload,
  type: onChangeShowPassword as typeof onChangeShowPassword,
})
export const createOnSubmitNewEmail = (payload?: undefined) => ({
  payload,
  type: onSubmitNewEmail as typeof onSubmitNewEmail,
})
export const createOnSubmitNewPassword = (payload: {readonly thenSignOut: boolean}) => ({
  payload,
  type: onSubmitNewPassword as typeof onSubmitNewPassword,
})
export const createOnUpdateEmailError = (payload: {readonly error: Error}) => ({
  payload,
  type: onUpdateEmailError as typeof onUpdateEmailError,
})
export const createOnUpdatePGPSettings = (payload?: undefined) => ({
  payload,
  type: onUpdatePGPSettings as typeof onUpdatePGPSettings,
})
export const createOnUpdatePasswordError = (payload: {readonly error: Error}) => ({
  payload,
  type: onUpdatePasswordError as typeof onUpdatePasswordError,
})
export const createOnUpdatedPGPSettings = (payload: {readonly hasKeys: boolean}) => ({
  payload,
  type: onUpdatedPGPSettings as typeof onUpdatedPGPSettings,
})
export const createProcessorProfile = (payload: {readonly durationSeconds: number}) => ({
  payload,
  type: processorProfile as typeof processorProfile,
})
export const createRequestContactPermissions = (
  payload: {readonly thenToggleImportOn?: boolean; readonly fromSettings?: boolean} = {}
) => ({payload, type: requestContactPermissions as typeof requestContactPermissions})
export const createResetCheckPasswordIsCorrect = (payload?: undefined) => ({
  payload,
  type: resetCheckPasswordIsCorrect as typeof resetCheckPasswordIsCorrect,
})
export const createSaveProxyData = (payload: {readonly proxyData: RPCTypes.ProxyData}) => ({
  payload,
  type: saveProxyData as typeof saveProxyData,
})
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
export const createUpdateDefaultPhoneNumberCountry = (payload: {readonly country: string}) => ({
  payload,
  type: updateDefaultPhoneNumberCountry as typeof updateDefaultPhoneNumberCountry,
})

// Action Payloads
export type AddEmailPayload = ReturnType<typeof createAddEmail>
export type AddPhoneNumberPayload = ReturnType<typeof createAddPhoneNumber>
export type AddedEmailPayload = ReturnType<typeof createAddedEmail>
export type AddedPhoneNumberPayload = ReturnType<typeof createAddedPhoneNumber>
export type CertificatePinningToggledPayload = ReturnType<typeof createCertificatePinningToggled>
export type CheckPasswordPayload = ReturnType<typeof createCheckPassword>
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
export type EditPhonePayload = ReturnType<typeof createEditPhone>
export type EmailVerifiedPayload = ReturnType<typeof createEmailVerified>
export type FeedbackSentPayload = ReturnType<typeof createFeedbackSent>
export type ImportContactsLaterPayload = ReturnType<typeof createImportContactsLater>
export type InvitesClearErrorPayload = ReturnType<typeof createInvitesClearError>
export type InvitesReclaimPayload = ReturnType<typeof createInvitesReclaim>
export type InvitesRefreshPayload = ReturnType<typeof createInvitesRefresh>
export type InvitesRefreshedPayload = ReturnType<typeof createInvitesRefreshed>
export type InvitesSendPayload = ReturnType<typeof createInvitesSend>
export type InvitesSentPayload = ReturnType<typeof createInvitesSent>
export type LoadContactImportEnabledPayload = ReturnType<typeof createLoadContactImportEnabled>
export type LoadDefaultPhoneNumberCountryPayload = ReturnType<typeof createLoadDefaultPhoneNumberCountry>
export type LoadHasRandomPwPayload = ReturnType<typeof createLoadHasRandomPw>
export type LoadLockdownModePayload = ReturnType<typeof createLoadLockdownMode>
export type LoadProxyDataPayload = ReturnType<typeof createLoadProxyData>
export type LoadRememberPasswordPayload = ReturnType<typeof createLoadRememberPassword>
export type LoadSettingsPayload = ReturnType<typeof createLoadSettings>
export type LoadedCheckPasswordPayload = ReturnType<typeof createLoadedCheckPassword>
export type LoadedContactImportEnabledPayload = ReturnType<typeof createLoadedContactImportEnabled>
export type LoadedContactPermissionsPayload = ReturnType<typeof createLoadedContactPermissions>
export type LoadedHasRandomPwPayload = ReturnType<typeof createLoadedHasRandomPw>
export type LoadedLockdownModePayload = ReturnType<typeof createLoadedLockdownMode>
export type LoadedProxyDataPayload = ReturnType<typeof createLoadedProxyData>
export type LoadedRememberPasswordPayload = ReturnType<typeof createLoadedRememberPassword>
export type LoadedSettingsPayload = ReturnType<typeof createLoadedSettings>
export type LoadedUserCountryCodePayload = ReturnType<typeof createLoadedUserCountryCode>
export type LoginBrowserViaWebAuthTokenPayload = ReturnType<typeof createLoginBrowserViaWebAuthToken>
export type NotificationsRefreshPayload = ReturnType<typeof createNotificationsRefresh>
export type NotificationsRefreshedPayload = ReturnType<typeof createNotificationsRefreshed>
export type NotificationsSavedPayload = ReturnType<typeof createNotificationsSaved>
export type NotificationsTogglePayload = ReturnType<typeof createNotificationsToggle>
export type OnChangeLockdownModePayload = ReturnType<typeof createOnChangeLockdownMode>
export type OnChangeNewEmailPayload = ReturnType<typeof createOnChangeNewEmail>
export type OnChangeNewPasswordConfirmPayload = ReturnType<typeof createOnChangeNewPasswordConfirm>
export type OnChangeNewPasswordPayload = ReturnType<typeof createOnChangeNewPassword>
export type OnChangeRememberPasswordPayload = ReturnType<typeof createOnChangeRememberPassword>
export type OnChangeShowPasswordPayload = ReturnType<typeof createOnChangeShowPassword>
export type OnSubmitNewEmailPayload = ReturnType<typeof createOnSubmitNewEmail>
export type OnSubmitNewPasswordPayload = ReturnType<typeof createOnSubmitNewPassword>
export type OnUpdateEmailErrorPayload = ReturnType<typeof createOnUpdateEmailError>
export type OnUpdatePGPSettingsPayload = ReturnType<typeof createOnUpdatePGPSettings>
export type OnUpdatePasswordErrorPayload = ReturnType<typeof createOnUpdatePasswordError>
export type OnUpdatedPGPSettingsPayload = ReturnType<typeof createOnUpdatedPGPSettings>
export type ProcessorProfilePayload = ReturnType<typeof createProcessorProfile>
export type RequestContactPermissionsPayload = ReturnType<typeof createRequestContactPermissions>
export type ResendVerificationForPhoneNumberPayload = ReturnType<
  typeof createResendVerificationForPhoneNumber
>
export type ResetCheckPasswordIsCorrectPayload = ReturnType<typeof createResetCheckPasswordIsCorrect>
export type SaveProxyDataPayload = ReturnType<typeof createSaveProxyData>
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
export type UpdateDefaultPhoneNumberCountryPayload = ReturnType<typeof createUpdateDefaultPhoneNumberCountry>
export type VerifiedPhoneNumberPayload = ReturnType<typeof createVerifiedPhoneNumber>
export type VerifyPhoneNumberPayload = ReturnType<typeof createVerifyPhoneNumber>

// All Actions
// prettier-ignore
export type Actions =
  | AddEmailPayload
  | AddPhoneNumberPayload
  | AddedEmailPayload
  | AddedPhoneNumberPayload
  | CertificatePinningToggledPayload
  | CheckPasswordPayload
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
  | EditPhonePayload
  | EmailVerifiedPayload
  | FeedbackSentPayload
  | ImportContactsLaterPayload
  | InvitesClearErrorPayload
  | InvitesReclaimPayload
  | InvitesRefreshPayload
  | InvitesRefreshedPayload
  | InvitesSendPayload
  | InvitesSentPayload
  | LoadContactImportEnabledPayload
  | LoadDefaultPhoneNumberCountryPayload
  | LoadHasRandomPwPayload
  | LoadLockdownModePayload
  | LoadProxyDataPayload
  | LoadRememberPasswordPayload
  | LoadSettingsPayload
  | LoadedCheckPasswordPayload
  | LoadedContactImportEnabledPayload
  | LoadedContactPermissionsPayload
  | LoadedHasRandomPwPayload
  | LoadedLockdownModePayload
  | LoadedProxyDataPayload
  | LoadedRememberPasswordPayload
  | LoadedSettingsPayload
  | LoadedUserCountryCodePayload
  | LoginBrowserViaWebAuthTokenPayload
  | NotificationsRefreshPayload
  | NotificationsRefreshedPayload
  | NotificationsSavedPayload
  | NotificationsTogglePayload
  | OnChangeLockdownModePayload
  | OnChangeNewEmailPayload
  | OnChangeNewPasswordConfirmPayload
  | OnChangeNewPasswordPayload
  | OnChangeRememberPasswordPayload
  | OnChangeShowPasswordPayload
  | OnSubmitNewEmailPayload
  | OnSubmitNewPasswordPayload
  | OnUpdateEmailErrorPayload
  | OnUpdatePGPSettingsPayload
  | OnUpdatePasswordErrorPayload
  | OnUpdatedPGPSettingsPayload
  | ProcessorProfilePayload
  | RequestContactPermissionsPayload
  | ResendVerificationForPhoneNumberPayload
  | ResetCheckPasswordIsCorrectPayload
  | SaveProxyDataPayload
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
  | UpdateDefaultPhoneNumberCountryPayload
  | VerifiedPhoneNumberPayload
  | VerifyPhoneNumberPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
