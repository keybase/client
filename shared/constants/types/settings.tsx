import type * as RPCChatTypes from './rpc-chat-gen'
import type * as RPCTypes from './rpc-gen'

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

type Writeable<T> = {-readonly [P in keyof T]: T[P]}

export type EmailRow = Writeable<RPCTypes.Email>

export type EmailState = {
  addingEmail?: string
  addedEmail?: string // show banner with dismiss on account settings
  emails?: Map<string, EmailRow>
  newEmail: string
  error: string
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
  chat: ChatState
  contacts: ContactsState
  email: EmailState
  feedback: FeedbackState
  notifications: NotificationsState
}
