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

export type State = {
  notifications: NotificationsState
}
