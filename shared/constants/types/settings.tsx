import * as RPCChatTypes from './rpc-chat-gen'
import HiddenString from '../../util/hidden-string'
import * as RPCTypes from './rpc-gen'

type InviteBase = {
  id: string
  created: RPCTypes.Time
}

export type PendingInvite = {
  url: string
  email?: string
} & InviteBase

export type AcceptedInvite = {
  username: string
} & InviteBase

export type Invitation = {
  created: number
  email?: string
  id: string
  type: string
  username: string
  uid?: string
  url: string
}

export type InvitesState = {
  pendingInvites: Array<PendingInvite>
  acceptedInvites: Array<AcceptedInvite>
  error?: Error
}

export type NotificationsSettingsState = {
  name: string
  subscribed: boolean
  description: string
}

export type NotificationsGroupState = {
  settings: Array<NotificationsSettingsState>
  unsubscribedFromAll: boolean
}

export type NotificationSettingsStateGroups = Map<string, NotificationsGroupState>

export type NotificationsState = {
  allowEdit: boolean
  groups: Map<string, NotificationsGroupState>
}

export type PasswordState = {
  newPassword: HiddenString
  newPasswordConfirm: HiddenString
  error?: Error
  newPasswordError?: HiddenString
  newPasswordConfirmError?: HiddenString
  hasPGPKeyOnServer?: boolean
  rememberPassword: boolean
  randomPW?: boolean
}

export type EmailRow = RPCTypes.Email

export type EmailState = {
  addingEmail?: string
  addedEmail?: string // show banner with dismiss on account settings
  emails?: Map<string, EmailRow>
  newEmail: string
  error: string
}

export type PhoneRow = {
  displayNumber: string
  e164: string
  searchable: boolean
  superseded: boolean
  verified: boolean
}

export type FeedbackState = {
  error?: Error
}

export type ChatUnfurlState = {
  unfurlMode?: RPCChatTypes.UnfurlMode
  unfurlWhitelist?: Array<string>
  unfurlError?: string
}

export type ChatState = {
  unfurl: ChatUnfurlState
}

export type PhoneNumbersState = {
  addedPhone: boolean
  error: string
  pendingVerification: string
  phones?: Map<string, PhoneRow>
  verificationState?: 'success' | 'error'
}

export type PermissionStatus = 'granted' | 'never_ask_again' | 'undetermined' | 'unknown'
export type ContactsState = {
  importEnabled?: boolean
  importError: string
  importPromptDismissed: boolean
  importedCount?: number
  // OS permissions. 'undetermined' -> we can show the prompt; 'unknown' -> we haven't checked
  permissionStatus: PermissionStatus
  userCountryCode?: string
}

export type State = Readonly<{
  allowDeleteAccount: boolean
  contacts: ContactsState
  invites: InvitesState
  feedback: FeedbackState
  notifications: NotificationsState
  email: EmailState
  password: PasswordState
  phoneNumbers: PhoneNumbersState
  lockdownModeEnabled?: boolean
  chat: ChatState
  checkPasswordIsCorrect?: boolean
  proxyData?: RPCTypes.ProxyData
  didToggleCertificatePinning?: boolean
}>

export type PlanLevel = string
