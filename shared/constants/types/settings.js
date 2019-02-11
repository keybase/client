// @flow strict
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import HiddenString from '../../util/hidden-string'
import type {Email, Time} from './rpc-gen'
import type {SimpleProofState} from './tracker'

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
  fullname: string,
  currentlyFollowing: boolean,
  trackerState: SimpleProofState,
} & InviteBase

export type Invitation = {
  created: number,
  email: string,
  id: string,
  type: string,
  username?: string,
  uid?: string,
  url: string,
}

export type InvitesState = {|
  pendingInvites: Array<PendingInvite>,
  acceptedInvites: Array<AcceptedInvite>,
  error: ?Error,
|}

export type NotificationsSettingsState = {
  name: string,
  subscribed: boolean,
  description: string,
}

export type NotificationsGroupState = {
  settings: ?Array<NotificationsSettingsState>,
  unsubscribedFromAll: boolean,
}

export type NotificationGroups = 'email' | 'app_push' | 'sms'

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
  randomPW: ?boolean,
}

export type EmailState = {
  emails: ?Array<Email>,
  newEmail: string,
  error: ?Error,
}

export type ChatUnfurlState = {
  unfurlMode?: RPCChatTypes.UnfurlMode,
  unfurlWhitelist?: Array<string>,
  unfurlError?: string,
}
export type ChatState = {
  unfurl: ChatUnfurlState,
}

export type State = {
  allowDeleteAccount: boolean,
  waitingForResponse: boolean,
  invites: InvitesState,
  notifications: NotificationsState,
  email: EmailState,
  passphrase: PassphraseState,
  lockdownModeEnabled: ?boolean,
  chat: ChatState,
}

type AboutTab = 'settingsTabs:aboutTab'
type AdvancedTab = 'settingsTabs:advancedTab'
type ChatTab = 'settingsTabs:chatTab'
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
type WalletsTab = 'settingsTabs:walletsTab'

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
  | WalletsTab
  | ChatTab

export type PlanLevel = string
