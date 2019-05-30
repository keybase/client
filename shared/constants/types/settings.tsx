import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import HiddenString from '../../util/hidden-string'
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'

type InviteBase = {
  id: string
  created: RPCTypes.Time
}

export type PendingInvite = {
  url: string
  email: string | null
} & InviteBase

export type AcceptedInvite = {
  username: string
} & InviteBase

export type Invitation = {
  created: number
  email: string | null
  id: string
  type: string
  username: string
  uid?: string
  url: string
}

export type _InvitesState = {
  pendingInvites: I.List<PendingInvite>
  acceptedInvites: I.List<AcceptedInvite>
  error: Error | null
}
export type InvitesState = I.RecordOf<_InvitesState>

export type _NotificationsSettingsState = {
  name: string
  subscribed: boolean
  description: string
}
export type NotificationsSettingsState = I.RecordOf<_NotificationsSettingsState>

export type _NotificationsGroupState = {
  settings: I.List<NotificationsSettingsState>
  unsubscribedFromAll: boolean
}
export type NotificationsGroupState = I.RecordOf<_NotificationsGroupState>

export type NotificationSettingsStateGroups = I.Map<string, NotificationsGroupState>

export type _NotificationsState = {
  allowEdit: boolean
  groups: I.Map<string, NotificationsGroupState>
}

export type NotificationsState = I.RecordOf<_NotificationsState>

export type _PasswordState = {
  newPassword: HiddenString
  newPasswordConfirm: HiddenString
  error: Error | null
  newPasswordError: HiddenString | null
  newPasswordConfirmError: HiddenString | null
  hasPGPKeyOnServer: boolean | null
  rememberPassword: boolean
  randomPW: boolean | null
}
export type PasswordState = I.RecordOf<_PasswordState>

// Record types don't play well with $ReadOnly types, which
// RPCTypes.TeamSettings is, so we want to extract the underlying
// writeable type. Just spreading doesn't give us what we want, as
// that makes all keys optional (see
// https://github.com/facebook/flow/issues/3534 ), so use $Exact to
// fix that.
export type _EmailRow = {} & RPCTypes.Email
export type EmailRow = I.RecordOf<_EmailRow>

export type _EmailState = {
  emails: I.List<EmailRow> | null
  newEmail: string
  error: Error | null
}
export type EmailState = I.RecordOf<_EmailState>

export type _FeedbackState = {
  error: Error | null
}
export type FeedbackState = I.RecordOf<_FeedbackState>

export type _ChatUnfurlState = {
  unfurlMode?: RPCChatTypes.UnfurlMode
  unfurlWhitelist?: I.List<string>
  unfurlError?: string
}
export type ChatUnfurlState = I.RecordOf<_ChatUnfurlState>

export type _ChatState = {
  unfurl: ChatUnfurlState
}
export type ChatState = I.RecordOf<_ChatState>

export type _State = {
  allowDeleteAccount: boolean
  waitingForResponse: boolean
  invites: InvitesState
  feedback: FeedbackState
  notifications: NotificationsState
  email: EmailState
  password: PasswordState
  lockdownModeEnabled: boolean | null
  useNativeFrame: boolean
  chat: ChatState
  checkPasswordIsCorrect: boolean | null
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
type PasswordTab = 'settingsTabs.password'
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
  | PasswordTab
  | WalletsTab
  | ChatTab

export type PlanLevel = string
