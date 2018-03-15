// @flow
import type {Email} from './rpc-gen'
import type {AcceptedInvite, PendingInvite} from '../../settings/invites/index'
import HiddenString from '../../util/hidden-string'

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
  rememberPassphrase: boolean,
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

type AboutTab = 'settingsTabs:aboutTab'
type AdvancedTab = 'settingsTabs:advancedTab'
type DeleteMeTab = 'settingsTabs:deleteMeTab'
type DevMenuTab = 'settingsTabs:devMenuTab'
type DevicesTab = 'settingsTabs:devicesTab'
type FeedbackTab = 'settingsTabs:feedbackTab'
type FoldersTab = 'settingsTabs:foldersTab'
type FsTab = 'settingsTabs:fsTab'
type GitTab = 'settingsTabs:gitTab'
type InvitationsTab = 'settingsTabs:invitationsTab'
type LandingTab = 'settingsTabs:landingTab'
type NotificationsTab = 'settingsTabs:notificationsTab'
type PassphraseTab = 'settingsTabs:passphrase'
type ScreenprotectorTab = 'settingsTabs:screenprotector'
type UpdatePaymentTab = 'settingsTabs:updatePaymentTab'

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
  | FsTab
  | ScreenprotectorTab
  | PassphraseTab

export type PlanLevel = string
