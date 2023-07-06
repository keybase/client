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

export type State = {
  chat: ChatState
  notifications: NotificationsState
}
