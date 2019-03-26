// @flow strict
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import HiddenString from '../../util/hidden-string'
import * as I from 'immutable'
import type {Email, Time} from './rpc-gen'

type InviteBase = {
  id: string,
  created: Time,
}

export type PendingInvite = {
  url: string,
  email: ?string,
} & InviteBase

export type AcceptedInvite = {
  username: string,
} & InviteBase

export type Invitation = {
  created: number,
  email: ?string,
  id: string,
  type: string,
  username: string,
  uid?: string,
  url: string,
}

export type _InvitesState = {|
  pendingInvites: I.List<PendingInvite>,
  acceptedInvites: I.List<AcceptedInvite>,
  error: ?Error,
|}
export type InvitesState = I.RecordOf<_InvitesState>

export type _NotificationsSettingsState = {
  name: string,
  subscribed: boolean,
  description: string,
}
export type NotificationsSettingsState = I.RecordOf<_NotificationsSettingsState>

export type _NotificationsGroupState = {
  settings: I.Map<string, NotificationsSettingsState>,
  unsubscribedFromAll: boolean,
}
export type NotificationsGroupState = I.RecordOf<_NotificationsGroupState>

export type NotificationGroups = 'email' | 'app_push' | 'sms'

export type _NotificationsState = {
  allowEdit: boolean,
  groups: {
    email?: NotificationsGroupState,
    app_push?: NotificationsGroupState,
    sms?: NotificationsGroupState,
  },
}
export type NotificationsState = I.RecordOf<_NotificationsState>

export type _PassphraseState = {
  newPassphrase: HiddenString,
  newPassphraseConfirm: HiddenString,
  error: ?Error,
  newPassphraseError: ?HiddenString,
  newPassphraseConfirmError: ?HiddenString,
  hasPGPKeyOnServer: ?boolean,
  rememberPassphrase: boolean,
  randomPW: ?boolean,
}
export type PassphraseState = I.RecordOf<_PassphraseState>

export type _EmailState = {
  emails: ?I.List<Email>,
  newEmail: string,
  error: ?Error,
}
export type EmailState = I.RecordOf<_EmailState>

export type ChatUnfurlState = {
  unfurlMode?: RPCChatTypes.UnfurlMode,
  unfurlWhitelist?: Array<string>,
  unfurlError?: string,
}
export type ChatState = {
  unfurl: ChatUnfurlState,
}

export type _State = {
  allowDeleteAccount: boolean,
  waitingForResponse: boolean,
  invites: InvitesState,
  notifications: I.RecordOf<NotificationsState>,
  email: EmailState,
  passphrase: PassphraseState,
  lockdownModeEnabled: ?boolean,
  chat: ChatState,
  checkPassphraseIsCorrect: ?boolean,
}
export type State = I.RecordOf<_State>

type AboutTab = 'settingsTabs.aboutTab'
type AdvancedTab = 'settingsTabs.advancedTab'
type ChatTab = 'settingsTabs.chatTab'
type DeleteMeTab = 'settingsTabs.deleteMeTab'
type DevicesTab = 'settingsTabs.devicesTab'
type FeedbackTab = 'settingsTabs.feedbackTab'
type FoldersTab = 'settingsTabs.foldersTab'
type FsTab = 'settingsTabs.fsTab'
type GitTab = 'settingsTabs.gitTab'
type InvitationsTab = 'settingsTabs.invitationsTab'
type LandingTab = 'settingsTabs.landingTab'
type NotificationsTab = 'settingsTabs.notificationsTab'
type PassphraseTab = 'settingsTabs.passphrase'
type ScreenprotectorTab = 'settingsTabs.screenprotector'
type LogOutTab = 'settingsTabs.logOutTab'
type UpdatePaymentTab = 'settingsTabs.updatePaymentTab'
type WalletsTab = 'settingsTabs.walletsTab'

export type Tab =
  | LandingTab
  | UpdatePaymentTab
  | InvitationsTab
  | NotificationsTab
  | AdvancedTab
  | DeleteMeTab
  | FeedbackTab
  | AboutTab
  | DevicesTab
  | GitTab
  | FoldersTab
  | FsTab
  | LogOutTab
  | ScreenprotectorTab
  | PassphraseTab
  | WalletsTab
  | ChatTab

export type PlanLevel = string
