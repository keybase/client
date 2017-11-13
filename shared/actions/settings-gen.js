// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Constants from '../constants/settings'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
export const invitesClearError = 'settings:invitesClearError'
export const invitesReclaim = 'settings:invitesReclaim'
export const invitesReclaimed = 'settings:invitesReclaimed'
export const invitesRefresh = 'settings:invitesRefresh'
export const invitesRefreshed = 'settings:invitesRefreshed'
export const invitesSend = 'settings:invitesSend'
export const invitesSent = 'settings:invitesSent'
export const loadSettings = 'settings:loadSettings'
export const loadedSettings = 'settings:loadedSettings'
export const notificationsRefresh = 'settings:notificationsRefresh'
export const notificationsRefreshed = 'settings:notificationsRefreshed'
export const notificationsSaved = 'settings:notificationsSaved'
export const notificationsToggle = 'settings:notificationsToggle'
export const onChangeNewEmail = 'settings:onChangeNewEmail'
export const onChangeNewPassphrase = 'settings:onChangeNewPassphrase'
export const onChangeNewPassphraseConfirm = 'settings:onChangeNewPassphraseConfirm'
export const onChangeShowPassphrase = 'settings:onChangeShowPassphrase'
export const onSubmitNewEmail = 'settings:onSubmitNewEmail'
export const onSubmitNewPassphrase = 'settings:onSubmitNewPassphrase'
export const onUpdateEmailError = 'settings:onUpdateEmailError'
export const onUpdatePGPSettings = 'settings:onUpdatePGPSettings'
export const onUpdatePassphraseError = 'settings:onUpdatePassphraseError'
export const onUpdatedPGPSettings = 'settings:onUpdatedPGPSettings'
export const setAllowDeleteAccount = 'settings:setAllowDeleteAccount'
export const waitingForResponse = 'settings:waitingForResponse'

// Action Creators
export const createDbNuke = () => ({error: false, payload: undefined, type: dbNuke})
export const createDeleteAccountForever = () => ({error: false, payload: undefined, type: deleteAccountForever})
export const createInvitesClearError = () => ({error: false, payload: undefined, type: invitesClearError})
export const createInvitesReclaim = (payload: {|+inviteId: string|}) => ({error: false, payload, type: invitesReclaim})
export const createInvitesReclaimed = () => ({error: false, payload: undefined, type: invitesReclaimed})
export const createInvitesReclaimedError = (payload: {|+errorText: string|}) => ({error: true, payload, type: invitesReclaimed})
export const createInvitesRefresh = () => ({error: false, payload: undefined, type: invitesRefresh})
export const createInvitesRefreshed = (payload: {|+invites: Constants.InvitesState|}) => ({error: false, payload, type: invitesRefreshed})
export const createInvitesSend = (payload: {|+email: string, +message: ?string|}) => ({error: false, payload, type: invitesSend})
export const createInvitesSent = () => ({error: false, payload: undefined, type: invitesSent})
export const createInvitesSentError = (payload: {|+error: Error|}) => ({error: true, payload, type: invitesSent})
export const createLoadSettings = () => ({error: false, payload: undefined, type: loadSettings})
export const createLoadedSettings = (payload: {|+emailState: Constants.EmailState|}) => ({error: false, payload, type: loadedSettings})
export const createNotificationsRefresh = () => ({error: false, payload: undefined, type: notificationsRefresh})
export const createNotificationsRefreshed = (payload: {|+notifications: Constants.NotificationsState|}) => ({error: false, payload, type: notificationsRefreshed})
export const createNotificationsSaved = () => ({error: false, payload: undefined, type: notificationsSaved})
export const createNotificationsToggle = (payload: {|+group: string, +name?: ?string|}) => ({error: false, payload, type: notificationsToggle})
export const createOnChangeNewEmail = (payload: {|+email: string|}) => ({error: false, payload, type: onChangeNewEmail})
export const createOnChangeNewPassphrase = (payload: {|+passphrase: HiddenString|}) => ({error: false, payload, type: onChangeNewPassphrase})
export const createOnChangeNewPassphraseConfirm = (payload: {|+passphrase: HiddenString|}) => ({error: false, payload, type: onChangeNewPassphraseConfirm})
export const createOnChangeShowPassphrase = () => ({error: false, payload: undefined, type: onChangeShowPassphrase})
export const createOnSubmitNewEmail = () => ({error: false, payload: undefined, type: onSubmitNewEmail})
export const createOnSubmitNewPassphrase = () => ({error: false, payload: undefined, type: onSubmitNewPassphrase})
export const createOnUpdateEmailError = (payload: {|+error: Error|}) => ({error: false, payload, type: onUpdateEmailError})
export const createOnUpdatePGPSettings = () => ({error: false, payload: undefined, type: onUpdatePGPSettings})
export const createOnUpdatePassphraseError = (payload: {|+error: Error|}) => ({error: false, payload, type: onUpdatePassphraseError})
export const createOnUpdatedPGPSettings = (payload: {|+hasKeys: boolean|}) => ({error: false, payload, type: onUpdatedPGPSettings})
export const createSetAllowDeleteAccount = (payload: {|+allow: boolean|}) => ({error: false, payload, type: setAllowDeleteAccount})
export const createWaitingForResponse = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: waitingForResponse})

// Action Payloads
export type DbNukePayload = More.ReturnType<typeof createDbNuke>
export type DeleteAccountForeverPayload = More.ReturnType<typeof createDeleteAccountForever>
export type InvitesClearErrorPayload = More.ReturnType<typeof createInvitesClearError>
export type InvitesReclaimPayload = More.ReturnType<typeof createInvitesReclaim>
export type InvitesReclaimedPayload = More.ReturnType<typeof createInvitesReclaimed>
export type InvitesRefreshPayload = More.ReturnType<typeof createInvitesRefresh>
export type InvitesRefreshedPayload = More.ReturnType<typeof createInvitesRefreshed>
export type InvitesSendPayload = More.ReturnType<typeof createInvitesSend>
export type InvitesSentPayload = More.ReturnType<typeof createInvitesSent>
export type LoadSettingsPayload = More.ReturnType<typeof createLoadSettings>
export type LoadedSettingsPayload = More.ReturnType<typeof createLoadedSettings>
export type NotificationsRefreshPayload = More.ReturnType<typeof createNotificationsRefresh>
export type NotificationsRefreshedPayload = More.ReturnType<typeof createNotificationsRefreshed>
export type NotificationsSavedPayload = More.ReturnType<typeof createNotificationsSaved>
export type NotificationsTogglePayload = More.ReturnType<typeof createNotificationsToggle>
export type OnChangeNewEmailPayload = More.ReturnType<typeof createOnChangeNewEmail>
export type OnChangeNewPassphraseConfirmPayload = More.ReturnType<typeof createOnChangeNewPassphraseConfirm>
export type OnChangeNewPassphrasePayload = More.ReturnType<typeof createOnChangeNewPassphrase>
export type OnChangeShowPassphrasePayload = More.ReturnType<typeof createOnChangeShowPassphrase>
export type OnSubmitNewEmailPayload = More.ReturnType<typeof createOnSubmitNewEmail>
export type OnSubmitNewPassphrasePayload = More.ReturnType<typeof createOnSubmitNewPassphrase>
export type OnUpdateEmailErrorPayload = More.ReturnType<typeof createOnUpdateEmailError>
export type OnUpdatePGPSettingsPayload = More.ReturnType<typeof createOnUpdatePGPSettings>
export type OnUpdatePassphraseErrorPayload = More.ReturnType<typeof createOnUpdatePassphraseError>
export type OnUpdatedPGPSettingsPayload = More.ReturnType<typeof createOnUpdatedPGPSettings>
export type SetAllowDeleteAccountPayload = More.ReturnType<typeof createSetAllowDeleteAccount>
export type WaitingForResponsePayload = More.ReturnType<typeof createWaitingForResponse>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDbNuke>
  | More.ReturnType<typeof createDeleteAccountForever>
  | More.ReturnType<typeof createInvitesClearError>
  | More.ReturnType<typeof createInvitesReclaim>
  | More.ReturnType<typeof createInvitesReclaimed>
  | More.ReturnType<typeof createInvitesReclaimedError>
  | More.ReturnType<typeof createInvitesRefresh>
  | More.ReturnType<typeof createInvitesRefreshed>
  | More.ReturnType<typeof createInvitesSend>
  | More.ReturnType<typeof createInvitesSent>
  | More.ReturnType<typeof createInvitesSentError>
  | More.ReturnType<typeof createLoadSettings>
  | More.ReturnType<typeof createLoadedSettings>
  | More.ReturnType<typeof createNotificationsRefresh>
  | More.ReturnType<typeof createNotificationsRefreshed>
  | More.ReturnType<typeof createNotificationsSaved>
  | More.ReturnType<typeof createNotificationsToggle>
  | More.ReturnType<typeof createOnChangeNewEmail>
  | More.ReturnType<typeof createOnChangeNewPassphrase>
  | More.ReturnType<typeof createOnChangeNewPassphraseConfirm>
  | More.ReturnType<typeof createOnChangeShowPassphrase>
  | More.ReturnType<typeof createOnSubmitNewEmail>
  | More.ReturnType<typeof createOnSubmitNewPassphrase>
  | More.ReturnType<typeof createOnUpdateEmailError>
  | More.ReturnType<typeof createOnUpdatePGPSettings>
  | More.ReturnType<typeof createOnUpdatePassphraseError>
  | More.ReturnType<typeof createOnUpdatedPGPSettings>
  | More.ReturnType<typeof createSetAllowDeleteAccount>
  | More.ReturnType<typeof createWaitingForResponse>
  | {type: 'common:resetStore', payload: void}
