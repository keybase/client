// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/settings'
import HiddenString from '../util/hidden-string'

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
export const clearAddingEmail = 'settings:clearAddingEmail'
export const clearPhoneNumberAdd = 'settings:clearPhoneNumberAdd'
export const clearPhoneNumberErrors = 'settings:clearPhoneNumberErrors'
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
export const editContactImportEnabled = 'settings:editContactImportEnabled'
export const editEmail = 'settings:editEmail'
export const editPhone = 'settings:editPhone'
export const feedbackSent = 'settings:feedbackSent'
export const importContactsLater = 'settings:importContactsLater'
export const invitesClearError = 'settings:invitesClearError'
export const invitesReclaim = 'settings:invitesReclaim'
export const invitesReclaimed = 'settings:invitesReclaimed'
export const invitesRefresh = 'settings:invitesRefresh'
export const invitesRefreshed = 'settings:invitesRefreshed'
export const invitesSend = 'settings:invitesSend'
export const invitesSent = 'settings:invitesSent'
export const loadContactImportEnabled = 'settings:loadContactImportEnabled'
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
export const onChangeUseNativeFrame = 'settings:onChangeUseNativeFrame'
export const onSubmitNewEmail = 'settings:onSubmitNewEmail'
export const onSubmitNewPassword = 'settings:onSubmitNewPassword'
export const onUpdateEmailError = 'settings:onUpdateEmailError'
export const onUpdatePGPSettings = 'settings:onUpdatePGPSettings'
export const onUpdatePasswordError = 'settings:onUpdatePasswordError'
export const onUpdatedPGPSettings = 'settings:onUpdatedPGPSettings'
export const processorProfile = 'settings:processorProfile'
export const requestContactPermissions = 'settings:requestContactPermissions'
export const resendVerificationForPhoneNumber = 'settings:resendVerificationForPhoneNumber'
export const saveProxyData = 'settings:saveProxyData'
export const sendFeedback = 'settings:sendFeedback'
export const sentVerificationEmail = 'settings:sentVerificationEmail'
export const setAllowDeleteAccount = 'settings:setAllowDeleteAccount'
export const setContactImportedCount = 'settings:setContactImportedCount'
export const stop = 'settings:stop'
export const toggleRuntimeStats = 'settings:toggleRuntimeStats'
export const trace = 'settings:trace'
export const unfurlSettingsError = 'settings:unfurlSettingsError'
export const unfurlSettingsRefresh = 'settings:unfurlSettingsRefresh'
export const unfurlSettingsRefreshed = 'settings:unfurlSettingsRefreshed'
export const unfurlSettingsSaved = 'settings:unfurlSettingsSaved'
export const verifiedPhoneNumber = 'settings:verifiedPhoneNumber'
export const verifyPhoneNumber = 'settings:verifyPhoneNumber'

// Payload Types
type _AddEmailPayload = {readonly email: string; readonly searchable: boolean}
type _AddPhoneNumberPayload = {readonly allowSearch: boolean; readonly phoneNumber: string}
type _AddedEmailPayload = {readonly email: string; readonly error?: Error}
type _AddedPhoneNumberPayload = {
  readonly allowSearch: boolean
  readonly error?: string
  readonly phoneNumber: string
}
type _CertificatePinningToggledPayload = {readonly toggled: boolean | null}
type _CheckPasswordPayload = {readonly password: HiddenString}
type _ClearAddedEmailPayload = void
type _ClearAddingEmailPayload = void
type _ClearPhoneNumberAddPayload = void
type _ClearPhoneNumberErrorsPayload = void
type _DbNukePayload = void
type _DeleteAccountForeverPayload = void
type _EditContactImportEnabledPayload = {readonly enable: boolean}
type _EditEmailPayload = {
  readonly email: string
  readonly delete?: boolean
  readonly makePrimary?: boolean
  readonly makeSearchable?: boolean | null
  readonly verify?: boolean
}
type _EditPhonePayload = {readonly phone: string; readonly delete?: boolean; readonly setSearchable?: boolean}
type _FeedbackSentPayload = {readonly error: Error | null}
type _ImportContactsLaterPayload = void
type _InvitesClearErrorPayload = void
type _InvitesReclaimPayload = {readonly inviteId: string}
type _InvitesReclaimedPayload = void
type _InvitesReclaimedPayloadError = {readonly errorText: string}
type _InvitesRefreshPayload = void
type _InvitesRefreshedPayload = {readonly invites: Types._InvitesState}
type _InvitesSendPayload = {readonly email: string; readonly message: string | null}
type _InvitesSentPayload = void
type _InvitesSentPayloadError = {readonly error: Error}
type _LoadContactImportEnabledPayload = void
type _LoadHasRandomPwPayload = void
type _LoadLockdownModePayload = void
type _LoadProxyDataPayload = void
type _LoadRememberPasswordPayload = void
type _LoadSettingsPayload = void
type _LoadedCheckPasswordPayload = {readonly checkPasswordIsCorrect: boolean | null}
type _LoadedContactImportEnabledPayload = {readonly enabled: boolean}
type _LoadedContactPermissionsPayload = {readonly status: 'granted' | 'never_ask_again' | 'undetermined'}
type _LoadedHasRandomPwPayload = {readonly randomPW: boolean}
type _LoadedLockdownModePayload = {readonly status: boolean | null}
type _LoadedProxyDataPayload = {readonly proxyData: RPCTypes.ProxyData}
type _LoadedRememberPasswordPayload = {readonly remember: boolean}
type _LoadedSettingsPayload = {
  readonly emails: I.Map<string, Types.EmailRow> | null
  readonly phones: I.Map<string, Types.PhoneRow> | null
}
type _LoadedUserCountryCodePayload = {readonly code: string | null}
type _NotificationsRefreshPayload = void
type _NotificationsRefreshedPayload = {readonly notifications: I.Map<string, Types.NotificationsGroupState>}
type _NotificationsSavedPayload = void
type _NotificationsTogglePayload = {readonly group: string; readonly name?: string | null}
type _OnChangeLockdownModePayload = {readonly enabled: boolean}
type _OnChangeNewEmailPayload = {readonly email: string}
type _OnChangeNewPasswordConfirmPayload = {readonly password: HiddenString}
type _OnChangeNewPasswordPayload = {readonly password: HiddenString}
type _OnChangeRememberPasswordPayload = {readonly remember: boolean}
type _OnChangeShowPasswordPayload = void
type _OnChangeUseNativeFramePayload = {readonly enabled: boolean}
type _OnSubmitNewEmailPayload = void
type _OnSubmitNewPasswordPayload = {readonly thenSignOut: boolean}
type _OnUpdateEmailErrorPayload = {readonly error: Error}
type _OnUpdatePGPSettingsPayload = void
type _OnUpdatePasswordErrorPayload = {readonly error: Error}
type _OnUpdatedPGPSettingsPayload = {readonly hasKeys: boolean}
type _ProcessorProfilePayload = {readonly durationSeconds: number}
type _RequestContactPermissionsPayload = {readonly thenToggleImportOn?: boolean}
type _ResendVerificationForPhoneNumberPayload = {readonly phoneNumber: string}
type _SaveProxyDataPayload = {readonly proxyData: RPCTypes.ProxyData}
type _SendFeedbackPayload = {
  readonly feedback: string
  readonly sendLogs: boolean
  readonly sendMaxBytes: boolean
}
type _SentVerificationEmailPayload = {readonly email: string}
type _SetAllowDeleteAccountPayload = {readonly allow: boolean}
type _SetContactImportedCountPayload = {readonly count: number | null}
type _StopPayload = {readonly exitCode: RPCTypes.ExitCode}
type _ToggleRuntimeStatsPayload = void
type _TracePayload = {readonly durationSeconds: number}
type _UnfurlSettingsErrorPayload = {readonly error: string}
type _UnfurlSettingsRefreshPayload = void
type _UnfurlSettingsRefreshedPayload = {
  readonly mode: RPCChatTypes.UnfurlMode
  readonly whitelist: I.List<string>
}
type _UnfurlSettingsSavedPayload = {
  readonly mode: RPCChatTypes.UnfurlMode
  readonly whitelist: I.List<string>
}
type _VerifiedPhoneNumberPayload = {readonly error?: string; readonly phoneNumber: string}
type _VerifyPhoneNumberPayload = {readonly phoneNumber: string; readonly code: string}

// Action Creators
/**
 * Add a phone number and kick off a text message with a verification code.
 */
export const createAddPhoneNumber = (payload: _AddPhoneNumberPayload): AddPhoneNumberPayload => ({
  payload,
  type: addPhoneNumber,
})
/**
 * An error occurred on the unfurl settings screen
 */
export const createUnfurlSettingsError = (
  payload: _UnfurlSettingsErrorPayload
): UnfurlSettingsErrorPayload => ({payload, type: unfurlSettingsError})
/**
 * An error occurred while trying to send feedback to Keybase
 */
export const createFeedbackSent = (payload: _FeedbackSentPayload): FeedbackSentPayload => ({
  payload,
  type: feedbackSent,
})
/**
 * Cancel adding a phone number.
 */
export const createClearPhoneNumberAdd = (
  payload: _ClearPhoneNumberAddPayload
): ClearPhoneNumberAddPayload => ({payload, type: clearPhoneNumberAdd})
/**
 * Clear only error from phone number add flow.
 */
export const createClearPhoneNumberErrors = (
  payload: _ClearPhoneNumberErrorsPayload
): ClearPhoneNumberErrorsPayload => ({payload, type: clearPhoneNumberErrors})
/**
 * Load whether config says we've enabled contact importing and check OS contacts permission status.
 */
export const createLoadContactImportEnabled = (
  payload: _LoadContactImportEnabledPayload
): LoadContactImportEnabledPayload => ({payload, type: loadContactImportEnabled})
/**
 * Refresh unfurl settings
 */
export const createUnfurlSettingsRefresh = (
  payload: _UnfurlSettingsRefreshPayload
): UnfurlSettingsRefreshPayload => ({payload, type: unfurlSettingsRefresh})
/**
 * Refreshed unfurl settings available
 */
export const createUnfurlSettingsRefreshed = (
  payload: _UnfurlSettingsRefreshedPayload
): UnfurlSettingsRefreshedPayload => ({payload, type: unfurlSettingsRefreshed})
/**
 * Resend verification code for a phone number that's already added.
 */
export const createResendVerificationForPhoneNumber = (
  payload: _ResendVerificationForPhoneNumberPayload
): ResendVerificationForPhoneNumberPayload => ({payload, type: resendVerificationForPhoneNumber})
/**
 * Reset state used for adding an email.
 */
export const createClearAddingEmail = (payload: _ClearAddingEmailPayload): ClearAddingEmailPayload => ({
  payload,
  type: clearAddingEmail,
})
/**
 * Reset state used for showing we just added an email.
 */
export const createClearAddedEmail = (payload: _ClearAddedEmailPayload): ClearAddedEmailPayload => ({
  payload,
  type: clearAddedEmail,
})
/**
 * Submit a verification code for a phone number
 */
export const createVerifyPhoneNumber = (payload: _VerifyPhoneNumberPayload): VerifyPhoneNumberPayload => ({
  payload,
  type: verifyPhoneNumber,
})
/**
 * Update unfurl settings from settings screen
 */
export const createUnfurlSettingsSaved = (
  payload: _UnfurlSettingsSavedPayload
): UnfurlSettingsSavedPayload => ({payload, type: unfurlSettingsSaved})
/**
 * We just attempted to add a phone number and either got an error or the number is pending verification.
 */
export const createAddedPhoneNumber = (payload: _AddedPhoneNumberPayload): AddedPhoneNumberPayload => ({
  payload,
  type: addedPhoneNumber,
})
/**
 * We verified a phone number or hit an error.
 */
export const createVerifiedPhoneNumber = (
  payload: _VerifiedPhoneNumberPayload
): VerifiedPhoneNumberPayload => ({payload, type: verifiedPhoneNumber})
export const createAddEmail = (payload: _AddEmailPayload): AddEmailPayload => ({payload, type: addEmail})
export const createAddedEmail = (payload: _AddedEmailPayload): AddedEmailPayload => ({
  payload,
  type: addedEmail,
})
export const createCertificatePinningToggled = (
  payload: _CertificatePinningToggledPayload
): CertificatePinningToggledPayload => ({payload, type: certificatePinningToggled})
export const createCheckPassword = (payload: _CheckPasswordPayload): CheckPasswordPayload => ({
  payload,
  type: checkPassword,
})
export const createDbNuke = (payload: _DbNukePayload): DbNukePayload => ({payload, type: dbNuke})
export const createDeleteAccountForever = (
  payload: _DeleteAccountForeverPayload
): DeleteAccountForeverPayload => ({payload, type: deleteAccountForever})
export const createEditContactImportEnabled = (
  payload: _EditContactImportEnabledPayload
): EditContactImportEnabledPayload => ({payload, type: editContactImportEnabled})
export const createEditEmail = (payload: _EditEmailPayload): EditEmailPayload => ({payload, type: editEmail})
export const createEditPhone = (payload: _EditPhonePayload): EditPhonePayload => ({payload, type: editPhone})
export const createImportContactsLater = (
  payload: _ImportContactsLaterPayload
): ImportContactsLaterPayload => ({payload, type: importContactsLater})
export const createInvitesClearError = (payload: _InvitesClearErrorPayload): InvitesClearErrorPayload => ({
  payload,
  type: invitesClearError,
})
export const createInvitesReclaim = (payload: _InvitesReclaimPayload): InvitesReclaimPayload => ({
  payload,
  type: invitesReclaim,
})
export const createInvitesReclaimed = (payload: _InvitesReclaimedPayload): InvitesReclaimedPayload => ({
  payload,
  type: invitesReclaimed,
})
export const createInvitesReclaimedError = (
  payload: _InvitesReclaimedPayloadError
): InvitesReclaimedPayloadError => ({error: true, payload, type: invitesReclaimed})
export const createInvitesRefresh = (payload: _InvitesRefreshPayload): InvitesRefreshPayload => ({
  payload,
  type: invitesRefresh,
})
export const createInvitesRefreshed = (payload: _InvitesRefreshedPayload): InvitesRefreshedPayload => ({
  payload,
  type: invitesRefreshed,
})
export const createInvitesSend = (payload: _InvitesSendPayload): InvitesSendPayload => ({
  payload,
  type: invitesSend,
})
export const createInvitesSent = (payload: _InvitesSentPayload): InvitesSentPayload => ({
  payload,
  type: invitesSent,
})
export const createInvitesSentError = (payload: _InvitesSentPayloadError): InvitesSentPayloadError => ({
  error: true,
  payload,
  type: invitesSent,
})
export const createLoadHasRandomPw = (payload: _LoadHasRandomPwPayload): LoadHasRandomPwPayload => ({
  payload,
  type: loadHasRandomPw,
})
export const createLoadLockdownMode = (payload: _LoadLockdownModePayload): LoadLockdownModePayload => ({
  payload,
  type: loadLockdownMode,
})
export const createLoadProxyData = (payload: _LoadProxyDataPayload): LoadProxyDataPayload => ({
  payload,
  type: loadProxyData,
})
export const createLoadRememberPassword = (
  payload: _LoadRememberPasswordPayload
): LoadRememberPasswordPayload => ({payload, type: loadRememberPassword})
export const createLoadSettings = (payload: _LoadSettingsPayload): LoadSettingsPayload => ({
  payload,
  type: loadSettings,
})
export const createLoadedCheckPassword = (
  payload: _LoadedCheckPasswordPayload
): LoadedCheckPasswordPayload => ({payload, type: loadedCheckPassword})
export const createLoadedContactImportEnabled = (
  payload: _LoadedContactImportEnabledPayload
): LoadedContactImportEnabledPayload => ({payload, type: loadedContactImportEnabled})
export const createLoadedContactPermissions = (
  payload: _LoadedContactPermissionsPayload
): LoadedContactPermissionsPayload => ({payload, type: loadedContactPermissions})
export const createLoadedHasRandomPw = (payload: _LoadedHasRandomPwPayload): LoadedHasRandomPwPayload => ({
  payload,
  type: loadedHasRandomPw,
})
export const createLoadedLockdownMode = (payload: _LoadedLockdownModePayload): LoadedLockdownModePayload => ({
  payload,
  type: loadedLockdownMode,
})
export const createLoadedProxyData = (payload: _LoadedProxyDataPayload): LoadedProxyDataPayload => ({
  payload,
  type: loadedProxyData,
})
export const createLoadedRememberPassword = (
  payload: _LoadedRememberPasswordPayload
): LoadedRememberPasswordPayload => ({payload, type: loadedRememberPassword})
export const createLoadedSettings = (payload: _LoadedSettingsPayload): LoadedSettingsPayload => ({
  payload,
  type: loadedSettings,
})
export const createLoadedUserCountryCode = (
  payload: _LoadedUserCountryCodePayload
): LoadedUserCountryCodePayload => ({payload, type: loadedUserCountryCode})
export const createNotificationsRefresh = (
  payload: _NotificationsRefreshPayload
): NotificationsRefreshPayload => ({payload, type: notificationsRefresh})
export const createNotificationsRefreshed = (
  payload: _NotificationsRefreshedPayload
): NotificationsRefreshedPayload => ({payload, type: notificationsRefreshed})
export const createNotificationsSaved = (payload: _NotificationsSavedPayload): NotificationsSavedPayload => ({
  payload,
  type: notificationsSaved,
})
export const createNotificationsToggle = (
  payload: _NotificationsTogglePayload
): NotificationsTogglePayload => ({payload, type: notificationsToggle})
export const createOnChangeLockdownMode = (
  payload: _OnChangeLockdownModePayload
): OnChangeLockdownModePayload => ({payload, type: onChangeLockdownMode})
export const createOnChangeNewEmail = (payload: _OnChangeNewEmailPayload): OnChangeNewEmailPayload => ({
  payload,
  type: onChangeNewEmail,
})
export const createOnChangeNewPassword = (
  payload: _OnChangeNewPasswordPayload
): OnChangeNewPasswordPayload => ({payload, type: onChangeNewPassword})
export const createOnChangeNewPasswordConfirm = (
  payload: _OnChangeNewPasswordConfirmPayload
): OnChangeNewPasswordConfirmPayload => ({payload, type: onChangeNewPasswordConfirm})
export const createOnChangeRememberPassword = (
  payload: _OnChangeRememberPasswordPayload
): OnChangeRememberPasswordPayload => ({payload, type: onChangeRememberPassword})
export const createOnChangeShowPassword = (
  payload: _OnChangeShowPasswordPayload
): OnChangeShowPasswordPayload => ({payload, type: onChangeShowPassword})
export const createOnChangeUseNativeFrame = (
  payload: _OnChangeUseNativeFramePayload
): OnChangeUseNativeFramePayload => ({payload, type: onChangeUseNativeFrame})
export const createOnSubmitNewEmail = (payload: _OnSubmitNewEmailPayload): OnSubmitNewEmailPayload => ({
  payload,
  type: onSubmitNewEmail,
})
export const createOnSubmitNewPassword = (
  payload: _OnSubmitNewPasswordPayload
): OnSubmitNewPasswordPayload => ({payload, type: onSubmitNewPassword})
export const createOnUpdateEmailError = (payload: _OnUpdateEmailErrorPayload): OnUpdateEmailErrorPayload => ({
  payload,
  type: onUpdateEmailError,
})
export const createOnUpdatePGPSettings = (
  payload: _OnUpdatePGPSettingsPayload
): OnUpdatePGPSettingsPayload => ({payload, type: onUpdatePGPSettings})
export const createOnUpdatePasswordError = (
  payload: _OnUpdatePasswordErrorPayload
): OnUpdatePasswordErrorPayload => ({payload, type: onUpdatePasswordError})
export const createOnUpdatedPGPSettings = (
  payload: _OnUpdatedPGPSettingsPayload
): OnUpdatedPGPSettingsPayload => ({payload, type: onUpdatedPGPSettings})
export const createProcessorProfile = (payload: _ProcessorProfilePayload): ProcessorProfilePayload => ({
  payload,
  type: processorProfile,
})
export const createRequestContactPermissions = (
  payload: _RequestContactPermissionsPayload = Object.freeze({})
): RequestContactPermissionsPayload => ({payload, type: requestContactPermissions})
export const createSaveProxyData = (payload: _SaveProxyDataPayload): SaveProxyDataPayload => ({
  payload,
  type: saveProxyData,
})
export const createSendFeedback = (payload: _SendFeedbackPayload): SendFeedbackPayload => ({
  payload,
  type: sendFeedback,
})
export const createSentVerificationEmail = (
  payload: _SentVerificationEmailPayload
): SentVerificationEmailPayload => ({payload, type: sentVerificationEmail})
export const createSetAllowDeleteAccount = (
  payload: _SetAllowDeleteAccountPayload
): SetAllowDeleteAccountPayload => ({payload, type: setAllowDeleteAccount})
export const createSetContactImportedCount = (
  payload: _SetContactImportedCountPayload
): SetContactImportedCountPayload => ({payload, type: setContactImportedCount})
export const createStop = (payload: _StopPayload): StopPayload => ({payload, type: stop})
export const createToggleRuntimeStats = (payload: _ToggleRuntimeStatsPayload): ToggleRuntimeStatsPayload => ({
  payload,
  type: toggleRuntimeStats,
})
export const createTrace = (payload: _TracePayload): TracePayload => ({payload, type: trace})

// Action Payloads
export type AddEmailPayload = {readonly payload: _AddEmailPayload; readonly type: typeof addEmail}
export type AddPhoneNumberPayload = {
  readonly payload: _AddPhoneNumberPayload
  readonly type: typeof addPhoneNumber
}
export type AddedEmailPayload = {readonly payload: _AddedEmailPayload; readonly type: typeof addedEmail}
export type AddedPhoneNumberPayload = {
  readonly payload: _AddedPhoneNumberPayload
  readonly type: typeof addedPhoneNumber
}
export type CertificatePinningToggledPayload = {
  readonly payload: _CertificatePinningToggledPayload
  readonly type: typeof certificatePinningToggled
}
export type CheckPasswordPayload = {
  readonly payload: _CheckPasswordPayload
  readonly type: typeof checkPassword
}
export type ClearAddedEmailPayload = {
  readonly payload: _ClearAddedEmailPayload
  readonly type: typeof clearAddedEmail
}
export type ClearAddingEmailPayload = {
  readonly payload: _ClearAddingEmailPayload
  readonly type: typeof clearAddingEmail
}
export type ClearPhoneNumberAddPayload = {
  readonly payload: _ClearPhoneNumberAddPayload
  readonly type: typeof clearPhoneNumberAdd
}
export type ClearPhoneNumberErrorsPayload = {
  readonly payload: _ClearPhoneNumberErrorsPayload
  readonly type: typeof clearPhoneNumberErrors
}
export type DbNukePayload = {readonly payload: _DbNukePayload; readonly type: typeof dbNuke}
export type DeleteAccountForeverPayload = {
  readonly payload: _DeleteAccountForeverPayload
  readonly type: typeof deleteAccountForever
}
export type EditContactImportEnabledPayload = {
  readonly payload: _EditContactImportEnabledPayload
  readonly type: typeof editContactImportEnabled
}
export type EditEmailPayload = {readonly payload: _EditEmailPayload; readonly type: typeof editEmail}
export type EditPhonePayload = {readonly payload: _EditPhonePayload; readonly type: typeof editPhone}
export type FeedbackSentPayload = {readonly payload: _FeedbackSentPayload; readonly type: typeof feedbackSent}
export type ImportContactsLaterPayload = {
  readonly payload: _ImportContactsLaterPayload
  readonly type: typeof importContactsLater
}
export type InvitesClearErrorPayload = {
  readonly payload: _InvitesClearErrorPayload
  readonly type: typeof invitesClearError
}
export type InvitesReclaimPayload = {
  readonly payload: _InvitesReclaimPayload
  readonly type: typeof invitesReclaim
}
export type InvitesReclaimedPayload = {
  readonly payload: _InvitesReclaimedPayload
  readonly type: typeof invitesReclaimed
}
export type InvitesReclaimedPayloadError = {
  readonly error: true
  readonly payload: _InvitesReclaimedPayloadError
  readonly type: typeof invitesReclaimed
}
export type InvitesRefreshPayload = {
  readonly payload: _InvitesRefreshPayload
  readonly type: typeof invitesRefresh
}
export type InvitesRefreshedPayload = {
  readonly payload: _InvitesRefreshedPayload
  readonly type: typeof invitesRefreshed
}
export type InvitesSendPayload = {readonly payload: _InvitesSendPayload; readonly type: typeof invitesSend}
export type InvitesSentPayload = {readonly payload: _InvitesSentPayload; readonly type: typeof invitesSent}
export type InvitesSentPayloadError = {
  readonly error: true
  readonly payload: _InvitesSentPayloadError
  readonly type: typeof invitesSent
}
export type LoadContactImportEnabledPayload = {
  readonly payload: _LoadContactImportEnabledPayload
  readonly type: typeof loadContactImportEnabled
}
export type LoadHasRandomPwPayload = {
  readonly payload: _LoadHasRandomPwPayload
  readonly type: typeof loadHasRandomPw
}
export type LoadLockdownModePayload = {
  readonly payload: _LoadLockdownModePayload
  readonly type: typeof loadLockdownMode
}
export type LoadProxyDataPayload = {
  readonly payload: _LoadProxyDataPayload
  readonly type: typeof loadProxyData
}
export type LoadRememberPasswordPayload = {
  readonly payload: _LoadRememberPasswordPayload
  readonly type: typeof loadRememberPassword
}
export type LoadSettingsPayload = {readonly payload: _LoadSettingsPayload; readonly type: typeof loadSettings}
export type LoadedCheckPasswordPayload = {
  readonly payload: _LoadedCheckPasswordPayload
  readonly type: typeof loadedCheckPassword
}
export type LoadedContactImportEnabledPayload = {
  readonly payload: _LoadedContactImportEnabledPayload
  readonly type: typeof loadedContactImportEnabled
}
export type LoadedContactPermissionsPayload = {
  readonly payload: _LoadedContactPermissionsPayload
  readonly type: typeof loadedContactPermissions
}
export type LoadedHasRandomPwPayload = {
  readonly payload: _LoadedHasRandomPwPayload
  readonly type: typeof loadedHasRandomPw
}
export type LoadedLockdownModePayload = {
  readonly payload: _LoadedLockdownModePayload
  readonly type: typeof loadedLockdownMode
}
export type LoadedProxyDataPayload = {
  readonly payload: _LoadedProxyDataPayload
  readonly type: typeof loadedProxyData
}
export type LoadedRememberPasswordPayload = {
  readonly payload: _LoadedRememberPasswordPayload
  readonly type: typeof loadedRememberPassword
}
export type LoadedSettingsPayload = {
  readonly payload: _LoadedSettingsPayload
  readonly type: typeof loadedSettings
}
export type LoadedUserCountryCodePayload = {
  readonly payload: _LoadedUserCountryCodePayload
  readonly type: typeof loadedUserCountryCode
}
export type NotificationsRefreshPayload = {
  readonly payload: _NotificationsRefreshPayload
  readonly type: typeof notificationsRefresh
}
export type NotificationsRefreshedPayload = {
  readonly payload: _NotificationsRefreshedPayload
  readonly type: typeof notificationsRefreshed
}
export type NotificationsSavedPayload = {
  readonly payload: _NotificationsSavedPayload
  readonly type: typeof notificationsSaved
}
export type NotificationsTogglePayload = {
  readonly payload: _NotificationsTogglePayload
  readonly type: typeof notificationsToggle
}
export type OnChangeLockdownModePayload = {
  readonly payload: _OnChangeLockdownModePayload
  readonly type: typeof onChangeLockdownMode
}
export type OnChangeNewEmailPayload = {
  readonly payload: _OnChangeNewEmailPayload
  readonly type: typeof onChangeNewEmail
}
export type OnChangeNewPasswordConfirmPayload = {
  readonly payload: _OnChangeNewPasswordConfirmPayload
  readonly type: typeof onChangeNewPasswordConfirm
}
export type OnChangeNewPasswordPayload = {
  readonly payload: _OnChangeNewPasswordPayload
  readonly type: typeof onChangeNewPassword
}
export type OnChangeRememberPasswordPayload = {
  readonly payload: _OnChangeRememberPasswordPayload
  readonly type: typeof onChangeRememberPassword
}
export type OnChangeShowPasswordPayload = {
  readonly payload: _OnChangeShowPasswordPayload
  readonly type: typeof onChangeShowPassword
}
export type OnChangeUseNativeFramePayload = {
  readonly payload: _OnChangeUseNativeFramePayload
  readonly type: typeof onChangeUseNativeFrame
}
export type OnSubmitNewEmailPayload = {
  readonly payload: _OnSubmitNewEmailPayload
  readonly type: typeof onSubmitNewEmail
}
export type OnSubmitNewPasswordPayload = {
  readonly payload: _OnSubmitNewPasswordPayload
  readonly type: typeof onSubmitNewPassword
}
export type OnUpdateEmailErrorPayload = {
  readonly payload: _OnUpdateEmailErrorPayload
  readonly type: typeof onUpdateEmailError
}
export type OnUpdatePGPSettingsPayload = {
  readonly payload: _OnUpdatePGPSettingsPayload
  readonly type: typeof onUpdatePGPSettings
}
export type OnUpdatePasswordErrorPayload = {
  readonly payload: _OnUpdatePasswordErrorPayload
  readonly type: typeof onUpdatePasswordError
}
export type OnUpdatedPGPSettingsPayload = {
  readonly payload: _OnUpdatedPGPSettingsPayload
  readonly type: typeof onUpdatedPGPSettings
}
export type ProcessorProfilePayload = {
  readonly payload: _ProcessorProfilePayload
  readonly type: typeof processorProfile
}
export type RequestContactPermissionsPayload = {
  readonly payload: _RequestContactPermissionsPayload
  readonly type: typeof requestContactPermissions
}
export type ResendVerificationForPhoneNumberPayload = {
  readonly payload: _ResendVerificationForPhoneNumberPayload
  readonly type: typeof resendVerificationForPhoneNumber
}
export type SaveProxyDataPayload = {
  readonly payload: _SaveProxyDataPayload
  readonly type: typeof saveProxyData
}
export type SendFeedbackPayload = {readonly payload: _SendFeedbackPayload; readonly type: typeof sendFeedback}
export type SentVerificationEmailPayload = {
  readonly payload: _SentVerificationEmailPayload
  readonly type: typeof sentVerificationEmail
}
export type SetAllowDeleteAccountPayload = {
  readonly payload: _SetAllowDeleteAccountPayload
  readonly type: typeof setAllowDeleteAccount
}
export type SetContactImportedCountPayload = {
  readonly payload: _SetContactImportedCountPayload
  readonly type: typeof setContactImportedCount
}
export type StopPayload = {readonly payload: _StopPayload; readonly type: typeof stop}
export type ToggleRuntimeStatsPayload = {
  readonly payload: _ToggleRuntimeStatsPayload
  readonly type: typeof toggleRuntimeStats
}
export type TracePayload = {readonly payload: _TracePayload; readonly type: typeof trace}
export type UnfurlSettingsErrorPayload = {
  readonly payload: _UnfurlSettingsErrorPayload
  readonly type: typeof unfurlSettingsError
}
export type UnfurlSettingsRefreshPayload = {
  readonly payload: _UnfurlSettingsRefreshPayload
  readonly type: typeof unfurlSettingsRefresh
}
export type UnfurlSettingsRefreshedPayload = {
  readonly payload: _UnfurlSettingsRefreshedPayload
  readonly type: typeof unfurlSettingsRefreshed
}
export type UnfurlSettingsSavedPayload = {
  readonly payload: _UnfurlSettingsSavedPayload
  readonly type: typeof unfurlSettingsSaved
}
export type VerifiedPhoneNumberPayload = {
  readonly payload: _VerifiedPhoneNumberPayload
  readonly type: typeof verifiedPhoneNumber
}
export type VerifyPhoneNumberPayload = {
  readonly payload: _VerifyPhoneNumberPayload
  readonly type: typeof verifyPhoneNumber
}

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
  | ClearAddingEmailPayload
  | ClearPhoneNumberAddPayload
  | ClearPhoneNumberErrorsPayload
  | DbNukePayload
  | DeleteAccountForeverPayload
  | EditContactImportEnabledPayload
  | EditEmailPayload
  | EditPhonePayload
  | FeedbackSentPayload
  | ImportContactsLaterPayload
  | InvitesClearErrorPayload
  | InvitesReclaimPayload
  | InvitesReclaimedPayload
  | InvitesReclaimedPayloadError
  | InvitesRefreshPayload
  | InvitesRefreshedPayload
  | InvitesSendPayload
  | InvitesSentPayload
  | InvitesSentPayloadError
  | LoadContactImportEnabledPayload
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
  | OnChangeUseNativeFramePayload
  | OnSubmitNewEmailPayload
  | OnSubmitNewPasswordPayload
  | OnUpdateEmailErrorPayload
  | OnUpdatePGPSettingsPayload
  | OnUpdatePasswordErrorPayload
  | OnUpdatedPGPSettingsPayload
  | ProcessorProfilePayload
  | RequestContactPermissionsPayload
  | ResendVerificationForPhoneNumberPayload
  | SaveProxyDataPayload
  | SendFeedbackPayload
  | SentVerificationEmailPayload
  | SetAllowDeleteAccountPayload
  | SetContactImportedCountPayload
  | StopPayload
  | ToggleRuntimeStatsPayload
  | TracePayload
  | UnfurlSettingsErrorPayload
  | UnfurlSettingsRefreshPayload
  | UnfurlSettingsRefreshedPayload
  | UnfurlSettingsSavedPayload
  | VerifiedPhoneNumberPayload
  | VerifyPhoneNumberPayload
  | {type: 'common:resetStore', payload: {}}
