import type * as RPCChatTypes from './rpc-chat-gen'
import type HiddenString from '../../util/hidden-string'
import type * as RPCTypes from './rpc-gen'

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

export type NotificationsGroupStateFromServer = {
  notifications: {
    [key: string]: {
      settings: Array<{
        description: string
        description_h: string
        name: string
        subscribed: boolean
      }>
      unsub: boolean
    }
  }
}

export type NotificationsGroupState = {
  settings: Array<NotificationsSettingsState>
  unsub: boolean
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

type Writeable<T> = {-readonly [P in keyof T]: T[P]}

export type EmailRow = Writeable<RPCTypes.Email>

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

export type ContactSettingsState = {
  error: string
  settings?: RPCTypes.ContactSettings
}

export type ContactSettingsTeamsList = {[k in RPCTypes.TeamID]: boolean}

export type ChatState = {
  contactSettings: ContactSettingsState
  unfurl: ChatUnfurlState
}

export type PhoneNumbersState = {
  addedPhone: boolean
  defaultCountry?: string
  error: string
  pendingVerification: string
  phones?: Map<string, PhoneRow>
  verificationState?: 'success' | 'error'
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown'
export type ContactsState = {
  alreadyOnKeybase: Array<RPCTypes.ProcessedContact>
  importEnabled?: boolean
  importError: string
  importPromptDismissed: boolean
  importedCount?: number
  // OS permissions. 'undetermined' -> we can show the prompt; 'unknown' -> we haven't checked
  permissionStatus: PermissionStatus
  userCountryCode?: string
  waitingToShowJoinedModal: boolean
}

export type State = {
  readonly allowDeleteAccount: boolean
  readonly chat: ChatState
  readonly checkPasswordIsCorrect?: boolean
  readonly contacts: ContactsState
  readonly didToggleCertificatePinning?: boolean
  readonly email: EmailState
  readonly feedback: FeedbackState
  readonly invites: InvitesState
  readonly lockdownModeEnabled?: boolean
  readonly notifications: NotificationsState
  readonly password: PasswordState
  readonly phoneNumbers: PhoneNumbersState
  readonly proxyData?: RPCTypes.ProxyData
}

export type PlanLevel = string
