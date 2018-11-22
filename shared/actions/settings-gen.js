// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/settings'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
export const invitesClearError = 'settings:invitesClearError'
export const invitesReclaim = 'settings:invitesReclaim'
export const invitesReclaimed = 'settings:invitesReclaimed'
export const invitesRefresh = 'settings:invitesRefresh'
export const invitesRefreshed = 'settings:invitesRefreshed'
export const invitesSend = 'settings:invitesSend'
export const invitesSent = 'settings:invitesSent'
export const loadLockdownMode = 'settings:loadLockdownMode'
export const loadRememberPassphrase = 'settings:loadRememberPassphrase'
export const loadSettings = 'settings:loadSettings'
export const loadedLockdownMode = 'settings:loadedLockdownMode'
export const loadedRememberPassphrase = 'settings:loadedRememberPassphrase'
export const loadedSettings = 'settings:loadedSettings'
export const notificationsRefresh = 'settings:notificationsRefresh'
export const notificationsRefreshed = 'settings:notificationsRefreshed'
export const notificationsSaved = 'settings:notificationsSaved'
export const notificationsToggle = 'settings:notificationsToggle'
export const onChangeLockdownMode = 'settings:onChangeLockdownMode'
export const onChangeNewEmail = 'settings:onChangeNewEmail'
export const onChangeNewPassphrase = 'settings:onChangeNewPassphrase'
export const onChangeNewPassphraseConfirm = 'settings:onChangeNewPassphraseConfirm'
export const onChangeRememberPassphrase = 'settings:onChangeRememberPassphrase'
export const onChangeShowPassphrase = 'settings:onChangeShowPassphrase'
export const onSubmitNewEmail = 'settings:onSubmitNewEmail'
export const onSubmitNewPassphrase = 'settings:onSubmitNewPassphrase'
export const onUpdateEmailError = 'settings:onUpdateEmailError'
export const onUpdatePGPSettings = 'settings:onUpdatePGPSettings'
export const onUpdatePassphraseError = 'settings:onUpdatePassphraseError'
export const onUpdatedPGPSettings = 'settings:onUpdatedPGPSettings'
export const processorProfile = 'settings:processorProfile'
export const setAllowDeleteAccount = 'settings:setAllowDeleteAccount'
export const trace = 'settings:trace'
export const unfurlSettingsError = 'settings:unfurlSettingsError'
export const unfurlSettingsRefresh = 'settings:unfurlSettingsRefresh'
export const unfurlSettingsRefreshed = 'settings:unfurlSettingsRefreshed'
export const unfurlSettingsSaved = 'settings:unfurlSettingsSaved'
export const waitingForResponse = 'settings:waitingForResponse'

// Payload Types
type _DbNukePayload = void
type _DeleteAccountForeverPayload = void
type _InvitesClearErrorPayload = void
type _InvitesReclaimPayload = $ReadOnly<{|inviteId: string|}>
type _InvitesReclaimedPayload = void
type _InvitesReclaimedPayloadError = $ReadOnly<{|errorText: string|}>
type _InvitesRefreshPayload = void
type _InvitesRefreshedPayload = $ReadOnly<{|invites: Types.InvitesState|}>
type _InvitesSendPayload = $ReadOnly<{|
  email: string,
  message: ?string,
|}>
type _InvitesSentPayload = void
type _InvitesSentPayloadError = $ReadOnly<{|error: Error|}>
type _LoadLockdownModePayload = void
type _LoadRememberPassphrasePayload = void
type _LoadSettingsPayload = void
type _LoadedLockdownModePayload = $ReadOnly<{|status: ?boolean|}>
type _LoadedRememberPassphrasePayload = $ReadOnly<{|remember: boolean|}>
type _LoadedSettingsPayload = $ReadOnly<{|emailState: Types.EmailState|}>
type _NotificationsRefreshPayload = void
type _NotificationsRefreshedPayload = $ReadOnly<{|notifications: Types.NotificationsState|}>
type _NotificationsSavedPayload = void
type _NotificationsTogglePayload = $ReadOnly<{|
  group: Types.NotificationGroups,
  name?: ?string,
|}>
type _OnChangeLockdownModePayload = $ReadOnly<{|enabled: boolean|}>
type _OnChangeNewEmailPayload = $ReadOnly<{|email: string|}>
type _OnChangeNewPassphraseConfirmPayload = $ReadOnly<{|passphrase: HiddenString|}>
type _OnChangeNewPassphrasePayload = $ReadOnly<{|passphrase: HiddenString|}>
type _OnChangeRememberPassphrasePayload = $ReadOnly<{|remember: boolean|}>
type _OnChangeShowPassphrasePayload = void
type _OnSubmitNewEmailPayload = void
type _OnSubmitNewPassphrasePayload = void
type _OnUpdateEmailErrorPayload = $ReadOnly<{|error: Error|}>
type _OnUpdatePGPSettingsPayload = void
type _OnUpdatePassphraseErrorPayload = $ReadOnly<{|error: Error|}>
type _OnUpdatedPGPSettingsPayload = $ReadOnly<{|hasKeys: boolean|}>
type _ProcessorProfilePayload = $ReadOnly<{|durationSeconds: number|}>
type _SetAllowDeleteAccountPayload = $ReadOnly<{|allow: boolean|}>
type _TracePayload = $ReadOnly<{|durationSeconds: number|}>
type _UnfurlSettingsErrorPayload = $ReadOnly<{|error: string|}>
type _UnfurlSettingsRefreshPayload = void
type _UnfurlSettingsRefreshedPayload = $ReadOnly<{|
  mode: RPCChatTypes.UnfurlMode,
  whitelist: Array<string>,
|}>
type _UnfurlSettingsSavedPayload = $ReadOnly<{|
  mode: RPCChatTypes.UnfurlMode,
  whitelist: Array<string>,
|}>
type _WaitingForResponsePayload = $ReadOnly<{|waiting: boolean|}>

// Action Creators
/**
 * An error occurred on the unfurl settings screen
 */
export const createUnfurlSettingsError = (payload: _UnfurlSettingsErrorPayload) => ({payload, type: unfurlSettingsError})
/**
 * Refresh unfurl settings
 */
export const createUnfurlSettingsRefresh = (payload: _UnfurlSettingsRefreshPayload) => ({payload, type: unfurlSettingsRefresh})
/**
 * Refreshed unfurl settings available
 */
export const createUnfurlSettingsRefreshed = (payload: _UnfurlSettingsRefreshedPayload) => ({payload, type: unfurlSettingsRefreshed})
/**
 * Update unfurl settings from settings screen
 */
export const createUnfurlSettingsSaved = (payload: _UnfurlSettingsSavedPayload) => ({payload, type: unfurlSettingsSaved})
export const createDbNuke = (payload: _DbNukePayload) => ({payload, type: dbNuke})
export const createDeleteAccountForever = (payload: _DeleteAccountForeverPayload) => ({payload, type: deleteAccountForever})
export const createInvitesClearError = (payload: _InvitesClearErrorPayload) => ({payload, type: invitesClearError})
export const createInvitesReclaim = (payload: _InvitesReclaimPayload) => ({payload, type: invitesReclaim})
export const createInvitesReclaimed = (payload: _InvitesReclaimedPayload) => ({payload, type: invitesReclaimed})
export const createInvitesReclaimedError = (payload: _InvitesReclaimedPayloadError) => ({error: true, payload, type: invitesReclaimed})
export const createInvitesRefresh = (payload: _InvitesRefreshPayload) => ({payload, type: invitesRefresh})
export const createInvitesRefreshed = (payload: _InvitesRefreshedPayload) => ({payload, type: invitesRefreshed})
export const createInvitesSend = (payload: _InvitesSendPayload) => ({payload, type: invitesSend})
export const createInvitesSent = (payload: _InvitesSentPayload) => ({payload, type: invitesSent})
export const createInvitesSentError = (payload: _InvitesSentPayloadError) => ({error: true, payload, type: invitesSent})
export const createLoadLockdownMode = (payload: _LoadLockdownModePayload) => ({payload, type: loadLockdownMode})
export const createLoadRememberPassphrase = (payload: _LoadRememberPassphrasePayload) => ({payload, type: loadRememberPassphrase})
export const createLoadSettings = (payload: _LoadSettingsPayload) => ({payload, type: loadSettings})
export const createLoadedLockdownMode = (payload: _LoadedLockdownModePayload) => ({payload, type: loadedLockdownMode})
export const createLoadedRememberPassphrase = (payload: _LoadedRememberPassphrasePayload) => ({payload, type: loadedRememberPassphrase})
export const createLoadedSettings = (payload: _LoadedSettingsPayload) => ({payload, type: loadedSettings})
export const createNotificationsRefresh = (payload: _NotificationsRefreshPayload) => ({payload, type: notificationsRefresh})
export const createNotificationsRefreshed = (payload: _NotificationsRefreshedPayload) => ({payload, type: notificationsRefreshed})
export const createNotificationsSaved = (payload: _NotificationsSavedPayload) => ({payload, type: notificationsSaved})
export const createNotificationsToggle = (payload: _NotificationsTogglePayload) => ({payload, type: notificationsToggle})
export const createOnChangeLockdownMode = (payload: _OnChangeLockdownModePayload) => ({payload, type: onChangeLockdownMode})
export const createOnChangeNewEmail = (payload: _OnChangeNewEmailPayload) => ({payload, type: onChangeNewEmail})
export const createOnChangeNewPassphrase = (payload: _OnChangeNewPassphrasePayload) => ({payload, type: onChangeNewPassphrase})
export const createOnChangeNewPassphraseConfirm = (payload: _OnChangeNewPassphraseConfirmPayload) => ({payload, type: onChangeNewPassphraseConfirm})
export const createOnChangeRememberPassphrase = (payload: _OnChangeRememberPassphrasePayload) => ({payload, type: onChangeRememberPassphrase})
export const createOnChangeShowPassphrase = (payload: _OnChangeShowPassphrasePayload) => ({payload, type: onChangeShowPassphrase})
export const createOnSubmitNewEmail = (payload: _OnSubmitNewEmailPayload) => ({payload, type: onSubmitNewEmail})
export const createOnSubmitNewPassphrase = (payload: _OnSubmitNewPassphrasePayload) => ({payload, type: onSubmitNewPassphrase})
export const createOnUpdateEmailError = (payload: _OnUpdateEmailErrorPayload) => ({payload, type: onUpdateEmailError})
export const createOnUpdatePGPSettings = (payload: _OnUpdatePGPSettingsPayload) => ({payload, type: onUpdatePGPSettings})
export const createOnUpdatePassphraseError = (payload: _OnUpdatePassphraseErrorPayload) => ({payload, type: onUpdatePassphraseError})
export const createOnUpdatedPGPSettings = (payload: _OnUpdatedPGPSettingsPayload) => ({payload, type: onUpdatedPGPSettings})
export const createProcessorProfile = (payload: _ProcessorProfilePayload) => ({payload, type: processorProfile})
export const createSetAllowDeleteAccount = (payload: _SetAllowDeleteAccountPayload) => ({payload, type: setAllowDeleteAccount})
export const createTrace = (payload: _TracePayload) => ({payload, type: trace})
export const createWaitingForResponse = (payload: _WaitingForResponsePayload) => ({payload, type: waitingForResponse})

// Action Payloads
export type DbNukePayload = $Call<typeof createDbNuke, _DbNukePayload>
export type DeleteAccountForeverPayload = $Call<typeof createDeleteAccountForever, _DeleteAccountForeverPayload>
export type InvitesClearErrorPayload = $Call<typeof createInvitesClearError, _InvitesClearErrorPayload>
export type InvitesReclaimPayload = $Call<typeof createInvitesReclaim, _InvitesReclaimPayload>
export type InvitesReclaimedPayload = $Call<typeof createInvitesReclaimed, _InvitesReclaimedPayload>
export type InvitesReclaimedPayloadError = $Call<typeof createInvitesReclaimedError, _InvitesReclaimedPayloadError>
export type InvitesRefreshPayload = $Call<typeof createInvitesRefresh, _InvitesRefreshPayload>
export type InvitesRefreshedPayload = $Call<typeof createInvitesRefreshed, _InvitesRefreshedPayload>
export type InvitesSendPayload = $Call<typeof createInvitesSend, _InvitesSendPayload>
export type InvitesSentPayload = $Call<typeof createInvitesSent, _InvitesSentPayload>
export type InvitesSentPayloadError = $Call<typeof createInvitesSentError, _InvitesSentPayloadError>
export type LoadLockdownModePayload = $Call<typeof createLoadLockdownMode, _LoadLockdownModePayload>
export type LoadRememberPassphrasePayload = $Call<typeof createLoadRememberPassphrase, _LoadRememberPassphrasePayload>
export type LoadSettingsPayload = $Call<typeof createLoadSettings, _LoadSettingsPayload>
export type LoadedLockdownModePayload = $Call<typeof createLoadedLockdownMode, _LoadedLockdownModePayload>
export type LoadedRememberPassphrasePayload = $Call<typeof createLoadedRememberPassphrase, _LoadedRememberPassphrasePayload>
export type LoadedSettingsPayload = $Call<typeof createLoadedSettings, _LoadedSettingsPayload>
export type NotificationsRefreshPayload = $Call<typeof createNotificationsRefresh, _NotificationsRefreshPayload>
export type NotificationsRefreshedPayload = $Call<typeof createNotificationsRefreshed, _NotificationsRefreshedPayload>
export type NotificationsSavedPayload = $Call<typeof createNotificationsSaved, _NotificationsSavedPayload>
export type NotificationsTogglePayload = $Call<typeof createNotificationsToggle, _NotificationsTogglePayload>
export type OnChangeLockdownModePayload = $Call<typeof createOnChangeLockdownMode, _OnChangeLockdownModePayload>
export type OnChangeNewEmailPayload = $Call<typeof createOnChangeNewEmail, _OnChangeNewEmailPayload>
export type OnChangeNewPassphraseConfirmPayload = $Call<typeof createOnChangeNewPassphraseConfirm, _OnChangeNewPassphraseConfirmPayload>
export type OnChangeNewPassphrasePayload = $Call<typeof createOnChangeNewPassphrase, _OnChangeNewPassphrasePayload>
export type OnChangeRememberPassphrasePayload = $Call<typeof createOnChangeRememberPassphrase, _OnChangeRememberPassphrasePayload>
export type OnChangeShowPassphrasePayload = $Call<typeof createOnChangeShowPassphrase, _OnChangeShowPassphrasePayload>
export type OnSubmitNewEmailPayload = $Call<typeof createOnSubmitNewEmail, _OnSubmitNewEmailPayload>
export type OnSubmitNewPassphrasePayload = $Call<typeof createOnSubmitNewPassphrase, _OnSubmitNewPassphrasePayload>
export type OnUpdateEmailErrorPayload = $Call<typeof createOnUpdateEmailError, _OnUpdateEmailErrorPayload>
export type OnUpdatePGPSettingsPayload = $Call<typeof createOnUpdatePGPSettings, _OnUpdatePGPSettingsPayload>
export type OnUpdatePassphraseErrorPayload = $Call<typeof createOnUpdatePassphraseError, _OnUpdatePassphraseErrorPayload>
export type OnUpdatedPGPSettingsPayload = $Call<typeof createOnUpdatedPGPSettings, _OnUpdatedPGPSettingsPayload>
export type ProcessorProfilePayload = $Call<typeof createProcessorProfile, _ProcessorProfilePayload>
export type SetAllowDeleteAccountPayload = $Call<typeof createSetAllowDeleteAccount, _SetAllowDeleteAccountPayload>
export type TracePayload = $Call<typeof createTrace, _TracePayload>
export type UnfurlSettingsErrorPayload = $Call<typeof createUnfurlSettingsError, _UnfurlSettingsErrorPayload>
export type UnfurlSettingsRefreshPayload = $Call<typeof createUnfurlSettingsRefresh, _UnfurlSettingsRefreshPayload>
export type UnfurlSettingsRefreshedPayload = $Call<typeof createUnfurlSettingsRefreshed, _UnfurlSettingsRefreshedPayload>
export type UnfurlSettingsSavedPayload = $Call<typeof createUnfurlSettingsSaved, _UnfurlSettingsSavedPayload>
export type WaitingForResponsePayload = $Call<typeof createWaitingForResponse, _WaitingForResponsePayload>

// All Actions
// prettier-ignore
export type Actions =
  | DbNukePayload
  | DeleteAccountForeverPayload
  | InvitesClearErrorPayload
  | InvitesReclaimPayload
  | InvitesReclaimedPayload
  | InvitesReclaimedPayloadError
  | InvitesRefreshPayload
  | InvitesRefreshedPayload
  | InvitesSendPayload
  | InvitesSentPayload
  | InvitesSentPayloadError
  | LoadLockdownModePayload
  | LoadRememberPassphrasePayload
  | LoadSettingsPayload
  | LoadedLockdownModePayload
  | LoadedRememberPassphrasePayload
  | LoadedSettingsPayload
  | NotificationsRefreshPayload
  | NotificationsRefreshedPayload
  | NotificationsSavedPayload
  | NotificationsTogglePayload
  | OnChangeLockdownModePayload
  | OnChangeNewEmailPayload
  | OnChangeNewPassphraseConfirmPayload
  | OnChangeNewPassphrasePayload
  | OnChangeRememberPassphrasePayload
  | OnChangeShowPassphrasePayload
  | OnSubmitNewEmailPayload
  | OnSubmitNewPassphrasePayload
  | OnUpdateEmailErrorPayload
  | OnUpdatePGPSettingsPayload
  | OnUpdatePassphraseErrorPayload
  | OnUpdatedPGPSettingsPayload
  | ProcessorProfilePayload
  | SetAllowDeleteAccountPayload
  | TracePayload
  | UnfurlSettingsErrorPayload
  | UnfurlSettingsRefreshPayload
  | UnfurlSettingsRefreshedPayload
  | UnfurlSettingsSavedPayload
  | WaitingForResponsePayload
  | {type: 'common:resetStore', payload: void}
