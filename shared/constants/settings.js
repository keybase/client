// @flow
import type {NoErrorTypedAction, TypedAction} from '../constants/types/flux'
import type {Email} from './types/flow-types'
import HiddenString from '../util/hidden-string'

export const invitesReclaim = 'settings:invitesReclaim'
export type InvitesReclaim = NoErrorTypedAction<'settings:invitesReclaim', {inviteId: string}>

export const invitesReclaimed = 'settings:invitesReclaimed'
export type InvitesReclaimed = TypedAction<'settings:invitesReclaimed', void, {errorText: string}>

export const invitesRefresh = 'settings:invitesRefresh'
export type InvitesRefresh = NoErrorTypedAction<'settings:invitesRefresh', void>
export const invitesRefreshed = 'settings:invitesRefreshed'
export type InvitesRefreshed = NoErrorTypedAction<'settings:invitesRefreshed', InvitesState>

export const invitesSend = 'settings:invitesSend'
export type InvitesSend = NoErrorTypedAction<'settings:invitesSend', {
  email: string,
  message: ?string,
}>

export const invitesSent = 'settings:invitesSent'
export type InvitesSent = TypedAction<'settings:invitesSent', {email: string}, {errorText: string}>

export const notificationsRefresh = 'settings:notificationsRefresh'
export type NotificationsRefresh = NoErrorTypedAction<'settings:notificationsRefresh', void>
export const notificationsRefreshed = 'settings:notificationsRefreshed'
export type NotificationsRefreshed = NoErrorTypedAction<'settings:notificationsRefreshed', NotificationsState>

export const notificationsSave = 'settings:notificationsSave'
export type NotificationsSave = NoErrorTypedAction<'settings:notificationsSave', void>
export const notificationsSaved = 'settings:notificationsSaved'
export type NotificationsSaved = NoErrorTypedAction<'settings:notificationsSaved', void>

export const notificationsToggle = 'settings:notificationsToggle'
export type NotificationsToggle = NoErrorTypedAction<'settings:notificationsToggle', {name: ?string}>

export const setAllowDeleteAccount = 'settings:setAllowDeleteAccount'
export type SetAllowDeleteAccount = NoErrorTypedAction<'settings:setAllowDeleteAccount', boolean>

export const deleteAccountForever = 'settings:deleteAccountForever'
export type DeleteAccountForever = NoErrorTypedAction<'settings:deleteAccountForever', void>

export const onChangeNewPassphrase = 'settings:onChangeNewPassphrase'
export type OnChangeNewPassphrase = NoErrorTypedAction<'settings:onChangeNewPassphrase', {passphrase: HiddenString}>

export const onChangeNewPassphraseConfirm = 'settings:onChangeNewPassphraseConfirm'
export type OnChangeNewPassphraseConfirm = NoErrorTypedAction<'settings:onChangeNewPassphraseConfirm', {passphrase: HiddenString}>

export const onChangeShowPassphrase = 'settings:onChangeShowPassphrase'
export type OnChangeShowPassphrase = NoErrorTypedAction<'settings:onChangeShowPassphrase', void>

export const onSubmitNewPassphrase = 'settings:onSubmitNewPassphrase'
export type OnSubmitNewPassphrase = NoErrorTypedAction<'settings:onSubmitNewPassphrase', void>

export const onUpdatePassphraseError = 'settings:onUpdatePassphraseError'
export type OnUpdatePassphraseError = NoErrorTypedAction<'settings:onUpdatePassphraseError', {error: string}>

export const onChangeNewEmail = 'settings:onChangeNewEmail'
export type OnChangeNewEmail = NoErrorTypedAction<'settings:onChangeNewEmail', {email: string}>

export const onSubmitNewEmail = 'settings:onSubmitNewEmail'
export type OnSubmitNewEmail = NoErrorTypedAction<'settings:onSubmitNewEmail', void>

export const onUpdateEmailError = 'settings:onUpdateEmailError'
export type OnUpdateEmailError = NoErrorTypedAction<'settings:onUpdateEmailError', {error: string}>

export const onUpdatePGPSettings = 'settings:onUpdatePGPSettings'
export type OnUpdatePGPSettings = NoErrorTypedAction<'settings:onUpdatePGPSettings', void>

export const onUpdatedPGPSettings = 'settings:onUpdatedPGPSettings'
export type OnUpdatedPGPSettings = NoErrorTypedAction<'settings:onUpdatedPGPSettings', {hasKeys: boolean}>

export type PlanLevel = string

export const loadSettings = 'settings:loadSettings'
export type LoadSettings = NoErrorTypedAction<'settings:loadSettings', void>

export const loadedSettings = 'settings:loadedSettings'

export type Actions = InvitesRefresh | NotificationsRefresh | NotificationsRefreshed | NotificationsSave | NotificationsSaved | NotificationsToggle | SetAllowDeleteAccount

export type Invitation = {
  created: number,
  email: string,
  id: string,
  type: string,
  username?: string,
  uid?: string,
  url: string,
}

export type InvitesState = {
  pendingInvites: Array<Invitation>,
  acceptedInvites: Array<Invitation>,
}

export type NotificationsState = {
  settings: ?Array<{
    name: string,
    subscribed: boolean,
    description: string,
  }>,
  unsubscribedFromAll: ?boolean,
  allowSave: boolean,
  allowEdit: boolean,
}

export type PassphraseState = {
  newPassphrase: HiddenString,
  newPassphraseConfirm: HiddenString,
  showTyping: boolean,
  errorMessage: ?HiddenString,
  newPassphraseError: ?HiddenString,
  newPassphraseConfirmError: ?HiddenString,
  hasPGPKeyOnServer: ?boolean,
  canSave: boolean,
}

export type EmailState = {
  emails: Array<Email>,
  newEmail: string,
  errorMessage: ?string,
}

export type State = {
  allowDeleteAccount: boolean,
  invites: InvitesState,
  notifications: NotificationsState,
  email: EmailState,
  passphrase: PassphraseState,
}
