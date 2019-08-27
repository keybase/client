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

export type _EmailRow = RPCTypes.Email
export type EmailRow = I.RecordOf<_EmailRow>

export type _EmailState = {
  addingEmail: string | null
  addedEmail: string | null // show banner with dismiss on account settings
  emails: I.Map<string, EmailRow> | null
  newEmail: string
  error: string
}
export type EmailState = I.RecordOf<_EmailState>

export type _PhoneRow = {
  displayNumber: string
  e164: string
  searchable: boolean
  superseded: boolean
  verified: boolean
}
export type PhoneRow = I.RecordOf<_PhoneRow>

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

export type _PhoneNumbersState = {
  addedPhone: boolean
  error: string
  pendingVerification: string
  phones: I.Map<string, PhoneRow> | null
  verificationState: 'success' | 'error' | null
}
export type PhoneNumbersState = I.RecordOf<_PhoneNumbersState>

export type PermissionStatus = 'granted' | 'never_ask_again' | 'undetermined' | 'unknown'
export type _ContactsState = {
  importEnabled: boolean | null
  importError: string
  importPromptDismissed: boolean
  importedCount: number | null
  // OS permissions. 'undetermined' -> we can show the prompt; 'unknown' -> we haven't checked
  permissionStatus: PermissionStatus
  userCountryCode: string | null
}
export type ContactsState = I.RecordOf<_ContactsState>

export type _State = {
  allowDeleteAccount: boolean
  contacts: ContactsState
  invites: InvitesState
  feedback: FeedbackState
  notifications: NotificationsState
  email: EmailState
  password: PasswordState
  phoneNumbers: PhoneNumbersState
  lockdownModeEnabled: boolean | null
  useNativeFrame: boolean
  chat: ChatState
  checkPasswordIsCorrect: boolean | null
  proxyData: RPCTypes.ProxyData | null
  didToggleCertificatePinning: boolean | null
}
export type State = I.RecordOf<_State>

export const aboutTab = 'settingsTabs.aboutTab'
export const advancedTab = 'settingsTabs.advancedTab'
export const chatTab = 'settingsTabs.chatTab'
export const deleteMeTab = 'settingsTabs.deleteMeTab'
export const devicesTab = 'settingsTabs.devicesTab'
export const feedbackTab = 'settingsTabs.feedbackTab'
export const foldersTab = 'settingsTabs.foldersTab'
export const fsTab = 'settingsTabs.fsTab'
export const gitTab = 'settingsTabs.gitTab'
export const invitationsTab = 'settingsTabs.invitationsTab'
export const accountTab = 'settingsTabs.accountTab'
export const notificationsTab = 'settingsTabs.notificationsTab'
export const passwordTab = 'settingsTabs.password'
export const screenprotectorTab = 'settingsTabs.screenprotector'
export const logOutTab = 'settingsTabs.logOutTab'
export const updatePaymentTab = 'settingsTabs.updatePaymentTab'
export const walletsTab = 'settingsTabs.walletsTab'
export const contactsTab = 'settingsTabs.contactsTab'

export type SettingsTab =
  | typeof accountTab
  | typeof updatePaymentTab
  | typeof invitationsTab
  | typeof notificationsTab
  | typeof advancedTab
  | typeof deleteMeTab
  | typeof feedbackTab
  | typeof aboutTab
  | typeof devicesTab
  | typeof gitTab
  | typeof foldersTab
  | typeof fsTab
  | typeof logOutTab
  | typeof screenprotectorTab
  | typeof passwordTab
  | typeof walletsTab
  | typeof chatTab
  | typeof contactsTab

export type PlanLevel = string
