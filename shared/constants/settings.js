// @flow
import type {Email} from './types/flow-types'
import type {AcceptedInvite, PendingInvite} from '../settings/invites/index'
import HiddenString from '../util/hidden-string'

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
  pendingInvites: Array<PendingInvite>,
  acceptedInvites: Array<AcceptedInvite>,
  error: ?Error,
}

export type NotificationsSettingsState = {
  name: string,
  subscribed: boolean,
  description: string,
}

export type NotificationsGroupState = {
  settings: ?Array<NotificationsSettingsState>,
  unsubscribedFromAll: boolean,
}

export type NotificationsState = {
  allowEdit: boolean,
  groups: {
    email?: NotificationsGroupState,
    app_push?: NotificationsGroupState,
    sms?: NotificationsGroupState,
  },
}

export type PassphraseState = {
  newPassphrase: HiddenString,
  newPassphraseConfirm: HiddenString,
  error: ?Error,
  newPassphraseError: ?HiddenString,
  newPassphraseConfirmError: ?HiddenString,
  hasPGPKeyOnServer: ?boolean,
}

export type EmailState = {
  emails: Array<Email>,
  newEmail: string,
  error: ?Error,
}

export type State = {
  allowDeleteAccount: boolean,
  waitingForResponse: boolean,
  invites: InvitesState,
  notifications: NotificationsState,
  email: EmailState,
  passphrase: PassphraseState,
}

const initialState: State = {
  allowDeleteAccount: false,
  email: {
    emails: [],
    error: null,
    newEmail: '',
  },
  invites: {
    acceptedInvites: [],
    error: null,
    pendingInvites: [],
  },
  notifications: {
    allowEdit: false,
    groups: {
      email: {
        settings: null,
        unsubscribedFromAll: false,
      },
    },
  },
  passphrase: {
    error: null,
    hasPGPKeyOnServer: null,
    newPassphrase: new HiddenString(''),
    newPassphraseConfirm: new HiddenString(''),
    newPassphraseConfirmError: null,
    newPassphraseError: null,
  },
  push: {
    permissionsPrompt: false,
    permissionsRequesting: false,
    token: '',
    tokenType: '',
  },
  waitingForResponse: false,
}

export type PlanLevel = string
type LandingTab = 'settingsTabs:landingTab'
export const landingTab = 'settingsTabs:landingTab'
type UpdatePaymentTab = 'settingsTabs:updatePaymentTab'
export const updatePaymentTab = 'settingsTabs:updatePaymentTab'
type InvitationsTab = 'settingsTabs:invitationsTab'
export const invitationsTab = 'settingsTabs:invitationsTab'
type NotificationsTab = 'settingsTabs:notificationsTab'
export const notificationsTab = 'settingsTabs:notificationsTab'
type AdvancedTab = 'settingsTabs:advancedTab'
export const advancedTab = 'settingsTabs:advancedTab'
type DeleteMeTab = 'settingsTabs:deleteMeTab'
export const deleteMeTab = 'settingsTabs:deleteMeTab'
type DevMenuTab = 'settingsTabs:devMenuTab'
export const devMenuTab = 'settingsTabs:devMenuTab'
type FeedbackTab = 'settingsTabs:feedbackTab'
export const feedbackTab = 'settingsTabs:feedbackTab'
type AboutTab = 'settingsTabs:aboutTab'
export const aboutTab = 'settingsTabs:aboutTab'
type FoldersTab = 'settingsTabs:foldersTab'
export const foldersTab = 'settingsTabs:foldersTab'
type GitTab = 'settingsTabs:gitTab'
export const gitTab = 'settingsTabs:gitTab'
type DevicesTab = 'settingsTabs:devicesTab'
export const devicesTab = 'settingsTabs:devicesTab'
type ScreenprotectorTab = 'settingsTabs:screenprotector'
export const screenprotectorTab = 'settingsTabs:screenprotector'
type PassphraseTab = 'settingsTabs:passphrase'
export const passphraseTab = 'settingsTabs:passphrase'

export type Tab =
  | LandingTab
  | UpdatePaymentTab
  | InvitationsTab
  | NotificationsTab
  | AdvancedTab
  | DeleteMeTab
  | DevMenuTab
  | FeedbackTab
  | AboutTab
  | DevicesTab
  | GitTab
  | FoldersTab
  | ScreenprotectorTab
  | PassphraseTab

export const securityGroup = 'security'
export {initialState}
