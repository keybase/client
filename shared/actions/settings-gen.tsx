// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/settings'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const checkPassword = 'settings:checkPassword'
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
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
export const loadRememberPassword = 'settings:loadRememberPassword'
export const loadSettings = 'settings:loadSettings'
export const loadedCheckPassword = 'settings:loadedCheckPassword'
export const loadedHasRandomPw = 'settings:loadedHasRandomPw'
export const loadedLockdownMode = 'settings:loadedLockdownMode'
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
export const sendFeedback = 'settings:sendFeedback'
export const setAllowDeleteAccount = 'settings:setAllowDeleteAccount'
export const stop = 'settings:stop'
export const trace = 'settings:trace'
export const unfurlSettingsError = 'settings:unfurlSettingsError'
export const unfurlSettingsRefresh = 'settings:unfurlSettingsRefresh'
export const unfurlSettingsRefreshed = 'settings:unfurlSettingsRefreshed'
export const unfurlSettingsSaved = 'settings:unfurlSettingsSaved'
export const waitingForResponse = 'settings:waitingForResponse'

// Payload Types
type _CheckPasswordPayload = {readonly password: HiddenString}
type _DbNukePayload = void
type _DeleteAccountForeverPayload = void
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
type _LoadRememberPasswordPayload = void
type _LoadSettingsPayload = void
type _LoadedCheckPasswordPayload = {readonly checkPasswordIsCorrect: boolean | null}
type _LoadedHasRandomPwPayload = {readonly randomPW: boolean}
type _LoadedLockdownModePayload = {readonly status: boolean | null}
type _LoadedRememberPasswordPayload = {readonly remember: boolean}
type _LoadedSettingsPayload = {readonly emails: I.List<Types.EmailRow> | null}
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
type _SendFeedbackPayload = {readonly feedback: string; readonly sendLogs: boolean}
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
type _WaitingForResponsePayload = {readonly waiting: boolean}

// Action Creators
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
 * Update unfurl settings from settings screen
 */
export const createUnfurlSettingsSaved = (
  payload: _UnfurlSettingsSavedPayload
): UnfurlSettingsSavedPayload => ({payload, type: unfurlSettingsSaved})
export const createCheckPassword = (payload: _CheckPasswordPayload): CheckPasswordPayload => ({
  payload,
  type: checkPassword,
})
export const createDbNuke = (payload: _DbNukePayload): DbNukePayload => ({payload, type: dbNuke})
export const createDeleteAccountForever = (
  payload: _DeleteAccountForeverPayload
): DeleteAccountForeverPayload => ({payload, type: deleteAccountForever})
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
export type CheckPasswordPayload = {
  readonly payload: _CheckPasswordPayload
  readonly type: 'settings:checkPassword'
}
export type DbNukePayload = {readonly payload: _DbNukePayload; readonly type: 'settings:dbNuke'}
export type DeleteAccountForeverPayload = {
  readonly payload: _DeleteAccountForeverPayload
  readonly type: 'settings:deleteAccountForever'
}
export type FeedbackSentPayload = {
  readonly payload: _FeedbackSentPayload
  readonly type: 'settings:feedbackSent'
}
export type InvitesClearErrorPayload = {
  readonly payload: _InvitesClearErrorPayload
  readonly type: 'settings:invitesClearError'
}
export type InvitesReclaimPayload = {
  readonly payload: _InvitesReclaimPayload
  readonly type: 'settings:invitesReclaim'
}
export type InvitesReclaimedPayload = {
  readonly payload: _InvitesReclaimedPayload
  readonly type: 'settings:invitesReclaimed'
}
export type InvitesReclaimedPayloadError = {
  readonly error: true
  readonly payload: _InvitesReclaimedPayloadError
  readonly type: 'settings:invitesReclaimed'
}
export type InvitesRefreshPayload = {
  readonly payload: _InvitesRefreshPayload
  readonly type: 'settings:invitesRefresh'
}
export type InvitesRefreshedPayload = {
  readonly payload: _InvitesRefreshedPayload
  readonly type: 'settings:invitesRefreshed'
}
export type InvitesSendPayload = {
  readonly payload: _InvitesSendPayload
  readonly type: 'settings:invitesSend'
}
export type InvitesSentPayload = {
  readonly payload: _InvitesSentPayload
  readonly type: 'settings:invitesSent'
}
export type InvitesSentPayloadError = {
  readonly error: true
  readonly payload: _InvitesSentPayloadError
  readonly type: 'settings:invitesSent'
}
export type LoadHasRandomPwPayload = {
  readonly payload: _LoadHasRandomPwPayload
  readonly type: 'settings:loadHasRandomPw'
}
export type LoadLockdownModePayload = {
  readonly payload: _LoadLockdownModePayload
  readonly type: 'settings:loadLockdownMode'
}
export type LoadRememberPasswordPayload = {
  readonly payload: _LoadRememberPasswordPayload
  readonly type: 'settings:loadRememberPassword'
}
export type LoadSettingsPayload = {
  readonly payload: _LoadSettingsPayload
  readonly type: 'settings:loadSettings'
}
export type LoadedCheckPasswordPayload = {
  readonly payload: _LoadedCheckPasswordPayload
  readonly type: 'settings:loadedCheckPassword'
}
export type LoadedHasRandomPwPayload = {
  readonly payload: _LoadedHasRandomPwPayload
  readonly type: 'settings:loadedHasRandomPw'
}
export type LoadedLockdownModePayload = {
  readonly payload: _LoadedLockdownModePayload
  readonly type: 'settings:loadedLockdownMode'
}
export type LoadedRememberPasswordPayload = {
  readonly payload: _LoadedRememberPasswordPayload
  readonly type: 'settings:loadedRememberPassword'
}
export type LoadedSettingsPayload = {
  readonly payload: _LoadedSettingsPayload
  readonly type: 'settings:loadedSettings'
}
export type NotificationsRefreshPayload = {
  readonly payload: _NotificationsRefreshPayload
  readonly type: 'settings:notificationsRefresh'
}
export type NotificationsRefreshedPayload = {
  readonly payload: _NotificationsRefreshedPayload
  readonly type: 'settings:notificationsRefreshed'
}
export type NotificationsSavedPayload = {
  readonly payload: _NotificationsSavedPayload
  readonly type: 'settings:notificationsSaved'
}
export type NotificationsTogglePayload = {
  readonly payload: _NotificationsTogglePayload
  readonly type: 'settings:notificationsToggle'
}
export type OnChangeLockdownModePayload = {
  readonly payload: _OnChangeLockdownModePayload
  readonly type: 'settings:onChangeLockdownMode'
}
export type OnChangeNewEmailPayload = {
  readonly payload: _OnChangeNewEmailPayload
  readonly type: 'settings:onChangeNewEmail'
}
export type OnChangeNewPasswordConfirmPayload = {
  readonly payload: _OnChangeNewPasswordConfirmPayload
  readonly type: 'settings:onChangeNewPasswordConfirm'
}
export type OnChangeNewPasswordPayload = {
  readonly payload: _OnChangeNewPasswordPayload
  readonly type: 'settings:onChangeNewPassword'
}
export type OnChangeRememberPasswordPayload = {
  readonly payload: _OnChangeRememberPasswordPayload
  readonly type: 'settings:onChangeRememberPassword'
}
export type OnChangeShowPasswordPayload = {
  readonly payload: _OnChangeShowPasswordPayload
  readonly type: 'settings:onChangeShowPassword'
}
export type OnChangeUseNativeFramePayload = {
  readonly payload: _OnChangeUseNativeFramePayload
  readonly type: 'settings:onChangeUseNativeFrame'
}
export type OnSubmitNewEmailPayload = {
  readonly payload: _OnSubmitNewEmailPayload
  readonly type: 'settings:onSubmitNewEmail'
}
export type OnSubmitNewPasswordPayload = {
  readonly payload: _OnSubmitNewPasswordPayload
  readonly type: 'settings:onSubmitNewPassword'
}
export type OnUpdateEmailErrorPayload = {
  readonly payload: _OnUpdateEmailErrorPayload
  readonly type: 'settings:onUpdateEmailError'
}
export type OnUpdatePGPSettingsPayload = {
  readonly payload: _OnUpdatePGPSettingsPayload
  readonly type: 'settings:onUpdatePGPSettings'
}
export type OnUpdatePasswordErrorPayload = {
  readonly payload: _OnUpdatePasswordErrorPayload
  readonly type: 'settings:onUpdatePasswordError'
}
export type OnUpdatedPGPSettingsPayload = {
  readonly payload: _OnUpdatedPGPSettingsPayload
  readonly type: 'settings:onUpdatedPGPSettings'
}
export type ProcessorProfilePayload = {
  readonly payload: _ProcessorProfilePayload
  readonly type: 'settings:processorProfile'
}
export type SendFeedbackPayload = {
  readonly payload: _SendFeedbackPayload
  readonly type: 'settings:sendFeedback'
}
export type SetAllowDeleteAccountPayload = {
  readonly payload: _SetAllowDeleteAccountPayload
  readonly type: 'settings:setAllowDeleteAccount'
}
export type StopPayload = {readonly payload: _StopPayload; readonly type: 'settings:stop'}
export type TracePayload = {readonly payload: _TracePayload; readonly type: 'settings:trace'}
export type UnfurlSettingsErrorPayload = {
  readonly payload: _UnfurlSettingsErrorPayload
  readonly type: 'settings:unfurlSettingsError'
}
export type UnfurlSettingsRefreshPayload = {
  readonly payload: _UnfurlSettingsRefreshPayload
  readonly type: 'settings:unfurlSettingsRefresh'
}
export type UnfurlSettingsRefreshedPayload = {
  readonly payload: _UnfurlSettingsRefreshedPayload
  readonly type: 'settings:unfurlSettingsRefreshed'
}
export type UnfurlSettingsSavedPayload = {
  readonly payload: _UnfurlSettingsSavedPayload
  readonly type: 'settings:unfurlSettingsSaved'
}
export type WaitingForResponsePayload = {
  readonly payload: _WaitingForResponsePayload
  readonly type: 'settings:waitingForResponse'
}

// All Actions
// prettier-ignore
export type Actions =
  | CheckPasswordPayload
  | DbNukePayload
  | DeleteAccountForeverPayload
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
  | LoadRememberPasswordPayload
  | LoadSettingsPayload
  | LoadedCheckPasswordPayload
  | LoadedHasRandomPwPayload
  | LoadedLockdownModePayload
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
  | SendFeedbackPayload
  | SetAllowDeleteAccountPayload
  | StopPayload
  | TracePayload
  | UnfurlSettingsErrorPayload
  | UnfurlSettingsRefreshPayload
  | UnfurlSettingsRefreshedPayload
  | UnfurlSettingsSavedPayload
  | WaitingForResponsePayload
  | {type: 'common:resetStore', payload: null}
