// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/settings'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const dbNuke = typePrefix + 'dbNuke'
export const deleteAccountForever = typePrefix + 'deleteAccountForever'
export const invitesClearError = typePrefix + 'invitesClearError'
export const invitesReclaim = typePrefix + 'invitesReclaim'
export const invitesReclaimed = typePrefix + 'invitesReclaimed'
export const invitesRefresh = typePrefix + 'invitesRefresh'
export const invitesRefreshed = typePrefix + 'invitesRefreshed'
export const invitesSend = typePrefix + 'invitesSend'
export const invitesSent = typePrefix + 'invitesSent'
export const loadLockdownMode = typePrefix + 'loadLockdownMode'
export const loadRememberPassphrase = typePrefix + 'loadRememberPassphrase'
export const loadSettings = typePrefix + 'loadSettings'
export const loadedLockdownMode = typePrefix + 'loadedLockdownMode'
export const loadedRememberPassphrase = typePrefix + 'loadedRememberPassphrase'
export const loadedSettings = typePrefix + 'loadedSettings'
export const notificationsRefresh = typePrefix + 'notificationsRefresh'
export const notificationsRefreshed = typePrefix + 'notificationsRefreshed'
export const notificationsSaved = typePrefix + 'notificationsSaved'
export const notificationsToggle = typePrefix + 'notificationsToggle'
export const onChangeLockdownMode = typePrefix + 'onChangeLockdownMode'
export const onChangeNewEmail = typePrefix + 'onChangeNewEmail'
export const onChangeNewPassphrase = typePrefix + 'onChangeNewPassphrase'
export const onChangeNewPassphraseConfirm = typePrefix + 'onChangeNewPassphraseConfirm'
export const onChangeRememberPassphrase = typePrefix + 'onChangeRememberPassphrase'
export const onChangeShowPassphrase = typePrefix + 'onChangeShowPassphrase'
export const onSubmitNewEmail = typePrefix + 'onSubmitNewEmail'
export const onSubmitNewPassphrase = typePrefix + 'onSubmitNewPassphrase'
export const onUpdateEmailError = typePrefix + 'onUpdateEmailError'
export const onUpdatePGPSettings = typePrefix + 'onUpdatePGPSettings'
export const onUpdatePassphraseError = typePrefix + 'onUpdatePassphraseError'
export const onUpdatedPGPSettings = typePrefix + 'onUpdatedPGPSettings'
export const processorProfile = typePrefix + 'processorProfile'
export const setAllowDeleteAccount = typePrefix + 'setAllowDeleteAccount'
export const trace = typePrefix + 'trace'
export const waitingForResponse = typePrefix + 'waitingForResponse'

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
type _WaitingForResponsePayload = $ReadOnly<{|waiting: boolean|}>

// Action Creators
export const createDbNuke = (payload: _DbNukePayload) => ({error: false, payload, type: dbNuke})
export const createDeleteAccountForever = (payload: _DeleteAccountForeverPayload) => ({error: false, payload, type: deleteAccountForever})
export const createInvitesClearError = (payload: _InvitesClearErrorPayload) => ({error: false, payload, type: invitesClearError})
export const createInvitesReclaim = (payload: _InvitesReclaimPayload) => ({error: false, payload, type: invitesReclaim})
export const createInvitesReclaimed = (payload: _InvitesReclaimedPayload) => ({error: false, payload, type: invitesReclaimed})
export const createInvitesReclaimedError = (payload: _InvitesReclaimedPayloadError) => ({error: true, payload, type: invitesReclaimed})
export const createInvitesRefresh = (payload: _InvitesRefreshPayload) => ({error: false, payload, type: invitesRefresh})
export const createInvitesRefreshed = (payload: _InvitesRefreshedPayload) => ({error: false, payload, type: invitesRefreshed})
export const createInvitesSend = (payload: _InvitesSendPayload) => ({error: false, payload, type: invitesSend})
export const createInvitesSent = (payload: _InvitesSentPayload) => ({error: false, payload, type: invitesSent})
export const createInvitesSentError = (payload: _InvitesSentPayloadError) => ({error: true, payload, type: invitesSent})
export const createLoadLockdownMode = (payload: _LoadLockdownModePayload) => ({error: false, payload, type: loadLockdownMode})
export const createLoadRememberPassphrase = (payload: _LoadRememberPassphrasePayload) => ({error: false, payload, type: loadRememberPassphrase})
export const createLoadSettings = (payload: _LoadSettingsPayload) => ({error: false, payload, type: loadSettings})
export const createLoadedLockdownMode = (payload: _LoadedLockdownModePayload) => ({error: false, payload, type: loadedLockdownMode})
export const createLoadedRememberPassphrase = (payload: _LoadedRememberPassphrasePayload) => ({error: false, payload, type: loadedRememberPassphrase})
export const createLoadedSettings = (payload: _LoadedSettingsPayload) => ({error: false, payload, type: loadedSettings})
export const createNotificationsRefresh = (payload: _NotificationsRefreshPayload) => ({error: false, payload, type: notificationsRefresh})
export const createNotificationsRefreshed = (payload: _NotificationsRefreshedPayload) => ({error: false, payload, type: notificationsRefreshed})
export const createNotificationsSaved = (payload: _NotificationsSavedPayload) => ({error: false, payload, type: notificationsSaved})
export const createNotificationsToggle = (payload: _NotificationsTogglePayload) => ({error: false, payload, type: notificationsToggle})
export const createOnChangeLockdownMode = (payload: _OnChangeLockdownModePayload) => ({error: false, payload, type: onChangeLockdownMode})
export const createOnChangeNewEmail = (payload: _OnChangeNewEmailPayload) => ({error: false, payload, type: onChangeNewEmail})
export const createOnChangeNewPassphrase = (payload: _OnChangeNewPassphrasePayload) => ({error: false, payload, type: onChangeNewPassphrase})
export const createOnChangeNewPassphraseConfirm = (payload: _OnChangeNewPassphraseConfirmPayload) => ({error: false, payload, type: onChangeNewPassphraseConfirm})
export const createOnChangeRememberPassphrase = (payload: _OnChangeRememberPassphrasePayload) => ({error: false, payload, type: onChangeRememberPassphrase})
export const createOnChangeShowPassphrase = (payload: _OnChangeShowPassphrasePayload) => ({error: false, payload, type: onChangeShowPassphrase})
export const createOnSubmitNewEmail = (payload: _OnSubmitNewEmailPayload) => ({error: false, payload, type: onSubmitNewEmail})
export const createOnSubmitNewPassphrase = (payload: _OnSubmitNewPassphrasePayload) => ({error: false, payload, type: onSubmitNewPassphrase})
export const createOnUpdateEmailError = (payload: _OnUpdateEmailErrorPayload) => ({error: false, payload, type: onUpdateEmailError})
export const createOnUpdatePGPSettings = (payload: _OnUpdatePGPSettingsPayload) => ({error: false, payload, type: onUpdatePGPSettings})
export const createOnUpdatePassphraseError = (payload: _OnUpdatePassphraseErrorPayload) => ({error: false, payload, type: onUpdatePassphraseError})
export const createOnUpdatedPGPSettings = (payload: _OnUpdatedPGPSettingsPayload) => ({error: false, payload, type: onUpdatedPGPSettings})
export const createProcessorProfile = (payload: _ProcessorProfilePayload) => ({error: false, payload, type: processorProfile})
export const createSetAllowDeleteAccount = (payload: _SetAllowDeleteAccountPayload) => ({error: false, payload, type: setAllowDeleteAccount})
export const createTrace = (payload: _TracePayload) => ({error: false, payload, type: trace})
export const createWaitingForResponse = (payload: _WaitingForResponsePayload) => ({error: false, payload, type: waitingForResponse})

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
  | WaitingForResponsePayload
  | {type: 'common:resetStore', payload: void}
