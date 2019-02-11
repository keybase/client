// @flow
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
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
export const invitesClearError = 'settings:invitesClearError'
export const invitesReclaim = 'settings:invitesReclaim'
export const invitesReclaimed = 'settings:invitesReclaimed'
export const invitesRefresh = 'settings:invitesRefresh'
export const invitesRefreshed = 'settings:invitesRefreshed'
export const invitesSend = 'settings:invitesSend'
export const invitesSent = 'settings:invitesSent'
export const loadHasRandomPw = 'settings:loadHasRandomPw'
export const loadLockdownMode = 'settings:loadLockdownMode'
export const loadRememberPassphrase = 'settings:loadRememberPassphrase'
export const loadSettings = 'settings:loadSettings'
export const loadedHasRandomPw = 'settings:loadedHasRandomPw'
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
type _InvitesSendPayload = $ReadOnly<{|email: string, message: ?string|}>
type _InvitesSentPayload = void
type _InvitesSentPayloadError = $ReadOnly<{|error: Error|}>
type _LoadHasRandomPwPayload = void
type _LoadLockdownModePayload = void
type _LoadRememberPassphrasePayload = void
type _LoadSettingsPayload = void
type _LoadedHasRandomPwPayload = $ReadOnly<{|randomPW: boolean|}>
type _LoadedLockdownModePayload = $ReadOnly<{|status: ?boolean|}>
type _LoadedRememberPassphrasePayload = $ReadOnly<{|remember: boolean|}>
type _LoadedSettingsPayload = $ReadOnly<{|emails: ?Array<RPCTypes.Email>|}>
type _NotificationsRefreshPayload = void
type _NotificationsRefreshedPayload = $ReadOnly<{|notifications: Types.NotificationsState|}>
type _NotificationsSavedPayload = void
type _NotificationsTogglePayload = $ReadOnly<{|group: Types.NotificationGroups, name?: ?string|}>
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
type _UnfurlSettingsRefreshedPayload = $ReadOnly<{|mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>|}>
type _UnfurlSettingsSavedPayload = $ReadOnly<{|mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>|}>
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
export const createLoadHasRandomPw = (payload: _LoadHasRandomPwPayload) => ({payload, type: loadHasRandomPw})
export const createLoadLockdownMode = (payload: _LoadLockdownModePayload) => ({payload, type: loadLockdownMode})
export const createLoadRememberPassphrase = (payload: _LoadRememberPassphrasePayload) => ({payload, type: loadRememberPassphrase})
export const createLoadSettings = (payload: _LoadSettingsPayload) => ({payload, type: loadSettings})
export const createLoadedHasRandomPw = (payload: _LoadedHasRandomPwPayload) => ({payload, type: loadedHasRandomPw})
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
export type DbNukePayload = {|+payload: _DbNukePayload, +type: 'settings:dbNuke'|}
export type DeleteAccountForeverPayload = {|+payload: _DeleteAccountForeverPayload, +type: 'settings:deleteAccountForever'|}
export type InvitesClearErrorPayload = {|+payload: _InvitesClearErrorPayload, +type: 'settings:invitesClearError'|}
export type InvitesReclaimPayload = {|+payload: _InvitesReclaimPayload, +type: 'settings:invitesReclaim'|}
export type InvitesReclaimedPayload = {|+payload: _InvitesReclaimedPayload, +type: 'settings:invitesReclaimed'|}
export type InvitesReclaimedPayloadError = {|+error: true, +payload: _InvitesReclaimedPayloadError, +type: 'settings:invitesReclaimed'|}
export type InvitesRefreshPayload = {|+payload: _InvitesRefreshPayload, +type: 'settings:invitesRefresh'|}
export type InvitesRefreshedPayload = {|+payload: _InvitesRefreshedPayload, +type: 'settings:invitesRefreshed'|}
export type InvitesSendPayload = {|+payload: _InvitesSendPayload, +type: 'settings:invitesSend'|}
export type InvitesSentPayload = {|+payload: _InvitesSentPayload, +type: 'settings:invitesSent'|}
export type InvitesSentPayloadError = {|+error: true, +payload: _InvitesSentPayloadError, +type: 'settings:invitesSent'|}
export type LoadHasRandomPwPayload = {|+payload: _LoadHasRandomPwPayload, +type: 'settings:loadHasRandomPw'|}
export type LoadLockdownModePayload = {|+payload: _LoadLockdownModePayload, +type: 'settings:loadLockdownMode'|}
export type LoadRememberPassphrasePayload = {|+payload: _LoadRememberPassphrasePayload, +type: 'settings:loadRememberPassphrase'|}
export type LoadSettingsPayload = {|+payload: _LoadSettingsPayload, +type: 'settings:loadSettings'|}
export type LoadedHasRandomPwPayload = {|+payload: _LoadedHasRandomPwPayload, +type: 'settings:loadedHasRandomPw'|}
export type LoadedLockdownModePayload = {|+payload: _LoadedLockdownModePayload, +type: 'settings:loadedLockdownMode'|}
export type LoadedRememberPassphrasePayload = {|+payload: _LoadedRememberPassphrasePayload, +type: 'settings:loadedRememberPassphrase'|}
export type LoadedSettingsPayload = {|+payload: _LoadedSettingsPayload, +type: 'settings:loadedSettings'|}
export type NotificationsRefreshPayload = {|+payload: _NotificationsRefreshPayload, +type: 'settings:notificationsRefresh'|}
export type NotificationsRefreshedPayload = {|+payload: _NotificationsRefreshedPayload, +type: 'settings:notificationsRefreshed'|}
export type NotificationsSavedPayload = {|+payload: _NotificationsSavedPayload, +type: 'settings:notificationsSaved'|}
export type NotificationsTogglePayload = {|+payload: _NotificationsTogglePayload, +type: 'settings:notificationsToggle'|}
export type OnChangeLockdownModePayload = {|+payload: _OnChangeLockdownModePayload, +type: 'settings:onChangeLockdownMode'|}
export type OnChangeNewEmailPayload = {|+payload: _OnChangeNewEmailPayload, +type: 'settings:onChangeNewEmail'|}
export type OnChangeNewPassphraseConfirmPayload = {|+payload: _OnChangeNewPassphraseConfirmPayload, +type: 'settings:onChangeNewPassphraseConfirm'|}
export type OnChangeNewPassphrasePayload = {|+payload: _OnChangeNewPassphrasePayload, +type: 'settings:onChangeNewPassphrase'|}
export type OnChangeRememberPassphrasePayload = {|+payload: _OnChangeRememberPassphrasePayload, +type: 'settings:onChangeRememberPassphrase'|}
export type OnChangeShowPassphrasePayload = {|+payload: _OnChangeShowPassphrasePayload, +type: 'settings:onChangeShowPassphrase'|}
export type OnSubmitNewEmailPayload = {|+payload: _OnSubmitNewEmailPayload, +type: 'settings:onSubmitNewEmail'|}
export type OnSubmitNewPassphrasePayload = {|+payload: _OnSubmitNewPassphrasePayload, +type: 'settings:onSubmitNewPassphrase'|}
export type OnUpdateEmailErrorPayload = {|+payload: _OnUpdateEmailErrorPayload, +type: 'settings:onUpdateEmailError'|}
export type OnUpdatePGPSettingsPayload = {|+payload: _OnUpdatePGPSettingsPayload, +type: 'settings:onUpdatePGPSettings'|}
export type OnUpdatePassphraseErrorPayload = {|+payload: _OnUpdatePassphraseErrorPayload, +type: 'settings:onUpdatePassphraseError'|}
export type OnUpdatedPGPSettingsPayload = {|+payload: _OnUpdatedPGPSettingsPayload, +type: 'settings:onUpdatedPGPSettings'|}
export type ProcessorProfilePayload = {|+payload: _ProcessorProfilePayload, +type: 'settings:processorProfile'|}
export type SetAllowDeleteAccountPayload = {|+payload: _SetAllowDeleteAccountPayload, +type: 'settings:setAllowDeleteAccount'|}
export type TracePayload = {|+payload: _TracePayload, +type: 'settings:trace'|}
export type UnfurlSettingsErrorPayload = {|+payload: _UnfurlSettingsErrorPayload, +type: 'settings:unfurlSettingsError'|}
export type UnfurlSettingsRefreshPayload = {|+payload: _UnfurlSettingsRefreshPayload, +type: 'settings:unfurlSettingsRefresh'|}
export type UnfurlSettingsRefreshedPayload = {|+payload: _UnfurlSettingsRefreshedPayload, +type: 'settings:unfurlSettingsRefreshed'|}
export type UnfurlSettingsSavedPayload = {|+payload: _UnfurlSettingsSavedPayload, +type: 'settings:unfurlSettingsSaved'|}
export type WaitingForResponsePayload = {|+payload: _WaitingForResponsePayload, +type: 'settings:waitingForResponse'|}

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
  | LoadHasRandomPwPayload
  | LoadLockdownModePayload
  | LoadRememberPassphrasePayload
  | LoadSettingsPayload
  | LoadedHasRandomPwPayload
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
  | {type: 'common:resetStore', payload: null}
