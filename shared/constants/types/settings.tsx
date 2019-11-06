import * as RPCChatTypes from './rpc-chat-gen'
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
  defaultPhoneNumberCountry: string
  invites: InvitesState
  feedback: FeedbackState
  notifications: NotificationsState
  email: EmailState
  password: PasswordState
  phoneNumbers: PhoneNumbersState
  lockdownModeEnabled: boolean | null
  chat: ChatState
  checkPasswordIsCorrect: boolean | null
  proxyData: RPCTypes.ProxyData | null
  didToggleCertificatePinning: boolean | null
}
export type State = I.RecordOf<_State>

export type PlanLevel = string
