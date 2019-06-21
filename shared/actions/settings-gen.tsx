// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/settings'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const addPhoneNumber = 'settings:addPhoneNumber'
export const addedPhoneNumber = 'settings:addedPhoneNumber'
export const certificatePinningToggled = 'settings:certificatePinningToggled'
export const checkPassword = 'settings:checkPassword'
export const clearPhoneNumberVerification = 'settings:clearPhoneNumberVerification'
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
export const editEmail = 'settings:editEmail'
export const editPhone = 'settings:editPhone'
export const feedbackSent = 'settings:feedbackSent'
export const invitesClearError = 'settings:invitesClearError'
export const invitesReclaim = 'settings:invitesReclaim'
export const invitesReclaimed = 'settings:invitesReclaimed'
export const invitesRefresh = 'settings:invitesRefresh'
export const invitesRefreshed = 'settings:invitesRefreshed'
export const invitesSend = 'settings:invitesSend'
export const invitesSent = 'settings:invitesSent'
export const loadHasRandomPw = 'settings:loadHasRandomPw'
export const loadLockdownMode = 'settings:loadLockdownMode'
export const loadProxyData = 'settings:loadProxyData'
export const loadRememberPassword = 'settings:loadRememberPassword'
export const loadSettings = 'settings:loadSettings'
export const loadedCheckPassword = 'settings:loadedCheckPassword'
export const loadedHasRandomPw = 'settings:loadedHasRandomPw'
export const loadedLockdownMode = 'settings:loadedLockdownMode'
export const loadedProxyData = 'settings:loadedProxyData'
export const loadedRememberPassword = 'settings:loadedRememberPassword'
export const loadedSettings = 'settings:loadedSettings'
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
export const saveProxyData = 'settings:saveProxyData'
export const sendFeedback = 'settings:sendFeedback'
export const setAllowDeleteAccount = 'settings:setAllowDeleteAccount'
export const stop = 'settings:stop'
export const trace = 'settings:trace'
export const unfurlSettingsError = 'settings:unfurlSettingsError'
export const unfurlSettingsRefresh = 'settings:unfurlSettingsRefresh'
export const unfurlSettingsRefreshed = 'settings:unfurlSettingsRefreshed'
export const unfurlSettingsSaved = 'settings:unfurlSettingsSaved'
export const verifiedPhoneNumber = 'settings:verifiedPhoneNumber'
export const verifyPhoneNumber = 'settings:verifyPhoneNumber'
export const waitingForResponse = 'settings:waitingForResponse'

// Payload Types
type _AddPhoneNumberPayload = {
  readonly allowSearch: boolean
  readonly phoneNumber: string
  readonly resend?: boolean
}
type _AddedPhoneNumberPayload = {
  readonly allowSearch: boolean
  readonly error?: string
  readonly phoneNumber: string
}
type _CertificatePinningToggledPayload = {readonly toggled: boolean | null}
type _CheckPasswordPayload = {readonly password: HiddenString}
type _ClearPhoneNumberVerificationPayload = void
type _DbNukePayload = void
type _DeleteAccountForeverPayload = void
type _EditEmailPayload = {
  readonly email: string
  readonly delete?: boolean
  readonly makePrimary?: boolean
  readonly toggleSearchable?: boolean
  readonly verify?: boolean
}
type _EditPhonePayload = {
  readonly phone: string
  readonly delete?: boolean
  readonly toggleSearchable?: boolean
  readonly verify?: boolean
}
type _FeedbackSentPayload = {readonly error: Error | null}
type _InvitesClearErrorPayload = void
type _InvitesReclaimPayload = {readonly inviteId: string}
type _InvitesReclaimedPayload = void
type _InvitesReclaimedPayloadError = {readonly errorText: string}
type _InvitesRefreshPayload = void
type _InvitesRefreshedPayload = {readonly invites: Types._InvitesState}
type _InvitesSendPayload = {readonly email: string; readonly message: string | null}
type _InvitesSentPayload = void
type _InvitesSentPayloadError = {readonly error: Error}
type _LoadHasRandomPwPayload = void
type _LoadLockdownModePayload = void
type _LoadProxyDataPayload = void
type _LoadRememberPasswordPayload = void
type _LoadSettingsPayload = void
type _LoadedCheckPasswordPayload = {readonly checkPasswordIsCorrect: boolean | null}
type _LoadedHasRandomPwPayload = {readonly randomPW: boolean}
type _LoadedLockdownModePayload = {readonly status: boolean | null}
type _LoadedProxyDataPayload = {readonly proxyData: RPCTypes.ProxyData}
type _LoadedRememberPasswordPayload = {readonly remember: boolean}
type _LoadedSettingsPayload = {
  readonly emails: I.Map<string, Types.EmailRow> | null
  readonly phones: I.Map<string, Types.PhoneRow> | null
}
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
type _SaveProxyDataPayload = {readonly proxyData: RPCTypes.ProxyData}
type _SendFeedbackPayload = {
  readonly feedback: string
  readonly sendLogs: boolean
  readonly sendMaxBytes: boolean
}
type _SetAllowDeleteAccountPayload = {readonly allow: boolean}
type _StopPayload = {readonly exitCode: RPCTypes.ExitCode}
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
type _WaitingForResponsePayload = {readonly waiting: boolean}

// Action Creators
/**
 * Add a phone number and kick off a text message with a verification code. If `resend` is passed, ignores the other params and uses stashed params from store.
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
 * Cancel a phone number verification-in-progress.
 */
export const createClearPhoneNumberVerification = (
  payload: _ClearPhoneNumberVerificationPayload
): ClearPhoneNumberVerificationPayload => ({payload, type: clearPhoneNumberVerification})
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
export const createEditEmail = (payload: _EditEmailPayload): EditEmailPayload => ({payload, type: editEmail})
export const createEditPhone = (payload: _EditPhonePayload): EditPhonePayload => ({payload, type: editPhone})
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
export const createSaveProxyData = (payload: _SaveProxyDataPayload): SaveProxyDataPayload => ({
  payload,
  type: saveProxyData,
})
export const createSendFeedback = (payload: _SendFeedbackPayload): SendFeedbackPayload => ({
  payload,
  type: sendFeedback,
})
export const createSetAllowDeleteAccount = (
  payload: _SetAllowDeleteAccountPayload
): SetAllowDeleteAccountPayload => ({payload, type: setAllowDeleteAccount})
export const createStop = (payload: _StopPayload): StopPayload => ({payload, type: stop})
export const createTrace = (payload: _TracePayload): TracePayload => ({payload, type: trace})
export const createWaitingForResponse = (payload: _WaitingForResponsePayload): WaitingForResponsePayload => ({
  payload,
  type: waitingForResponse,
})

// Action Payloads
export type AddPhoneNumberPayload = {
  readonly payload: _AddPhoneNumberPayload
  readonly type: typeof addPhoneNumber
}
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
export type ClearPhoneNumberVerificationPayload = {
  readonly payload: _ClearPhoneNumberVerificationPayload
  readonly type: typeof clearPhoneNumberVerification
}
export type DbNukePayload = {readonly payload: _DbNukePayload; readonly type: typeof dbNuke}
export type DeleteAccountForeverPayload = {
  readonly payload: _DeleteAccountForeverPayload
  readonly type: typeof deleteAccountForever
}
export type EditEmailPayload = {readonly payload: _EditEmailPayload; readonly type: typeof editEmail}
export type EditPhonePayload = {readonly payload: _EditPhonePayload; readonly type: typeof editPhone}
export type FeedbackSentPayload = {readonly payload: _FeedbackSentPayload; readonly type: typeof feedbackSent}
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
export type SaveProxyDataPayload = {
  readonly payload: _SaveProxyDataPayload
  readonly type: typeof saveProxyData
}
export type SendFeedbackPayload = {readonly payload: _SendFeedbackPayload; readonly type: typeof sendFeedback}
export type SetAllowDeleteAccountPayload = {
  readonly payload: _SetAllowDeleteAccountPayload
  readonly type: typeof setAllowDeleteAccount
}
export type StopPayload = {readonly payload: _StopPayload; readonly type: typeof stop}
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
export type WaitingForResponsePayload = {
  readonly payload: _WaitingForResponsePayload
  readonly type: typeof waitingForResponse
}

// All Actions
// prettier-ignore
export type Actions =
  | AddPhoneNumberPayload
  | AddedPhoneNumberPayload
  | CertificatePinningToggledPayload
  | CheckPasswordPayload
  | ClearPhoneNumberVerificationPayload
  | DbNukePayload
  | DeleteAccountForeverPayload
  | EditEmailPayload
  | EditPhonePayload
  | FeedbackSentPayload
  | InvitesClearErrorPayload
  | InvitesReclaimPayload
  | InvitesReclaimedPayload
  | InvitesReclaimedPayloadError
  | InvitesRefreshPayload
  | InvitesRefreshedPayload
  | InvitesSendPayload
  | InvitesSentPayload
  | InvitesSentPayloadError
  | LoadHasRandomPwPayload
  | LoadLockdownModePayload
  | LoadProxyDataPayload
  | LoadRememberPasswordPayload
  | LoadSettingsPayload
  | LoadedCheckPasswordPayload
  | LoadedHasRandomPwPayload
  | LoadedLockdownModePayload
  | LoadedProxyDataPayload
  | LoadedRememberPasswordPayload
  | LoadedSettingsPayload
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
  | SaveProxyDataPayload
  | SendFeedbackPayload
  | SetAllowDeleteAccountPayload
  | StopPayload
  | TracePayload
  | UnfurlSettingsErrorPayload
  | UnfurlSettingsRefreshPayload
  | UnfurlSettingsRefreshedPayload
  | UnfurlSettingsSavedPayload
  | VerifiedPhoneNumberPayload
  | VerifyPhoneNumberPayload
  | WaitingForResponsePayload
  | {type: 'common:resetStore', payload: null}
